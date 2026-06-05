/**
 * warm-analyze.tool.ts
 *
 * The `warm-analyze` tool tracks a baseline repository snapshot and, on
 * subsequent calls, sends only the incremental git diff instead of shipping the
 * entire workspace to Gemini.  This dramatically reduces token usage and
 * latency for iterative review sessions.
 *
 * Behaviour:
 *   - No baseline / reset flag  → record the current HEAD as the baseline, then
 *     run Gemini over the full workspace (same as ask-gemini).
 *   - Baseline exists + delta fits in budget  → embed the diff in the prompt and
 *     run Gemini with that focused context ("delta" mode).
 *   - Baseline exists but delta is too large or base ref unreachable  → fall back
 *     to full-workspace mode, note it in the response, and update the baseline.
 */
import { z } from "zod";
import { spawnSync } from "child_process";
import { UnifiedTool } from "./registry.js";
import { executeGeminiCLI } from "../utils/geminiExecutor.js";
import { computeDelta, decideMode, makeDefaultGitRunner } from "../utils/repoDelta.js";
import { getBaseline, setBaseline } from "../utils/residencyState.js";
import { Logger } from "../utils/logger.js";
import { GEMINI_MCP_MAX_DELTA_BYTES } from "../constants.js";
import { STATUS_MESSAGES } from "../constants.js";

// ─── Schema ──────────────────────────────────────────────────────────────────

const warmAnalyzeArgsSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .describe(
      "Question or analysis request. On delta passes this is applied to the changed files only."
    ),
  reset: z
    .boolean()
    .optional()
    .describe(
      "Force a baseline reset: treat this call as the initial full-workspace analysis and record a new baseline."
    ),
  model: z
    .string()
    .optional()
    .describe(
      "Optional Gemini model to use (e.g. 'gemini-2.5-flash'). Defaults to gemini-2.5-pro."
    ),
});

// ─── Helper: resolve current HEAD safely ─────────────────────────────────────

function resolveHead(): string | null {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0 || result.error) return null;
  return (result.stdout ?? "").trim() || null;
}

/** Returns true when `ref` names a commit reachable in the local history. */
function isRefReachable(ref: string): boolean {
  const result = spawnSync("git", ["cat-file", "-e", `${ref}^{commit}`], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
  });
  return result.status === 0 && !result.error;
}

