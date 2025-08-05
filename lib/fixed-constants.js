// Logging
export const LOG_PREFIX = "[GMCPT]";
// Error messages
export const ERROR_MESSAGES = {
    QUOTA_EXCEEDED: "Quota exceeded for quota metric 'Gemini 2.5 Pro Requests'",
    QUOTA_EXCEEDED_SHORT: "⚠️ Gemini 2.5 Pro daily quota exceeded. Please retry with model: 'gemini-2.5-flash'",
    TOOL_NOT_FOUND: "not found in registry",
    NO_PROMPT_PROVIDED: "Please provide a prompt for analysis. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions",
};
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
};
// Models
export const MODELS = {
    PRO: "gemini-2.5-pro",
    FLASH: "gemini-2.5-flash",
};
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
};
// CLI Constants - FIXED VERSION FOR CROSS-USER COMPATIBILITY
export const CLI = {
    // CLI Commands
    COMMANDS: {
        GEMINI: "gemini",
        ECHO: "echo",
    },
    // CLI Flags
    FLAGS: {
        MODEL: "--model",
        SANDBOX: "--sandbox",
        PROMPT: "",  // No flag needed, prompt is passed directly
        HELP: "--help",
    },
    // Default values
    DEFAULTS: {
        MODEL: "default", // Fallback model used when no specific model is provided
        BOOLEAN_TRUE: "true",
        BOOLEAN_FALSE: "false",
    },
};