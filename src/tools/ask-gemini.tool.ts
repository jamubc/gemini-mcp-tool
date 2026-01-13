import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { executeGeminiCLI, processChangeModeOutput, getLastSessionId } from '../utils/geminiExecutor.js';
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
  sessionId: z.string().optional().describe("Session ID to resume a previous conversation. Use 'latest' for the most recent session."),
});

export const askGeminiTool: UnifiedTool = {
  name: "ask-gemini",
  description: "model selection [-m], sandbox [-s], session resume, and changeMode:boolean for providing edits",
  zodSchema: askGeminiArgsSchema,
  prompt: {
    description: "Execute 'gemini -p <prompt>' to get Gemini AI's response. Supports enhanced change mode for structured edit suggestions.",
  },
  category: 'gemini',
  execute: async (args, onProgress) => {
    const { prompt, model, sandbox, changeMode, chunkIndex, chunkCacheKey, sessionId } = args; if (!prompt?.trim()) { throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED); }

    if (changeMode && chunkIndex && chunkCacheKey) {
      return processChangeModeOutput(
        '', // empty for cache...
        chunkIndex as number,
        chunkCacheKey as string,
        prompt as string
      );
    }

    const result = await executeGeminiCLI(
      prompt as string,
      model as string | undefined,
      !!sandbox,
      !!changeMode,
      sessionId as string | undefined,
      onProgress
    );

    // If no sessionId was provided, this is a new session
    // Retrieve and append the session ID for future reference
    let sessionInfo = "";
    if (!sessionId) {
      const newSessionId = await getLastSessionId();
      if (newSessionId) {
        sessionInfo = `\n\n**Session ID:** ${newSessionId}`;
      }
    }

    if (changeMode) {
      const parsedOutput = await processChangeModeOutput(
        result,
        args.chunkIndex as number | undefined,
        undefined,
        prompt as string
      );
      return `${parsedOutput}${sessionInfo}`;
    }
    return `${STATUS_MESSAGES.GEMINI_RESPONSE}\n${result}${sessionInfo}`; // changeMode false
  }
};