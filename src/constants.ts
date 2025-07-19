// Tool names
export const TOOL_NAMES = {
  ASK_GEMINI: "ask-gemini",
  PING: "Ping",
  HELP: "Help",
} as const;

// Logging
export const LOG_PREFIX = "[Gemini MCP]";

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
  GEMINI_RESPONSE: "🤖 Gemini Replied:",
} as const;

// Models
export const MODELS = {
  PRO: "gemini-2.5-pro",
  FLASH: "gemini-2.5-flash",
} as const;

// Delimiters
export const OUTPUT_DELIMITERS = {
  START: "==== TOOL OUTPUT START ====",
  END: "==== TOOL OUTPUT END ====",
  METADATA_PREFIX: "[SYSTEM_METADATA]:",
  AI_INSTRUCTIONS_PREFIX: "<!-- AI_INSTRUCTIONS:",
  AI_INSTRUCTIONS_SUFFIX: " -->",
} as const;

// Timeouts and intervals --> ??? DEAD CODE?
export const TIMING = {
  PROGRESS_INTERVAL: 5000, // 5 seconds
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
  // Progress token
  PROGRESS_TOKEN: "gemini-status",
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
  },
  // Default values
  DEFAULTS: {
    MODEL: "default", // ew
    BOOLEAN_TRUE: "true",
    BOOLEAN_FALSE: "false",
  },
} as const;

// Response sections
export const RESPONSE_SECTIONS = {
  ANALYSIS_PREFIX: "Analyzed request:",
  ANALYSIS_OF_PREFIX: "Analysis of:",
  NEXT_STEPS_EDIT: `Gemini cannot directly edit files. To apply the suggested changes above:
• For single replacements: use Claude's Edit tool
• For multiple replacements in one file: use Claude's MultiEdit tool
• Alternative: use find-and-replace functionality`,
  NEXT_STEPS_STANDARD: "Review the analysis above and apply any suggested changes manually.",
} as const;