import { ENV, MODELS } from "../constants.js";
import { Logger } from "../utils/logger.js";
import type { Backend, BackendRunOptions } from "./types.js";
import { geminiBackend } from "./gemini.js";
import { agyBackend } from "./agy.js";

export type { Backend, BackendRunOptions } from "./types.js";
export { geminiBackend } from "./gemini.js";
export { agyBackend } from "./agy.js";

/**
 * The default backend name. Stays "gemini" until the 2026-06-18 retirement —
 * flipping the migration's final switch (Phase 4) is a one-line change here.
 */
export const DEFAULT_BACKEND = "gemini";

/**
 * Select the active backend from GEMINI_MCP_BACKEND. Defaults to the Gemini CLI;
 * "agy"/"antigravity" selects the experimental Antigravity CLI backend.
 */
export function getBackend(env: NodeJS.ProcessEnv = process.env): Backend {
  const name = (env[ENV.BACKEND] || DEFAULT_BACKEND).trim().toLowerCase();
  switch (name) {
    case "agy":
    case "antigravity":
      return agyBackend;
    case "gemini":
    case "":
      return geminiBackend;
    default:
      Logger.warn(`Unknown ${ENV.BACKEND}="${name}", falling back to ${DEFAULT_BACKEND}.`);
      return geminiBackend;
  }
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
  const backend = getBackend();
  const notices: string[] = [];
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
