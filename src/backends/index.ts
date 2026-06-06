import { ENV, MODELS, RETIREMENT } from "../constants.js";
import { Logger } from "../utils/logger.js";
import type { Backend, BackendRunOptions } from "./types.js";
import { geminiBackend } from "./gemini.js";
import { agyBackend } from "./agy.js";

export type { Backend, BackendRunOptions } from "./types.js";
export { geminiBackend } from "./gemini.js";
export { agyBackend } from "./agy.js";

/** Pre-retirement default backend name. */
export const DEFAULT_BACKEND = "gemini";

const RETIREMENT_MS = Date.parse(`${RETIREMENT.GEMINI_CLI_ISO}T00:00:00Z`);
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The default backend, resolved against the calendar (Phase 4 cutover): the
 * Gemini CLI until it is retired on 2026-06-18, then `agy` automatically — because
 * once gemini is gone, agy is the only live option. An explicit GEMINI_MCP_BACKEND
 * always overrides this. `now` is injectable for tests.
 */
export function resolveDefaultBackend(now: Date = new Date()): "gemini" | "agy" {
  return now.getTime() >= RETIREMENT_MS ? "agy" : "gemini";
}

/**
 * Select the active backend. GEMINI_MCP_BACKEND wins ("agy"/"antigravity" →
 * Antigravity CLI, "gemini" → Gemini CLI); otherwise the date-aware default.
 */
export function getBackend(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): Backend {
  const explicit = (env[ENV.BACKEND] || "").trim().toLowerCase();
  const name = explicit || resolveDefaultBackend(now);
  switch (name) {
    case "agy":
    case "antigravity":
      return agyBackend;
    case "gemini":
      return geminiBackend;
    default:
      Logger.warn(`Unknown ${ENV.BACKEND}="${name}", falling back to gemini.`);
      return geminiBackend;
  }
}

// The approaching-retirement nudge is shown once per process, not on every call.
let retirementNudged = false;

/**
 * Resolve the backend and any migration notices to surface to the caller:
 *  - post-retirement, when the default has auto-flipped to agy;
 *  - in the final countdown, a one-time nudge to test agy early.
 * Both are suppressed when GEMINI_MCP_BACKEND is set explicitly.
 */
export function backendSelection(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): { backend: Backend; notices: string[] } {
  const backend = getBackend(env, now);
  const notices: string[] = [];
  const explicit = (env[ENV.BACKEND] || "").trim();

  if (!explicit) {
    const daysLeft = Math.ceil((RETIREMENT_MS - now.getTime()) / DAY_MS);
    if (backend.name === "agy") {
      notices.push(
        `Gemini CLI was retired on ${RETIREMENT.GEMINI_CLI_ISO}; defaulting to the Antigravity CLI (agy) backend. Set ${ENV.BACKEND}=gemini to override.`,
      );
    } else if (daysLeft <= RETIREMENT.WARN_WITHIN_DAYS && !retirementNudged) {
      retirementNudged = true;
      notices.push(
        `Gemini CLI retires on ${RETIREMENT.GEMINI_CLI_ISO} (~${daysLeft} day(s) left); test the successor now with ${ENV.BACKEND}=agy.`,
      );
    }
  }
  return { backend, notices };
}

/** Test seam: reset the once-per-process retirement nudge. */
export function __resetRetirementNudgeForTest(): void {
  retirementNudged = false;
}

/**
 * Run a prompt through the active backend, applying capability gating so the
 * caller never gets a silent behaviour change:
 *  - if the backend can't honour `model`, the model is dropped and a notice
 *    explains it (agy print-mode is Flash-only);
 *  - if the backend can't isolate tool execution, a requested `sandbox` yields a
 *    notice rather than a false sense of safety.
 * Notices are returned alongside the text for the tool layer to surface.
 */
export async function runWithBackend(
  prompt: string,
  opts: BackendRunOptions,
): Promise<{ text: string; notices: string[]; backend: string }> {
  const { backend, notices } = backendSelection();
  const effective: BackendRunOptions = { ...opts, onNotice: (m) => notices.push(m) };

  if (effective.model && !backend.supportsModelSelection) {
    notices.push(
      `Backend "${backend.name}" ignores model selection (print-mode is ${MODELS.AGY_PRINT_DEFAULT}-only); "${effective.model}" was not applied.`,
    );
    effective.model = undefined; // and skip the gemini-only quota fallback path
  }
  if (effective.sandbox && !backend.sandboxIsolatesToolExecution) {
    notices.push(
      `Backend "${backend.name}" does not isolate tool execution in headless mode; the sandbox request cannot be guaranteed.`,
    );
  }

  const text = await backend.run(prompt, effective);
  return { text, notices, backend: backend.name };
}

/** Prepend any capability notices to a response so changes are never silent. */
export function withNotices(notices: string[], body: string): string {
  if (!notices.length) return body;
  return notices.map((n) => `⚠️ ${n}`).join("\n") + "\n\n" + body;
}
