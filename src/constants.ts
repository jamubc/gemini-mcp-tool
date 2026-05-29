

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
    ECHO: "echo",
  },
  // Command flags
  FLAGS: {
    MODEL: "-m",
    SANDBOX: "-s",
    PROMPT: "-p",
    HELP: "-help",
    // Phase 1: Critical flags
    YOLO: "-y",
    APPROVAL_MODE: "--approval-mode",
    OUTPUT_FORMAT: "-o",
    INCLUDE_DIRECTORIES: "--include-directories",
    DEBUG: "-d",
    // Phase 2: Enhanced features
    PROMPT_INTERACTIVE: "-i",
    EXTENSIONS: "-e",
    RESUME: "-r",
  },
  // Default values
  DEFAULTS: {
    MODEL: "default", // Fallback model used when no specific model is provided
    BOOLEAN_TRUE: "true",
    BOOLEAN_FALSE: "false",
    APPROVAL_MODE_DEFAULT: "default",
    APPROVAL_MODE_AUTO_EDIT: "auto_edit",
    APPROVAL_MODE_YOLO: "yolo",
    OUTPUT_FORMAT_TEXT: "text",
    OUTPUT_FORMAT_JSON: "json",
    OUTPUT_FORMAT_STREAM_JSON: "stream-json",
  },
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

  // Phase 1: Critical flags
  yolo?: boolean | string; // Auto-accept all actions (YOLO mode)
  approvalMode?: string; // Approval mode: default, auto_edit, yolo
  outputFormat?: string; // Output format: text, json, stream-json
  includeDirectories?: string | string[]; // Additional directories to include
  debug?: boolean | string; // Enable debug mode

  // Phase 2: Enhanced features
  promptInteractive?: string; // Execute prompt and continue interactively
  extensions?: string | string[]; // Extensions to use
  resume?: string; // Resume previous session

  // Brainstorm tool
  methodology?: string; // Brainstorming framework to use
  domain?: string; // Domain context for specialized brainstorming
  constraints?: string; // Known limitations or requirements
  existingContext?: string; // Background information to build upon
  ideaCount?: number; // Target number of ideas to generate
  includeAnalysis?: boolean; // Include feasibility and impact analysis

  [key: string]: string | boolean | number | string[] | undefined; // Allow additional properties
}