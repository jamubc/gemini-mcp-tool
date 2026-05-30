import { readFileSync } from "fs";
import os from "os";
import path from "path";
import { Logger } from "../utils/logger.js";
import { CLI, APPROVAL_MODES } from "../constants.js";
import { executeCommand } from "../utils/commandExecutor.js";
import type { Backend, BackendRunOptions } from "./types.js";

/**
 * EXPERIMENTAL Antigravity CLI (`agy`) backend — opt in with GEMINI_MCP_BACKEND=agy.
 *
 * agy is gemini-cli's successor (Gemini CLI is retired 2026-06-18 for free/Pro/
 * Ultra tiers). Two caveats drive this implementation:
 *  1. Print-mode (`agy -p`) is broken in 1.0.x — it returns exit 0 but writes
 *     nothing to stdout. We therefore recover the reply from agy's own transcript
 *     on disk when stdout is empty (matching the community MCP bridge).
 *  2. Print-mode is hardcoded to Gemini 3.5 Flash; `model` is ignored.
 */

const AGY_BASE = path.join(os.homedir(), ".gemini", "antigravity-cli");
const LAST_CONVERSATIONS = path.join(AGY_BASE, "cache", "last_conversations.json");
const transcriptPath = (id: string) =>
  path.join(AGY_BASE, "brain", id, ".system_generated", "logs", "transcript.jsonl");

interface TranscriptEntry {
  source?: string;
  type?: string;
  status?: string;
  content?: string;
}

/** Map the current workspace directory to its most recent agy conversation id. */
function conversationIdForCwd(cwd: string): string | undefined {
  try {
    const map = JSON.parse(readFileSync(LAST_CONVERSATIONS, "utf8")) as Record<string, string>;
    return map[cwd] ?? map[path.resolve(cwd)];
  } catch (e) {
    Logger.warn(`agy: could not read last_conversations.json: ${(e as Error).message}`);
    return undefined;
  }
}

/** Read the model's reply(s) for a conversation from the transcript on disk. */
export function readTranscriptResponse(id: string): string {
  let lines: string[];
  try {
    lines = readFileSync(transcriptPath(id), "utf8").split(/\r?\n/).filter(Boolean);
  } catch (e) {
    throw new Error(
      `agy: response transcript not found for conversation ${id}: ${(e as Error).message}`,
    );
  }

  const entries: TranscriptEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as TranscriptEntry);
    } catch {
      /* skip malformed lines */
    }
  }

  // Take the model planner responses that follow the last user input.
  let lastUserIdx = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].type === "USER_INPUT") {
      lastUserIdx = i;
      break;
    }
  }
  const replies = entries
    .slice(lastUserIdx + 1)
    .filter(
      (e) =>
        e.source === "MODEL" &&
        e.type === "PLANNER_RESPONSE" &&
        e.status === "DONE" &&
        typeof e.content === "string",
    )
    .map((e) => e.content as string);

  const text = replies.join("\n\n").trim();
  if (!text) {
    throw new Error(`agy: no model response found in transcript for conversation ${id}`);
  }
  return text;
}

export function buildAgyArgs(prompt: string, opts: BackendRunOptions): string[] {
  const args: string[] = [];
  // Sessions: --continue resumes the most recent; --conversation <id> a specific one.
  if (opts.resume) {
    if (opts.resume === "latest") args.push("--continue");
    else args.push("--conversation", opts.resume);
  } else if (opts.sessionId) {
    args.push("--conversation", opts.sessionId);
  }
  if (opts.sandbox) args.push("--sandbox");
  // agy has no graded approval modes; only "skip all prompts" maps cleanly.
  if (opts.approvalMode === APPROVAL_MODES.YOLO) args.push("--dangerously-skip-permissions");
  args.push("-p", prompt);
  return args;
}

// Serialize agy calls: each run rewrites last_conversations.json, so concurrent
// runs would read each other's conversation ids back.
let agyQueue: Promise<unknown> = Promise.resolve();

export const agyBackend: Backend = {
  name: "agy",
  supportsModelSelection: false, // print-mode is hardcoded to Gemini 3.5 Flash
  run(prompt, opts) {
    const task = agyQueue.then(async () => {
      Logger.warn(
        "[experimental] agy backend: print-mode is Flash-only and recovers output from transcript files.",
      );
      const cwd = process.cwd();
      const args = buildAgyArgs(prompt, opts);
      const stdout = await executeCommand(CLI.COMMANDS.AGY, args, opts.onProgress);
      if (stdout && stdout.trim()) return stdout.trim(); // future agy may fix -p stdout

      const id = conversationIdForCwd(cwd);
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
