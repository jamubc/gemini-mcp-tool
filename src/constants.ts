

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
  // Antigravity CLI print-mode is hardcoded to Gemini 3.5 Flash (High). This is
  // informational only — `agy -p` ignores `--model` (and hangs if forced).
  AGY_PRINT_DEFAULT: "gemini-3.5-flash",
} as const;

// Approval modes. The Gemini CLI exposes a graded set via --approval-mode; the
// Antigravity CLI only has "skip everything" (--dangerously-skip-permissions),
// and even that is a no-op in print mode. Backends map these in their own terms.
export const APPROVAL_MODES = {
  DEFAULT: "default",
  AUTO_EDIT: "auto_edit",
  YOLO: "yolo",
  PLAN: "plan",
} as const;
export type ApprovalMode = (typeof APPROVAL_MODES)[keyof typeof APPROVAL_MODES];

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
    AGY: "agy", // Antigravity CLI — gemini-cli's successor (retirement: 2026-06-18)
    ECHO: "echo",
  },
  // Command flags
  FLAGS: {
    MODEL: "-m",
    SANDBOX: "-s",
    PROMPT: "-p",
    HELP: "--help", // the external gemini CLI (yargs) splits "-help" into -h -e -l -p; only showed help because -h short-circuits
  },
  // Default values
  DEFAULTS: {
    MODEL: "default", // Fallback model used when no specific model is provided
    BOOLEAN_TRUE: "true",
    BOOLEAN_FALSE: "false",
  },
} as const;


// Environment variables that configure the server.
export const ENV = {
  GEMINI_CLI_PATH: "GEMINI_CLI_PATH", // explicit path to the gemini executable (Windows shim resolution)
  AGY_CLI_PATH: "AGY_CLI_PATH", // explicit path to the agy (Antigravity CLI) executable
  BACKEND: "GEMINI_MCP_BACKEND", // active CLI backend: "gemini" (default) | "agy"/"antigravity"
  AGY_PTY: "AGY_MCP_PTY", // opt-in: recover agy -p stdout via a pseudo-terminal (POSIX only)
  TIMEOUT_MINUTES: "GEMINI_MCP_TIMEOUT", // CLI run timeout in minutes (default 45)
  AGY_PRINT_TIMEOUT: "AGY_PRINT_TIMEOUT", // agy --print-timeout override, e.g. "30m"
} as const;

// Migration milestones. Gemini CLI is retired for free/Pro/Ultra tiers on this
// date; from then on `agy` (Antigravity CLI) is the only live option, so the
// default backend flips to it automatically (Phase 4). Overridable via ENV.BACKEND.
export const RETIREMENT = {
  GEMINI_CLI_ISO: "2026-06-18",
  // Days before retirement at which we start nudging callers to test agy.
  WARN_WITHIN_DAYS: 14,
  // Real migration pointers Google surfaces in the gemini CLI itself.
  AGY_INSTALL_CMD: "curl -fsSL https://antigravity.google/cli/install.sh | bash",
  MIGRATION_URL: "https://goo.gle/gemini-cli-migration",
} as const;


// (merged PromptArguments and ToolArguments)
export interface ToolArguments {
  prompt?: string;
  model?: string;
  sandbox?: boolean | string;
  changeMode?: boolean | string;
  chunkIndex?: number | string; // Which chunk to return (1-based)
  chunkCacheKey?: string; // Optional cache key for continuation
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