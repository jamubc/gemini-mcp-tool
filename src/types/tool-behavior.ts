// Type definitions for tool behavior and structured responses

// Declarative behavioural metadata describing what side-effects a tool may have.
// This is orthogonal to presentation‐level flags like `should_explain`.
export interface ToolBehavior {
  /**
   * True if calling the tool twice with the same input never changes system state and  
   * always produces the same output (aside from timing information).
   */
  idempotent: boolean;

  /**
   * Whether the tool touches the local filesystem.
   * "relative" ⇒ reads files only inside the current workspace.  
   * "absolute" ⇒ may read arbitrary paths.
   */
  readsFilesystem: "none" | "relative" | "absolute";

  /** If the tool writes / mutates the filesystem. */
  writesFilesystem: boolean;

  /** Network access characteristics. */
  network: "none" | "outbound" | "bidirectional";

  // Presentation behaviour retained for backward compatibility ------------------
  should_explain?: boolean;
  output_format?: "raw" | "formatted";
  context_needed?: boolean;
  suppress_context?: boolean;
}

export interface StructuredToolResponse {
  /** Raw output from the tool */
  tool_output: string;
  /** Optional human-facing notifications that SHOULD NOT be forwarded to the LLM. */
  notifications?: string[];
  /** Optional metadata block consumed by the proxy layer */
  metadata?: {
    status: string;
    timing?: number;
    execution_details?: string;
  };
  /** Behavioural flags that _are_ forwarded to the LLM */
  behavior: ToolBehavior;
}

export interface EditSuggestion {
  file: string;
  change: string;
  old: string;
  new: string;
}