/** Read the configured max-delta budget (env override or 200 000 bytes). */
function maxDeltaBytes(): number {
  const raw = process.env[GEMINI_MCP_MAX_DELTA_BYTES];
  if (raw) {
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return 200_000;
}

// ─── Prompt builders ─────────────────────────────────────────────────────────

export function buildDeltaPrompt(opts: {
  userPrompt: string;
  baseRef: string;
  headRef: string;
  changedFiles: string[];
  diff: string;
  truncated: boolean;
}): string {
  const { userPrompt, baseRef, headRef, changedFiles, diff, truncated } = opts;

  const fileList =
    changedFiles.length > 0
      ? changedFiles.map((f) => `  - ${f}`).join("\n")
      : "  (no committed file changes; working-tree modifications may apply)";

  const truncationNote = truncated
    ? "\n> **Note:** The diff was truncated at the configured byte limit. Some changes may not be shown."
    : "";

  return `# Incremental Analysis (warm-residency delta pass)

## Changed files since baseline (\`${baseRef.slice(0, 8)}\` → \`${headRef.slice(0, 8)}\`)
${fileList}
${truncationNote}

## Git diff
\`\`\`diff
${diff}
\`\`\`

## User request
${userPrompt}`;
}

// ─── Tool definition ──────────────────────────────────────────────────────────

export const warmAnalyzeTool: UnifiedTool = {
  name: "warm-analyze",
  description:
    "Incremental repository analysis using git-delta warm residency. " +
    "The first call (or any call with reset:true) records a baseline and runs a " +
    "full-workspace analysis. Subsequent calls send only the diff since the " +
    "baseline, dramatically reducing token usage for iterative review sessions.",
  zodSchema: warmAnalyzeArgsSchema,
  prompt: {
    description:
      "Analyse repository changes incrementally using warm residency. Sends a full " +
      "workspace on the first call and only the git diff on follow-up calls.",
  },
  category: "gemini",

  execute: async (args, onProgress) => {
    const { prompt, reset, model } = args;

    if (!prompt?.trim()) {
      throw new Error(
        "Please provide a prompt for analysis. Use warm-analyze with a question about the codebase."
      );
    }

    const currentHead = resolveHead();
    if (!currentHead) {
      return "❌ warm-analyze requires a git repository. No HEAD commit was found in the working directory.";
    }

    const maxBytes = maxDeltaBytes();

    // ── Decide whether to run a baseline (full) pass or a delta pass ──────────

    const stored = getBaseline();
    const forceReset = !!reset;

    if (!stored || forceReset) {
      // ── Baseline pass ─────────────────────────────────────────────────────
      Logger.debug(
        `warm-analyze: ${forceReset ? "reset requested" : "no baseline"} → baseline pass`
      );
      setBaseline(currentHead);

      const note = forceReset
        ? "\n\n> **warm-analyze:** Baseline reset. This is a full-workspace analysis; subsequent calls will use incremental diffs."
        : "\n\n> **warm-analyze:** Initial baseline recorded. Subsequent calls will use incremental diffs.";

      onProgress?.(STATUS_MESSAGES.PROCESSING_START);
      const result = await executeGeminiCLI(
        prompt as string,
        model as string | undefined,
        false,
        false,
        onProgress
      );
      return `${STATUS_MESSAGES.GEMINI_RESPONSE}\n${result}${note}`;
    }

    // ── Delta pass ────────────────────────────────────────────────────────────
    const { baseSha } = stored;
    const baseReachable = isRefReachable(baseSha);

    let mode: "delta" | "full";
    let deltaResult: ReturnType<typeof computeDelta> | null = null;

    if (!baseReachable) {
      Logger.debug(`warm-analyze: base ref ${baseSha} unreachable → full fallback`);
      mode = "full";
    } else {
      try {
        const run = makeDefaultGitRunner(process.cwd());
        deltaResult = computeDelta(baseSha, { run, maxBytes });
        mode = decideMode({
          hasBaseline: true,
          deltaBytes: Buffer.byteLength(deltaResult.diff, "utf8"),
          maxBytes,
          baseReachable: true,
        });
      } catch (err) {
        Logger.error(
          `warm-analyze: computeDelta failed: ${err instanceof Error ? err.message : String(err)}`
        );
        mode = "full";
      }
    }

    if (mode === "delta" && deltaResult) {
      // ── Incremental delta mode ───────────────────────────────────────────
      Logger.debug(
        `warm-analyze: delta mode — ${deltaResult.changedFiles.length} changed files`
      );
      const deltaPrompt = buildDeltaPrompt({
        userPrompt: prompt as string,
        baseRef: deltaResult.baseRef,
        headRef: deltaResult.headRef,
        changedFiles: deltaResult.changedFiles,
        diff: deltaResult.diff,
        truncated: deltaResult.truncated,
      });

      onProgress?.("Sending incremental diff to Gemini...");
      const result = await executeGeminiCLI(
        deltaPrompt,
        model as string | undefined,
        false,
        false,
        onProgress
      );
      return `${STATUS_MESSAGES.GEMINI_RESPONSE}\n${result}`;
    }

    // ── Full fallback ─────────────────────────────────────────────────────────
    Logger.debug("warm-analyze: full fallback — updating baseline");
    setBaseline(currentHead);

    const fallbackNote =
      "\n\n> **warm-analyze:** Delta was too large or the baseline was unreachable. " +
      "Ran a full-workspace analysis and recorded a new baseline.";

    onProgress?.(STATUS_MESSAGES.PROCESSING_START);
    const result = await executeGeminiCLI(
      prompt as string,
      model as string | undefined,
      false,
      false,
      onProgress
    );
    return `${STATUS_MESSAGES.GEMINI_RESPONSE}\n${result}${fallbackNote}`;
  },
};
