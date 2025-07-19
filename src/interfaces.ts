export interface StandardizedResponseSections {
  analysis: string;
  changesSuggested: string;
  nextSteps: string;
}


// ===== ENHANCED TYPES =====

export interface PromptArguments {
  [key: string]: string | boolean | undefined;
  prompt?: string;
  model?: string;
  sandbox?: boolean | string;
  message?: string;
  changeMode?: boolean | string; // NEW: Enable structured change responses
}

export interface ToolArguments {
  prompt?: string;
  model?: string;
  sandbox?: boolean | string;
  changeMode?: boolean | string; // NEW: Enable structured change responses
}

// Structured response interface for robust AI-tool interaction
export interface ToolBehavior {
  should_explain: boolean;
  output_format: "raw" | "formatted";
  context_needed: boolean;
  suppress_context: boolean;
  structured_changes?: boolean; // ???
}

export interface StructuredToolResponse {
  tool_output: string; // What AI should return
  metadata?: {
    // System info (AI ignores)
    status: string;
    timing?: number;
    execution_details?: string;
  };
  behavior: ToolBehavior; // Explicit instructions for AI
}


