import * as path from 'node:path';
import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { executeGeminiCLI } from '../utils/geminiExecutor.js';
import { collectFiles, planShards, Shard } from '../utils/sharding.js';
import { mapReduce } from '../utils/mapReduce.js';
import { Logger } from '../utils/logger.js';
import {
  ENV,
  ERROR_MESSAGES,
  STATUS_MESSAGES,
} from '../constants.js';

/** Hard limit on the number of shards to prevent runaway API costs. */
const MAX_SHARDS = 50;

/** Default shard size if not specified by the caller. */
const DEFAULT_SHARD_BYTES = 800_000;

/** Clamp the requested concurrency to a safe range. */
function clampConcurrency(raw: number): number {
  return Math.max(1, Math.min(10, raw));
}

/** Read the default concurrency from the environment, falling back to 4. */
function defaultConcurrency(): number {
  const raw = process.env[ENV.GEMINI_MCP_MAP_CONCURRENCY];
  if (!raw) return 4;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? clampConcurrency(parsed) : 4;
}

/**
 * Build the per-shard prompt that asks Gemini to analyze the files in one shard.
 * File paths are referenced with the `@` syntax so the Gemini CLI inlines them.
 */
function buildMapPrompt(userPrompt: string, shard: Shard, shardIndex: number, totalShards: number): string {
  const fileRefs = shard.files.map((f) => `@${f.path}`).join(' ');
  return (
    `[Shard ${shardIndex + 1} of ${totalShards}]\n` +
    `Analyze the following files and answer this question as it applies to them:\n\n` +
    `${userPrompt}\n\n` +
    `Files in this shard:\n${fileRefs}`
  );
}

/**
 * Build the reduce prompt that asks Gemini to synthesize the per-shard answers.
 */
function buildReducePrompt(userPrompt: string, shardAnswers: string[]): string {
  const answersBlock = shardAnswers
    .map((ans, i) => `--- Shard ${i + 1} answer ---\n${ans}`)
    .join('\n\n');

  return (
    `You have received partial analysis results from ${shardAnswers.length} ` +
    `independent code shards. Synthesize them into a single, coherent answer ` +
    `to the original question:\n\n` +
    `ORIGINAL QUESTION:\n${userPrompt}\n\n` +
    `SHARD ANSWERS:\n${answersBlock}\n\n` +
    `Provide a unified, comprehensive answer that integrates all findings.`
  );
}

const mapReduceAnalyzeSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .describe(
      'Analysis question or instruction to apply across the entire workspace ' +
      '(e.g. "Find all security vulnerabilities" or "Summarize the architecture").',
    ),
  paths: z
    .string()
    .optional()
    .default('.')
    .describe(
      'Workspace root to analyze, relative to the project directory (default: ".").',
    ),
  concurrency: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      `Maximum number of parallel Gemini calls (1–10, default ${defaultConcurrency()}). ` +
      `Overrides ${ENV.GEMINI_MCP_MAP_CONCURRENCY}.`,
    ),
  shardBytes: z
    .number()
    .int()
    .positive()
    .optional()
    .default(DEFAULT_SHARD_BYTES)
    .describe(
      `Target bytes per shard (default ${DEFAULT_SHARD_BYTES}). Larger values ` +
      `produce fewer, bigger shards and fewer Gemini calls.`,
    ),
});

