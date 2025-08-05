// Logging
export const LOG_PREFIX = "[GMCPT]";
// Error messages
export const ERROR_MESSAGES = {
    QUOTA_EXCEEDED: "Quota exceeded for quota metric 'Gemini 2.5 Pro Requests'",
    QUOTA_EXCEEDED_SHORT: "⚠️ Gemini 2.5 Pro daily quota exceeded. Please retry with model: 'gemini-2.5-flash'",
    TOOL_NOT_FOUND: "not found in registry",
    NO_PROMPT_PROVIDED: "Please provide a prompt for analysis. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions",
    CHANGE_MODE_NO_EDITS: "No edits found in Gemini's response. Please ensure Gemini uses the OLD/NEW format.",
    // Chat system error messages
    CHAT_NOT_FOUND: "❌ Chat ID {chatId} not found. Use 'list-chats' to see available chats.",
    UNAUTHORIZED_ACCESS: "🚫 You are not a participant in this chat.",
    MEMORY_LIMIT_EXCEEDED: "⚠️ System memory limits exceeded. Consider archiving old chats.",
    CONCURRENCY_TIMEOUT: "⏳ Operation timed out. Please retry in a few seconds.",
    PERSISTENCE_FAILURE: "💾 Failed to save chat data. Changes may be lost.",
    INVALID_CHAT_TITLE: "❌ Chat title must be between 1 and 200 characters.",
    INVALID_MESSAGE_CONTENT: "❌ Message content cannot be empty.",
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
// Success messages for chat system
export const SUCCESS_MESSAGES = {
    CHAT_CREATED: "✅ Chat created successfully",
    MESSAGE_SENT: "✅ Message sent successfully",
    CHAT_UPDATED: "✅ Chat updated successfully",
    CHAT_ARCHIVED: "📁 Chat archived successfully",
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
        MODEL: "default", // Fallback model used when no specific model is provided
        BOOLEAN_TRUE: "true",
        BOOLEAN_FALSE: "false",
    },
};
// Chat system constants
export const CHAT_CONSTANTS = {
    HISTORY_LIMIT: 30000, // Maximum characters in chat history
    MAX_TITLE_LENGTH: 200, // Maximum chat title length
    MAX_MESSAGE_LENGTH: 10000, // Maximum message content length
    MAX_CHATS_PER_AGENT: 100, // Maximum chats per agent
    MAX_CHAT_PARTICIPANTS: 50, // Maximum participants per chat
    HISTORY_DELIMITER_START: "=== CHAT HISTORY",
    HISTORY_DELIMITER_END: "=== END CHAT HISTORY ===",
    // Performance limits
    LOCK_TIMEOUT_MS: 5000, // Chat lock timeout
    MEMORY_LIMIT_MB: 100, // Maximum memory usage
    GC_INTERVAL_MS: 300000, // Garbage collection interval (5 minutes)
};
