import { ENV } from "../constants.js";

// Default per-command timeout. Large-codebase analyses can legitimately run for
// many minutes (see STATUS_MESSAGES), so this is deliberately generous — it
// exists to release a genuinely hung child process, not to cap normal work.
// Override with GEMINI_MCP_TIMEOUT_MS (milliseconds); set it to 0 to disable.
export const DEFAULT_COMMAND_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Resolve the per-command timeout in milliseconds from the environment, falling
 * back to {@link DEFAULT_COMMAND_TIMEOUT_MS}. A value of 0 — or any negative /
 * non-numeric value — disables the timeout and returns 0.
 */
export function resolveTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env[ENV.TIMEOUT_MS];
  if (raw === undefined || raw.trim() === "") return DEFAULT_COMMAND_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0; // disabled / invalid
  return parsed;
}
