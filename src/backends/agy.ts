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
import { probeAgyCapabilities } from "./agyCapabilities.js";
import { parseAgyJsonResponse, ptyEnabled, runAgyUnderPty } from "./agyOutput.js";
import type { Backend, BackendRunOptions } from "./types.js";

/**
 * EXPERIMENTAL Antigravity CLI (`agy`) backend — opt in with GEMINI_MCP_BACKEND=agy.
 *
 * agy is gemini-cli's successor (Gemini CLI retires 2026-06-18 for free/Pro/Ultra
 * tiers). The migration analysis behind this lives in
 * docs/migration/antigravity-cli.md. The behaviours that shape this code:
 *  1. `agy -p` is broken in 1.0.x — exit 0, empty stdout. Phase 3 makes output
 *     recovery a self-retiring ladder (best → last-resort): clean JSON stdout
 *     when the build advertises `--output-format json`; else plain stdout; else
 *     an opt-in pseudo-terminal run (AGY_MCP_PTY=1) that coaxes a TTY-only build
 *     into printing; else the on-disk transcript (agyTranscript.ts). As agy
 *     improves, capability probing shifts us up the ladder with no code change.
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
      const caps = await probeAgyCapabilities();
      const finalPrompt = buildAgyPrompt(prompt, opts);
      const baseArgs = buildAgyArgs(opts);
      // When the build supports it, ask for JSON so we read a clean answer off
      // stdout instead of scraping the transcript.
      if (caps.outputFormatJson) baseArgs.push("--output-format", "json");
      const args = [...baseArgs, "-p", finalPrompt];

      // 1) Direct stdout — the clean path (JSON when available, else plain text).
      const stdout = await executeCommand(CLI.COMMANDS.AGY, args, opts.onProgress);
      const direct = caps.outputFormatJson
        ? parseAgyJsonResponse(stdout)
        : stdout.trim() || undefined;
      if (direct) return direct;

      // 2) Opt-in PTY recovery: a TTY-only build prints under a pseudo-terminal.
      if (ptyEnabled()) {
        const ptyOut = await runAgyUnderPty(args, opts.onProgress);
        const fromPty = caps.outputFormatJson
          ? parseAgyJsonResponse(ptyOut)
          : ptyOut.trim() || undefined;
        if (fromPty) return fromPty;
      }

      // 3) Transcript recovery: prefer an id we set, else discover it.
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
