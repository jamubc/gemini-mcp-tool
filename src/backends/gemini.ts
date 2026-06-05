import { executeGeminiCLI } from "../utils/geminiExecutor.js";
import type { Backend, BackendRunOptions } from "./types.js";

/**
 * Default backend: the Google Gemini CLI (`gemini`). It inlines `@file`
 * references itself, honours `-m/--model`, and implements the Pro->Flash quota
 * fallback inside executeGeminiCLI. Retired 2026-06-18 for free/Pro/Ultra tiers
 * (see docs/migration/antigravity-cli.md), hence the pluggable seam.
 */
export const geminiBackend: Backend = {
  name: "gemini",
  supportsModelSelection: true,
  sandboxIsolatesToolExecution: true,
  run(prompt: string, opts: BackendRunOptions): Promise<string> {
    return executeGeminiCLI(
      prompt,
      opts.model,
      !!opts.sandbox,
      !!opts.changeMode,
      opts.onProgress,
    );
  },
};
