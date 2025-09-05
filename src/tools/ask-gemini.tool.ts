import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { executeGeminiCLI, processChangeModeOutput } from '../utils/geminiExecutor.js';
import {
  ERROR_MESSAGES,
  STATUS_MESSAGES
} from '../constants.js';
import { selectChunkIndexSchema } from '../utils/schema-strategies.js';

const askGeminiArgsSchema = z.object({
  prompt: z.string().min(1).describe("Analysis request. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions"),
  model: z.string().optional().describe("Optional model to use (e.g., 'gemini-2.5-flash'). If not specified, uses the default model (gemini-2.5-pro)."),
  sandbox: z.boolean().default(false).describe("Use sandbox mode (-s flag) to safely test code changes, execute scripts, or run potentially risky operations in an isolated environment"),
  changeMode: z.boolean().default(false).describe("Enable structured change mode - formats prompts to prevent tool errors and returns structured edit suggestions that Claude can apply directly"),
  chunkIndex: selectChunkIndexSchema({
    standard: z.union([z.number(), z.string()]).optional().describe("Which chunk to return (1-based)"),
    gemini: z.preprocess(
      (val) => (val === undefined || val === null ? val : String(val)),
      z.string().optional()
    ).describe("Which chunk to return (1-based)"),
  }),
  chunkCacheKey: z.string().optional().describe("Optional cache key for continuation"),
});

export const askGeminiTool: UnifiedTool = {
  name: "ask-gemini",
  description: "model selection [-m], sandbox [-s], and changeMode:boolean for providing edits",
  zodSchema: askGeminiArgsSchema,
  prompt: {
    description: "Execute 'gemini -p <prompt>' to get Gemini AI's response. Supports enhanced change mode for structured edit suggestions.",
  },
  category: 'gemini',
  execute: async (args, onProgress) => {
    const { prompt, model, sandbox, changeMode, chunkIndex, chunkCacheKey } = args;
    if (!prompt?.trim()) {
      throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    }

    // Helper function to safely parse chunkIndex to a number.
    // This is necessary because the model may provide a string or number,
    // and internal logic requires a number.
    const parseChunkIndex = (index: unknown): number | undefined => {
      if (index === undefined || index === null) return undefined;
      const num = parseInt(String(index), 10);
      return isNaN(num) ? undefined : num;
    };

    const chunkIndexNum = parseChunkIndex(chunkIndex);

    if (changeMode && chunkIndexNum !== undefined && chunkCacheKey) {
      return processChangeModeOutput(
        '', // empty for cache...
        chunkIndexNum,
        chunkCacheKey as string,
        prompt as string
      );
    }

    const result = await executeGeminiCLI(
      prompt as string,
      model as string | undefined,
      !!sandbox,
      !!changeMode,
      onProgress
    );

    if (changeMode) {
      return processChangeModeOutput(
        result,
        chunkIndexNum,
        undefined,
        prompt as string
      );
    }
    return `${STATUS_MESSAGES.GEMINI_RESPONSE}\n${result}`; // changeMode false
  }
};
