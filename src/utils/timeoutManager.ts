import { ENV } from "../constants.js";

// Suggested value if you choose to enable the safety timeout. This is NOT applied
// automatically — see resolveTimeoutMs below. 30 minutes is deliberately generous:
// large-codebase analyses can legitimately run for many minutes, so it exists to
// release a genuinely hung child, not to cap normal work.
export const RECOMMENDED_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Resolve the per-command timeout in milliseconds from the environment.
 *
 * Parity with 1.1.6: there is NO timeout by default. The MCP server historically
 * waited indefinitely for the child CLI, so when GEMINI_MCP_TIMEOUT_MS is unset or
 * blank we return 0 (disabled) to preserve that behaviour exactly. The timeout is
 * strictly opt-in: a positive value enables it; 0, negative, or non-numeric values
 * also disable it (return 0).
 */
export function resolveTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env[ENV.TIMEOUT_MS];
  if (raw === undefined || raw.trim() === "") return 0; // disabled (1.1.6 parity)
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0; // disabled / invalid
  return parsed;
}
