export declare const LOG_PREFIX = "[GMCPT]";
export declare const ERROR_MESSAGES: {
    readonly QUOTA_EXCEEDED: "Quota exceeded for quota metric 'Gemini 2.5 Pro Requests'";
    readonly QUOTA_EXCEEDED_SHORT: "⚠️ Gemini 2.5 Pro daily quota exceeded. Please retry with model: 'gemini-2.5-flash'";
    readonly TOOL_NOT_FOUND: "not found in registry";
    readonly NO_PROMPT_PROVIDED: "Please provide a prompt for analysis. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions";
};
export declare const STATUS_MESSAGES: {
    readonly QUOTA_SWITCHING: "🚫 Gemini 2.5 Pro quota exceeded, switching to Flash model...";
    readonly FLASH_RETRY: "⚡ Retrying with Gemini 2.5 Flash...";
    readonly FLASH_SUCCESS: "✅ Flash model completed successfully";
    readonly SANDBOX_EXECUTING: "🔒 Executing Gemini CLI command in sandbox mode...";
    readonly GEMINI_RESPONSE: "Gemini response:";
    readonly PROCESSING_START: "🔍 Starting analysis (may take 5-15 minutes for large codebases)";
    readonly PROCESSING_CONTINUE: "⏳ Still processing... Gemini is working on your request";
    readonly PROCESSING_COMPLETE: "✅ Analysis completed successfully";
};
export declare const MODELS: {
    readonly PRO: "gemini-2.5-pro";
    readonly FLASH: "gemini-2.5-flash";
};
export declare const PROTOCOL: {
    readonly ROLES: {
        readonly USER: "user";
        readonly ASSISTANT: "assistant";
    };
    readonly CONTENT_TYPES: {
        readonly TEXT: "text";
    };
    readonly STATUS: {
        readonly SUCCESS: "success";
        readonly ERROR: "error";
        readonly FAILED: "failed";
        readonly REPORT: "report";
    };
    readonly NOTIFICATIONS: {
        readonly PROGRESS: "notifications/progress";
    };
    readonly KEEPALIVE_INTERVAL: 25000;
};
export declare const CLI: {
    readonly COMMANDS: {
        readonly GEMINI: "gemini";
        readonly ECHO: "echo";
    };
    readonly FLAGS: {
        readonly MODEL: "-m";
        readonly SANDBOX: "-s";
        readonly PROMPT: "-p";
        readonly HELP: "-help";
    };
    readonly DEFAULTS: {
        readonly MODEL: "default";
        readonly BOOLEAN_TRUE: "true";
        readonly BOOLEAN_FALSE: "false";
    };
};
export interface ToolArguments {
    prompt?: string;
    model?: string;
    sandbox?: boolean | string;
    changeMode?: boolean | string;
    chunkIndex?: number | string;
    chunkCacheKey?: string;
    message?: string;
    methodology?: string;
    domain?: string;
    constraints?: string;
    existingContext?: string;
    ideaCount?: number;
    includeAnalysis?: boolean;
    [key: string]: string | boolean | number | undefined;
}
//# sourceMappingURL=constants.d.ts.map