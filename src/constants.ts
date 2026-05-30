

// Logging
export const LOG_PREFIX = "[GMCPT]";

// Error messages
export const ERROR_MESSAGES = {
  QUOTA_EXCEEDED: "Quota exceeded for quota metric 'Gemini 2.5 Pro Requests'",
  QUOTA_EXCEEDED_SHORT: "⚠️ Gemini 2.5 Pro daily quota exceeded. Please retry with model: 'gemini-2.5-flash'",
  TOOL_NOT_FOUND: "not found in registry",
  NO_PROMPT_PROVIDED: "Please provide a prompt for analysis. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions",
} as const;

// Status messages
export const STATUS_MESSAGES = {
  QUOTA_SWITCHING: "🚫 Gemini 2.5 Pro quota exceeded, switching to Flash model...",
  FLASH_RETRY: "⚡ Retrying with Gemini 2.5 Flash...",
  FLASH_SUCCESS: "✅ Flash model completed successfully",
  SANDBOX_EXECUTING: "🔒 Executing Gemini CLI command in sandbox mode...",
  GEMINI_RESPONSE: "Gemini response:",
  // Timeout prevention messages
  PROCESSING_START: "🔍 Starting analysis (may take 5-15 minutes for large codebases)",
  PROCESSING_CONTINUE: "⏳ Still processing... Gemini is working on your request",
  PROCESSING_COMPLETE: "✅ Analysis completed successfully",
} as const;

// Models
export const MODELS = {
  PRO: "gemini-2.5-pro",
  FLASH: "gemini-2.5-flash",
} as const;

// MCP Protocol Constants
export const PROTOCOL = {
  // Message roles
  ROLES: {
    USER: "user",
    ASSISTANT: "assistant",
  },
  // Content types
  CONTENT_TYPES: {
    TEXT: "text",
  },
  // Status codes
  STATUS: {
    SUCCESS: "success",
    ERROR: "error",
    FAILED: "failed",
    REPORT: "report",
  },
  // Notification methods
  NOTIFICATIONS: {
    PROGRESS: "notifications/progress",
  },
  // Timeout prevention
  KEEPALIVE_INTERVAL: 25000, // 25 seconds
} as const;


// CLI Constants
export const CLI = {
  // Command names
  COMMANDS: {
    GEMINI: "gemini",
    AGY: "agy", // Antigravity CLI — experimental backend (gemini-cli's successor)
    ECHO: "echo",
  },
  // Command flags (Gemini CLI)
  FLAGS: {
    MODEL: "-m",
    SANDBOX: "-s",
    PROMPT: "-p",
    HELP: "--help", // was "-help" — yargs parsed that as -h -e -l -p (the help bug)
    APPROVAL_MODE: "--approval-mode",
    SESSION_ID: "--session-id",
    RESUME: "--resume",
  },
  // Default values
  DEFAULTS: {
    MODEL: "default", // Fallback model used when no specific model is provided
    BOOLEAN_TRUE: "true",
    BOOLEAN_FALSE: "false",
  },
} as const;

// Gemini CLI approval modes (`gemini --approval-mode <mode>`, confirmed in v0.43).
// Opt-in only — when unset, no mode is forced (preserves plain Q&A behaviour).
// plan = autonomous read-only planner · auto_edit = auto-approve edit tools ·
// yolo = auto-approve all tools.
export const APPROVAL_MODES = {
  DEFAULT: "default",
  AUTO_EDIT: "auto_edit",
  YOLO: "yolo",
  PLAN: "plan",
} as const;
export type ApprovalMode = (typeof APPROVAL_MODES)[keyof typeof APPROVAL_MODES];

// Environment variables that configure the server.
export const ENV = {
  BACKEND: "GEMINI_MCP_BACKEND", // "gemini" (default) | "agy"
  APPROVAL_MODE: "GEMINI_MCP_APPROVAL_MODE", // overridden per-call by the approvalMode arg
  GEMINI_CLI_PATH: "GEMINI_CLI_PATH", // explicit path to the gemini executable (Windows shim resolution)
  TIMEOUT_MS: "GEMINI_MCP_TIMEOUT_MS", // per-call command timeout in milliseconds
} as const;


// (merged PromptArguments and ToolArguments)
export interface ToolArguments {
  prompt?: string;
  model?: string;
  sandbox?: boolean | string;
  changeMode?: boolean | string;
  chunkIndex?: number | string; // Which chunk to return (1-based)
  chunkCacheKey?: string; // Optional cache key for continuation
  approvalMode?: string; // Gemini approval mode: default | auto_edit | yolo | plan
  sessionId?: string; // Start/identify a session (gemini --session-id, agy --conversation)
  resume?: string; // Resume a prior session id or "latest" (gemini --resume, agy --continue)
  message?: string; // For Ping tool -- Un-used.
  
  // --> new tool
  methodology?: string; // Brainstorming framework to use
  domain?: string; // Domain context for specialized brainstorming
  constraints?: string; // Known limitations or requirements
  existingContext?: string; // Background information to build upon
  ideaCount?: number; // Target number of ideas to generate
  includeAnalysis?: boolean; // Include feasibility and impact analysis
  
  [key: string]: string | boolean | number | undefined; // Allow additional properties
}