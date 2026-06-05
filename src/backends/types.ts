import type { ApprovalMode } from "../constants.js";

/**
 * Options a backend understands. Backends interpret these in their own terms
 * (e.g. the gemini backend maps `resume` to `--resume`, the agy backend to
 * `--conversation`/`--continue`); unsupported options are ignored.
 */
export interface BackendRunOptions {
  model?: string;
  sandbox?: boolean;
  changeMode?: boolean;
  approvalMode?: ApprovalMode;
  sessionId?: string;
  resume?: string;
  onProgress?: (newOutput: string) => void;
  /**
   * Sink for human-facing notices the backend wants surfaced to the caller —
   * e.g. "this backend is Flash-only" or "print-mode agy does not sandbox".
   * The tool layer prepends these to the response so behavior changes are never
   * silent. Backends should call it; the tool layer supplies it.
   */
  onNotice?: (message: string) => void;
}

/** A pluggable CLI backend that turns a prompt into model output. */
export interface Backend {
  readonly name: string;
  /** Whether `model` selection is honoured (agy print-mode is Flash-only). */
  readonly supportsModelSelection: boolean;
  /** Whether tool execution is actually isolated when `sandbox` is requested. */
  readonly sandboxIsolatesToolExecution: boolean;
  run(prompt: string, options: BackendRunOptions): Promise<string>;
}
