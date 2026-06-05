import { Logger } from "../utils/logger.js";
import { CLI, APPROVAL_MODES } from "../constants.js";
import { executeCommand } from "../utils/commandExecutor.js";
import {
  buildChangeModePrompt,
  inlineFileReferences,
} from "../utils/geminiExecutor.js";
import {
  conversationIdForCwd,
  newestConversationSince,
  readTranscriptResponse,
} from "./agyTranscript.js";
import type { Backend, BackendRunOptions } from "./types.js";

/**
 * EXPERIMENTAL Antigravity CLI (`agy`) backend — opt in with GEMINI_MCP_BACKEND=agy.
 *
 * agy is gemini-cli's successor (Gemini CLI retires 2026-06-18 for free/Pro/Ultra
 * tiers). The migration analysis behind this lives in
 * docs/migration/antigravity-cli.md. The behaviours that shape this code:
 *  1. `agy -p` is broken in 1.0.x — exit 0, empty stdout. We recover the reply
 *     from agy's transcript on disk (agyTranscript.ts), preferring stdout when a
 *     future agy fixes it (Phase 3).
 *  2. Print-mode is hardcoded to Gemini 3.5 Flash; `--model` is ignored and
 *     hangs if forced. supportsModelSelection is false; we never pass --model.
 *  3. `@file` is not inlined by agy (it's agent-first). We inline files ourselves
 *     so the project-root guard and determinism survive.
 *  4. `--sandbox`/`--dangerously-skip-permissions` do NOT isolate tool execution
 *     in -p. We surface that truthfully instead of implying isolation.
 */

/** Build the prompt agy actually receives: changeMode wrap + self-inlined files. */
export function buildAgyPrompt(prompt: string, opts: BackendRunOptions): string {
  let processed = prompt;
  if (opts.changeMode) {
    processed = buildChangeModePrompt(processed.replace(/file:(\S+)/g, "@$1"));
  }
  // agy doesn't inline @file; do it ourselves (keeps the CVE-2026-0755 guard).
  return inlineFileReferences(processed);
}

export function buildAgyArgs(opts: BackendRunOptions): string[] {
  const args: string[] = [];
  // Sessions: --continue resumes the most recent (global!); --conversation <id>
  // a specific one. Prefer an explicit id whenever we have one.
  if (opts.resume) {
    if (opts.resume === "latest") args.push("--continue");
    else args.push("--conversation", opts.resume);
  } else if (opts.sessionId) {
    args.push("--conversation", opts.sessionId);
  }
  if (opts.sandbox) args.push("--sandbox"); // forwarded, but see sandbox notice
  // agy has no graded approval modes; only "skip all prompts" maps cleanly.
  if (opts.approvalMode === APPROVAL_MODES.YOLO) {
    args.push("--dangerously-skip-permissions");
  }
  // Print mode is hardcoded to Flash — deliberately NO --model (it hangs -p).
  return args;
}

/** The conversation id to read back, if we already know it from the args. */
function explicitConversationId(opts: BackendRunOptions): string | undefined {
  if (opts.resume && opts.resume !== "latest") return opts.resume;
  if (!opts.resume && opts.sessionId) return opts.sessionId;
  return undefined;
}

// Serialize agy calls: each run rewrites last_conversations.json, so concurrent
// runs would read each other's conversation ids back.
let agyQueue: Promise<unknown> = Promise.resolve();

export const agyBackend: Backend = {
  name: "agy",
  supportsModelSelection: false, // print-mode is hardcoded to Gemini 3.5 Flash
  sandboxIsolatesToolExecution: false, // -p runs tools with user privileges
  run(prompt: string, opts: BackendRunOptions): Promise<string> {
    const task = agyQueue.then(async () => {
      Logger.warn(
        "[experimental] agy backend: print-mode is Flash-only and recovers output from transcript files.",
      );

      const cwd = process.cwd();
      const startMs = Date.now();
      const finalPrompt = buildAgyPrompt(prompt, opts);
      const args = [...buildAgyArgs(opts), "-p", finalPrompt];

      const stdout = await executeCommand(CLI.COMMANDS.AGY, args, opts.onProgress);
      if (stdout && stdout.trim()) return stdout.trim(); // Phase 3: future agy may fix -p

      // Recover from the transcript: prefer an id we set, else discover it.
      const id =
        explicitConversationId(opts) ??
        conversationIdForCwd(cwd) ??
        newestConversationSince(startMs);
      if (!id) {
        throw new Error(
          `agy: produced no stdout and no conversation id was found for ${cwd}. ` +
            "Run `agy -i` once to authenticate, then retry.",
        );
      }
      return readTranscriptResponse(id);
    });
    // Keep the chain alive regardless of this call's outcome.
    agyQueue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  },
};
