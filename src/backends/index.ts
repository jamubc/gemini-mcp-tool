import { ENV } from "../constants.js";
import type { Backend } from "./types.js";
import { geminiBackend } from "./gemini.js";
import { agyBackend } from "./agy.js";

export type { Backend, BackendRunOptions } from "./types.js";
export { geminiBackend } from "./gemini.js";
export { agyBackend } from "./agy.js";

/**
 * Select the active backend from GEMINI_MCP_BACKEND. Defaults to the Gemini CLI;
 * "agy"/"antigravity" selects the experimental Antigravity CLI backend.
 */
export function getBackend(env: NodeJS.ProcessEnv = process.env): Backend {
  const name = (env[ENV.BACKEND] || "gemini").trim().toLowerCase();
  switch (name) {
    case "agy":
    case "antigravity":
      return agyBackend;
    case "gemini":
    case "":
      return geminiBackend;
    default:
      return geminiBackend;
  }
}
