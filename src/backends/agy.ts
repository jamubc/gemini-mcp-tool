import { Logger } from "../utils/logger.js";
import { CLI, APPROVAL_MODES, ENV } from "../constants.js";
import { executeCommand, COMMAND_TIMEOUT_MS } from "../utils/commandExecutor.js";
import {
  inlineFileReferences,
  prepareChangeModePrompt,
} from "../utils/geminiExecutor.js";
import {
  conversationIdForCwd,
  conversationFreshSince,
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
 *  1. `agy -p` is broken in 1.0.x — exit 0, empty stdout (and sometimes a
 *     non-zero exit). Phase 3 makes output recovery a self-retiring ladder
 *     (best → last-resort): clean JSON stdout when the build advertises
 *     `--output-format json`; else plain stdout; else an opt-in pseudo-terminal
 *     run (AGY_MCP_PTY=1) that coaxes a TTY-only build into printing; else the
 *     on-disk transcript (agyTranscript.ts). A failed print run descends the
 *     ladder rather than aborting. As agy improves, capability probing shifts
 *     us up the ladder with no code change.
 *  2. Print-mode is hardcoded to Gemini 3.5 Flash; `--model` is ignored and
 *     hangs if forced. supportsModelSelection is false; we never pass --model.
 *  3. `@file` is not inlined by agy (it's agent-first). We inline files ourselves
 *     so the project-root guard and determinism survive — and because inlined
 *     prompts carry whole files, they ride on stdin to dodge OS argv limits.
 *  4. `--sandbox`/`--dangerously-skip-permissions` do NOT isolate tool execution
 *     in -p. We surface that truthfully instead of implying isolation.
 */

/** Build the prompt agy actually receives: changeMode wrap + self-inlined files. */
export function buildAgyPrompt(prompt: string, opts: BackendRunOptions): string {
  // Shared changeMode preprocessing with the gemini backend, so the two
  // backends produce the same prompt body for the same request.
  const processed = opts.changeMode ? prepareChangeModePrompt(prompt) : prompt;
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

/** Track agy's --print-timeout (default 5m) to our cap. Override: AGY_PRINT_TIMEOUT. */
export function agyPrintTimeoutArg(): string {
  const override = process.env[ENV.AGY_PRINT_TIMEOUT]?.trim();
  if (override) return override;
  const seconds = Math.max(60, Math.floor(COMMAND_TIMEOUT_MS / 1000) - 60);
  return `${seconds}s`;
}

/** The conversation id to read back, if we already know it from the args. */
function explicitConversationId(opts: BackendRunOptions): string | undefined {
  if (opts.resume && opts.resume !== "latest") return opts.resume;
  if (!opts.resume && opts.sessionId) return opts.sessionId;
  return undefined;
}

/** One raw output channel → the reply, honouring JSON mode; undefined if empty. */
function replyFrom(raw: string, jsonMode: boolean): string | undefined {
  return jsonMode ? parseAgyJsonResponse(raw) : raw.trim() || undefined;
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
      if (caps.printTimeout) baseArgs.push("--print-timeout", agyPrintTimeoutArg());

      // changeMode/@file prompts carry whole inlined files, easily exceeding
      // the OS argv limits — route them via stdin, exactly as the gemini path
      // does (#27, #77). Decide on the ORIGINAL prompt: inlining has already
      // replaced the @ tokens in finalPrompt.
      const useStdin = !!opts.changeMode || prompt.includes("@");
      const argsWithPrompt = [...baseArgs, "-p", finalPrompt];

      // 1) Direct stdout — the clean path (JSON when available, else plain text).
      // A non-zero exit is one of 1.0.x's known print-mode failure modes; the
      // answer may still have landed in the transcript, so a failure here
      // descends the ladder instead of aborting the run.
      let stdout = "";
      let printError: Error | undefined;
      try {
        stdout = useStdin
          ? await executeCommand(CLI.COMMANDS.AGY, baseArgs, opts.onProgress, finalPrompt)
          : await executeCommand(CLI.COMMANDS.AGY, argsWithPrompt, opts.onProgress);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        // Not installed: nothing further down the ladder can succeed.
        if (err.message.includes("Could not find")) throw err;
        Logger.warn(`agy: print-mode failed (${err.message}); trying recovery.`);
        printError = err;
      }
      const direct = replyFrom(stdout, caps.outputFormatJson);
      if (direct) return direct;

      // 2) Opt-in PTY recovery: a TTY-only build prints under a pseudo-terminal.
      // script(1) cannot feed stdin, so the prompt rides in argv here; an
      // over-long argv just fails the spawn and falls through to rung 3.
      if (ptyEnabled()) {
        const ptyOut = await runAgyUnderPty(argsWithPrompt, opts.onProgress);
        const fromPty = replyFrom(ptyOut, caps.outputFormatJson);
        if (fromPty) return fromPty;
      }

      // 3) Transcript recovery. Trust an explicit/cwd conversation only if it was
      // written during this run; a fast agy failure (e.g. dropped auth) must not
      // surface a stale reply from a previous conversation in this cwd.
      const explicitId = explicitConversationId(opts);
      const cwdId = conversationIdForCwd(cwd);
      const id =
        (explicitId && conversationFreshSince(explicitId, startMs) ? explicitId : undefined) ??
        (cwdId && conversationFreshSince(cwdId, startMs) ? cwdId : undefined) ??
        newestConversationSince(startMs);
      if (!id) {
        // agy emitted an error of its own (quota, auth, ...): surface it verbatim.
        if (printError) throw printError;
        // Truly silent: exit 0 with no stdout, stderr, or transcript.
        throw new Error(
          `agy produced no output for ${cwd} (no stdout, stderr, or transcript). ` +
            'Run `agy -p "hi"` directly to check for an expired login or exhausted quota.',
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