export const mapReduceAnalyzeTool: UnifiedTool = {
  name: 'map-reduce-analyze',
  description:
    'Analyze a large workspace by sharding it into manageable pieces, running ' +
    'Gemini on each shard in parallel, then synthesizing the results into one ' +
    'coherent answer. Use this when the codebase is too large for a single context.',
  zodSchema: mapReduceAnalyzeSchema,
  category: 'gemini',
  prompt: {
    description:
      'Run a map-reduce analysis across sharded workspace files using Gemini.',
  },

  execute: async (args, onProgress) => {
    const {
      prompt,
      paths: rawPaths = '.',
      concurrency: rawConcurrency,
      shardBytes = DEFAULT_SHARD_BYTES,
    } = args;

    const concurrency = clampConcurrency(
      rawConcurrency != null ? (rawConcurrency as number) : defaultConcurrency(),
    );

    // ---- Confine the search root to process.cwd() ----
    const cwd = process.cwd();
    const resolvedRoot = path.resolve(cwd, rawPaths as string);
    const normalizedCwd = path.resolve(cwd);
    const escapesRoot =
      resolvedRoot !== normalizedCwd &&
      !resolvedRoot.startsWith(normalizedCwd + path.sep);

    if (escapesRoot) {
      return (
        `❌ The "paths" argument resolves to "${resolvedRoot}", which is outside ` +
        `the project directory "${normalizedCwd}". Only paths within the project ` +
        `directory are permitted.`
      );
    }

    // ---- Collect files ----
    onProgress?.(`${STATUS_MESSAGES.MAP_REDUCE_SHARDING}: ${resolvedRoot}`);
    Logger.debug(`map-reduce-analyze: collecting files under "${resolvedRoot}"`);

    let files: Array<{ path: string; bytes: number }>;
    try {
      files = collectFiles(resolvedRoot);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `❌ Failed to collect files: ${msg}`;
    }

    if (files.length === 0) {
      return `❌ No files found under "${resolvedRoot}".`;
    }

    // ---- Plan shards ----
    const shards = planShards(files, shardBytes as number);
    Logger.debug(`map-reduce-analyze: ${files.length} files → ${shards.length} shards`);

    if (shards.length > MAX_SHARDS) {
      return (
        `❌ ${ERROR_MESSAGES.MAP_REDUCE_TOO_MANY_SHARDS}\n` +
        `Generated ${shards.length} shards (limit: ${MAX_SHARDS}). ` +
        `Current shardBytes: ${shardBytes}. ` +
        `Try increasing shardBytes to at least ${Math.ceil((shardBytes as number) * (shards.length / MAX_SHARDS))}.`
      );
    }

    onProgress?.(`${STATUS_MESSAGES.MAP_REDUCE_SHARDING}: ${shards.length} shards, concurrency=${concurrency}`);

    // ---- Short-circuit: single shard ----
    if (shards.length === 1) {
      onProgress?.(`Single shard — running direct analysis`);
      const mapPrompt = buildMapPrompt(prompt as string, shards[0], 0, 1);
      const result = await executeGeminiCLI(mapPrompt, undefined, false, false, onProgress);
      return result;
    }

    // ---- Map phase ----
    const shardAnswers: string[] = new Array(shards.length).fill('');

    const { errors } = await mapReduce<Shard, string, void>({
      shards,
      concurrency,
      mapFn: async (shard, i) => {
        onProgress?.(`${STATUS_MESSAGES.MAP_REDUCE_MAPPING} ${i + 1}/${shards.length}`);
        const mapPrompt = buildMapPrompt(prompt as string, shard, i, shards.length);
        const answer = await executeGeminiCLI(mapPrompt, undefined, false, false, onProgress);
        shardAnswers[i] = answer;
        return answer;
      },
      reduceFn: () => {
        /* reduce is handled below after collecting shardAnswers */
      },
    });

    // Report per-shard errors without failing the whole run.
    if (errors.length > 0) {
      for (const e of errors) {
        const msg = e.error instanceof Error ? e.error.message : String(e.error);
        Logger.warn(`map-reduce-analyze: shard ${e.index + 1} failed: ${msg}`);
        shardAnswers[e.index] = `[Shard ${e.index + 1} analysis failed: ${msg}]`;
      }
    }

    // ---- Reduce phase ----
    onProgress?.(STATUS_MESSAGES.MAP_REDUCE_REDUCING);
    const reducePrompt = buildReducePrompt(prompt as string, shardAnswers);
    const synthesis = await executeGeminiCLI(reducePrompt, undefined, false, false, onProgress);

    const errorNote =
      errors.length > 0
        ? `\n\n> **Note:** ${errors.length} shard(s) encountered errors during analysis (shards: ${errors.map((e) => e.index + 1).join(', ')}). Results may be incomplete.`
        : '';

    return `${synthesis}${errorNote}`;
  },
};
