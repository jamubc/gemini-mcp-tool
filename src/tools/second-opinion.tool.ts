import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { Logger } from '../utils/logger.js';
import { executeGeminiCLI } from '../utils/geminiExecutor.js';
import {
  buildSolvePrompt,
  buildComparePrompt,
  formatResult,
} from '../utils/secondOpinion.js';
import { STATUS_MESSAGES } from '../constants.js';

/**
 * Type signature for an executor function compatible with executeGeminiCLI.
 * Accepting an injected executor makes the anti-anchoring invariant testable
 * without spawning real subprocesses.
 */
export type GeminiExecutor = (
  prompt: string,
  model?: string,
  sandbox?: boolean,
  changeMode?: boolean,
  onProgress?: (output: string) => void
) => Promise<string>;

const secondOpinionArgsSchema = z.object({
  problem: z
    .string()
    .min(1)
    .describe(
      'The problem or question to be answered independently. Must not include any existing answer — state only the problem.'
    ),
  ownAnswer: z
    .string()
    .optional()
    .describe(
      "The orchestrator's own answer to the problem. Provided only for the optional divergence comparison step — it is NEVER forwarded to the independent solve call."
    ),
  model: z
    .string()
    .optional()
    .describe(
      "Optional Gemini model to use (e.g., 'gemini-2.5-flash'). Defaults to gemini-2.5-pro."
    ),
  compare: z
    .boolean()
    .default(true)
    .describe(
      'When true (default) and ownAnswer is provided, perform a divergence comparison after the independent solve.'
    ),
});

/**
 * Factory that produces the second-opinion UnifiedTool with a configurable
 * executor. Production code uses the default (executeGeminiCLI). Tests inject
 * a fake executor to capture prompts without spawning subprocesses.
 */
export function createSecondOpinionTool(
  executor: GeminiExecutor = executeGeminiCLI
): UnifiedTool {
  return {
    name: 'second-opinion',
    description:
      'Obtain a blind, independent Gemini answer to a problem without exposing any existing answer (anti-anchoring). Optionally compare the independent answer with the orchestrator\'s own answer to surface agreements and divergences.',
    zodSchema: secondOpinionArgsSchema,
    prompt: {
      description:
        'Obtain an independent second opinion on a problem, then optionally compare it with an existing answer to identify divergences.',
    },
    category: 'gemini',

    execute: async (args, onProgress) => {
      const { problem, ownAnswer, model, compare = true } = args;

      const problemStr = typeof problem === 'string' ? problem : String(problem ?? '');
      if (!problemStr.trim()) {
        throw new Error(
          'A non-empty problem description is required for the second-opinion tool.'
        );
      }

      // ── Step 1: Independent solve ──────────────────────────────────────────
      // ANTI-ANCHORING: buildSolvePrompt only receives the problem. The
      // ownAnswer value is not accessible to this call site at all.
      const solvePrompt = buildSolvePrompt(problemStr);

      Logger.debug('second-opinion: requesting independent solution');
      onProgress?.(STATUS_MESSAGES.PROCESSING_START);

      const independentAnswer = await executor(
        solvePrompt,
        model as string | undefined,
        false,
        false,
        onProgress
      );

      // ── Step 2: Optional divergence comparison ─────────────────────────────
      let comparison: string | undefined;

      const ownAnswerStr = typeof ownAnswer === 'string' ? ownAnswer : undefined;

      if (ownAnswerStr && compare) {
        Logger.debug('second-opinion: performing divergence comparison');
        onProgress?.('Comparing answers for points of divergence...');

        const comparePrompt = buildComparePrompt(
          problemStr,
          ownAnswerStr,
          independentAnswer
        );

        comparison = await executor(
          comparePrompt,
          model as string | undefined,
          false,
          false,
          onProgress
        );
      }

      return formatResult({ independentAnswer, comparison });
    },
  };
}

/**
 * The production tool instance registered in the tool registry.
 * Uses the real executeGeminiCLI executor.
 */
export const secondOpinionTool: UnifiedTool = createSecondOpinionTool();
