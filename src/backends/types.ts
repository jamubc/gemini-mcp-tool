import type { ApprovalMode } from "../constants.js";

/**
 * Options a backend understands. Backends interpret these in their own terms
 * (e.g. the gemini backend maps `resume` to `--resume`, the agy backend to
 * `--conversation`/`--continue`); unsupported options are ignored.
 */
export interface BackendRunOptions {
  model?: string;
  sandbox?: boolean;
  approvalMode?: ApprovalMode;
  sessionId?: string;
  resume?: string;
  /**
   * Deliver the prompt on stdin rather than as a flag argument. Used for
   * changeMode / `@file` prompts to dodge cmd.exe parsing and the OS
   * command-line length limit.
   */
  useStdin?: boolean;
  onProgress?: (newOutput: string) => void;
}

/** A pluggable CLI backend that turns a prompt into model output. */
export interface Backend {
  readonly name: string;
  /** Whether `model` selection is honoured (agy print-mode is Flash-only). */
  readonly supportsModelSelection: boolean;
  run(prompt: string, options: BackendRunOptions): Promise<string>;
}
