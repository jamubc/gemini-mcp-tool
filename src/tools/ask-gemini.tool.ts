import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { executeGeminiCLI, processChangeModeOutput } from '../utils/geminiExecutor.js';
import {
  ERROR_MESSAGES,
  STATUS_MESSAGES,
  type ApprovalMode,
} from '../constants.js';

const askGeminiArgsSchema = z.object({
  prompt: z.string().min(1).describe("Analysis request. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions"),
  model: z.string().optional().describe("Optional model to use (e.g., 'gemini-2.5-flash'). If not specified, uses the default model (gemini-2.5-pro)."),
  sandbox: z.boolean().default(false).describe("Use sandbox mode (-s flag) to safely test code changes, execute scripts, or run potentially risky operations in an isolated environment"),
  changeMode: z.boolean().default(false).describe("Enable structured change mode - formats prompts to prevent tool errors and returns structured edit suggestions that Claude can apply directly"),
  chunkIndex: z.union([z.number(), z.string()]).optional().describe("Which chunk to return (1-based)"),
  chunkCacheKey: z.string().optional().describe("Optional cache key for continuation"),
  approvalMode: z.enum(['default', 'auto_edit', 'yolo', 'plan']).optional().describe("Optional Gemini approval mode. If omitted, no mode is forced (best for plain Q&A/analysis). 'yolo'/'auto_edit' let Gemini run or edit (use with sandbox); 'plan' makes Gemini an autonomous read-only planner."),
  sessionId: z.string().optional().describe("Start or identify a conversation session by id, so a later call can resume it (gemini --session-id)."),
  resume: z.string().optional().describe("Resume a prior session by id, or 'latest' for the most recent, to continue a multi-turn conversation (gemini --resume)."),
});

export const askGeminiTool: UnifiedTool = {
  name: "ask-gemini",
  description: "model selection [-m], sandbox [-s], and changeMode:boolean for providing edits",
  zodSchema: askGeminiArgsSchema,
  prompt: {
    description: "Execute 'gemini -p <prompt>' to get Gemini AI's response. Supports enhanced change mode for structured edit suggestions.",
  },
  category: 'gemini',
  execute: async (args, onProgress) => {
    const { prompt, model, sandbox, changeMode, chunkIndex, chunkCacheKey, approvalMode, sessionId, resume } = args; if (!prompt?.trim()) { throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED); }

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

    const result = await executeGeminiCLI(prompt as string, {
      model: model as string | undefined,
      sandbox: !!sandbox,
      changeMode: !!changeMode,
      approvalMode: approvalMode as ApprovalMode | undefined,
      sessionId: sessionId as string | undefined,
      resume: resume as string | undefined,
      onProgress,
    });

    if (changeMode) {
      return processChangeModeOutput(
        result,
        args.chunkIndex as number | undefined,
        undefined,
        prompt as string
      );
    }
    // Surface the active session id so the caller can resume the conversation.
    const activeSession = (resume as string | undefined) || (sessionId as string | undefined);
    const sessionNote = activeSession ? `\n\n[session: ${activeSession}]` : '';
    return `${STATUS_MESSAGES.GEMINI_RESPONSE}\n${result}${sessionNote}`; // changeMode false
  }
};