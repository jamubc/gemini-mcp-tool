import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { executeGeminiCLI, processChangeModeOutput } from '../utils/geminiExecutor.js';
import { 
  ERROR_MESSAGES, 
  STATUS_MESSAGES
} from '../constants.js';

const askGeminiArgsSchema = z.object({
  prompt: z.string().min(1).describe("Analysis request. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions"),
  model: z.string().optional().describe("Optional model to use (e.g., 'gemini-2.5-flash'). If not specified, uses the default model (gemini-2.5-pro)."),
  sandbox: z.boolean().default(false).describe("Use sandbox mode (-s flag) to safely test code changes, execute scripts, or run potentially risky operations in an isolated environment"),
  changeMode: z.boolean().default(false).describe("Enable structured change mode - formats prompts to prevent tool errors and returns structured edit suggestions that Claude can apply directly"),
  chunkIndex: z.union([z.number(), z.string()]).optional().describe("Which chunk to return (1-based)"),
  chunkCacheKey: z.string().optional().describe("Optional cache key for continuation"),

  // Phase 1: Critical flags
  yolo: z.boolean().default(false).describe("Auto-accept all actions (YOLO mode). Automatically approves all confirmations without prompting. Use with caution in automated workflows."),
  approvalMode: z.enum(["default", "auto_edit", "yolo"]).optional().describe("Set approval mode: 'default' (prompt for approval), 'auto_edit' (auto-approve edit tools only), 'yolo' (auto-approve all tools). Overrides yolo flag if both are set."),
  outputFormat: z.enum(["text", "json", "stream-json"]).optional().describe("Output format: 'text' (default human-readable), 'json' (structured JSON), 'stream-json' (streaming JSON for real-time processing)"),
  includeDirectories: z.union([z.string(), z.array(z.string())]).optional().describe("Additional directories to include in workspace (comma-separated string or array). Example: 'src,tests' or ['src', 'tests']"),
  debug: z.boolean().default(false).describe("Enable debug mode for verbose logging and troubleshooting"),

  // Phase 2: Enhanced features (for future implementation)
  promptInteractive: z.string().optional().describe("Execute the provided prompt and continue in interactive mode"),
  extensions: z.union([z.string(), z.array(z.string())]).optional().describe("Specific extensions to use (comma-separated or array). If not provided, all extensions are used."),
  resume: z.string().optional().describe("Resume a previous session. Use 'latest' for most recent or session index number"),
});

export const askGeminiTool: UnifiedTool = {
  name: "ask-gemini",
  description: "Ask Google Gemini with full CLI support: model selection [-m], sandbox [-s], YOLO mode [-y], approval modes, output formats, and more",
  zodSchema: askGeminiArgsSchema,
  prompt: {
    description: "Execute Gemini CLI with advanced options. Supports file analysis (@syntax), YOLO mode, different approval levels, output formats (text/json), debug mode, and structured change mode for edit suggestions.",
  },
  category: 'gemini',
  execute: async (args, onProgress) => {
    const {
      prompt, model, sandbox, changeMode, chunkIndex, chunkCacheKey,
      yolo, approvalMode, outputFormat, includeDirectories, debug,
      promptInteractive, extensions, resume
    } = args; if (!prompt?.trim()) { throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED); }
  
    if (changeMode && chunkIndex && chunkCacheKey) {
      // Security: validate cacheKey format before any cache access
      if (typeof chunkCacheKey !== 'string' || !/^[a-f0-9]{8}$/.test(chunkCacheKey)) {
        return `❌ Invalid chunkCacheKey format. Expected 8 lowercase hex characters (got ${JSON.stringify(chunkCacheKey)}).`;
      }
      return processChangeModeOutput(
        '', // empty for cache...
        chunkIndex as number,
        chunkCacheKey as string,
        prompt as string
      );
    }
    
    const result = await executeGeminiCLI(
      prompt as string,
      {
        model: model as string | undefined,
        sandbox: !!sandbox,
        changeMode: !!changeMode,
        yolo: !!yolo,
        approvalMode: approvalMode as string | undefined,
        outputFormat: outputFormat as string | undefined,
        includeDirectories: includeDirectories,
        debug: !!debug,
        promptInteractive: promptInteractive as string | undefined,
        extensions: extensions,
        resume: resume as string | undefined,
      },
      onProgress
    );
    
    if (changeMode) {
      return processChangeModeOutput(
        result,
        args.chunkIndex as number | undefined,
        undefined,
        prompt as string
      );
    }
    return `${STATUS_MESSAGES.GEMINI_RESPONSE}\n${result}`; // changeMode false
  }
};