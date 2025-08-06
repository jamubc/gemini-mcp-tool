import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { executeGeminiCLI, processChangeModeOutput } from '../utils/geminiExecutor.js';
import { ChatManager } from '../managers/chatManager.js';
import { 
  ERROR_MESSAGES, 
  STATUS_MESSAGES,
  CHAT_CONSTANTS
} from '../constants.js';
import { Logger } from '../utils/logger.js';

// Get ChatManager singleton instance
const chatManager = ChatManager.getInstance();

const askGeminiArgsSchema = z.object({
  prompt: z.string().min(1).describe("Analysis request. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions"),
  agentName: z.string().min(1).max(50).describe("Your agent name (required)"),
  chatId: z.number().int().min(0).default(0).describe("Chat ID to use (0 or omit to create new chat)"),
  model: z.string().optional().describe("Optional model to use (e.g., 'gemini-2.5-flash'). If not specified, uses the default model (gemini-2.5-pro)."),
  sandbox: z.boolean().default(false).describe("Use sandbox mode (-s flag) to safely test code changes, execute scripts, or run potentially risky operations in an isolated environment"),
  changeMode: z.boolean().default(false).describe("Enable structured change mode - formats prompts to prevent tool errors and returns structured edit suggestions that Claude can apply directly"),
  chunkIndex: z.union([z.number(), z.string()]).optional().describe("Which chunk to return (1-based)"),
  chunkCacheKey: z.string().optional().describe("Optional cache key for continuation"),
});

export const askGeminiTool: UnifiedTool = {
  name: "ask-gemini",
  description: "Ask Gemini with chat context - supports model selection, sandbox mode, and chat integration",
  zodSchema: askGeminiArgsSchema,
  prompt: {
    description: "Execute 'gemini -p <prompt>' to get Gemini AI's response with chat context. Creates new chat if chatId is 0 or omitted.",
  },
  category: 'gemini',
  execute: async (args, onProgress) => {
    const { prompt, agentName, chatId, model, sandbox, changeMode, chunkIndex, chunkCacheKey } = args;
    
    if (!prompt?.trim()) {
      throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    }
    
    if (!agentName || typeof agentName !== 'string' || !agentName.trim()) {
      throw new Error('Agent name is required');
    }

    // Handle change mode chunking first (no chat integration for chunks)
    if (changeMode && chunkIndex && chunkCacheKey) {
      return processChangeModeOutput(
        '', // empty for cache...
        chunkIndex as number,
        chunkCacheKey as string,
        prompt as string
      );
    }

    try {
      let targetChatId: number;
      let chatContext = '';

      // Ensure chatId is a number
      const numChatId = typeof chatId === 'number' ? chatId : 0;

      // Create new chat if chatId is 0 or not provided
      if (!numChatId || numChatId === 0) {
        // Generate chat title from prompt (first 50 chars)
        const chatTitle = prompt.length > 50 ? prompt.substring(0, 47) + '...' : prompt;
        targetChatId = await chatManager.createChat(chatTitle, agentName);
        chatContext = `📝 **New chat created**: "${chatTitle}" (ID: ${targetChatId})`;
      } else {
        // Use existing chat - get context
        const chat = await chatManager.getChat(numChatId.toString(), agentName);
        if (!chat) {
          return `❌ Chat ID ${numChatId} not found. Use chatId=0 to create a new chat.`;
        }
        targetChatId = numChatId;
        chatContext = `💬 **Using existing chat**: "${chat.title}" (ID: ${numChatId})`;
      }

      // Add agent's message to chat
      const addResult = await chatManager.addMessage(targetChatId.toString(), agentName, prompt);
      if (!addResult.success) {
        return addResult.message;
      }

      // Get updated chat for context
      const chat = await chatManager.getChat(targetChatId.toString(), agentName);
      if (!chat) {
        return `❌ Failed to retrieve chat after creating message.`;
      }

      // Format prompt with chat history if there are previous messages
      let geminiPrompt = prompt;
      if (chat.messages.length > 1) {
        try {
          // Try JSON file approach first
          const fileResult = await chatManager.generateChatHistoryFile(
            targetChatId,
            prompt,
            agentName,
            false // debugKeepFile
          );
          
          if (fileResult.success && fileResult.fileReference) {
            geminiPrompt = `${fileResult.fileReference}\n\n[${agentName}]: ${prompt}`;
            Logger.info(`Using chat history file: ${fileResult.fileReference}`);
          } else {
            Logger.warn(`Failed to generate chat history file: ${fileResult.error}`);
            // Fallback to original approach
            const history = chatManager.formatHistoryForGemini(chat);
            geminiPrompt = `${history}\n\n[${agentName}]: ${prompt}`;
          }
        } catch (error) {
          Logger.warn('Chat history file generation failed, using fallback:', error);
          // Fallback to existing behavior
          const history = chatManager.formatHistoryForGemini(chat);
          geminiPrompt = `${history}\n\n[${agentName}]: ${prompt}`;
        }
      }

      // Execute Gemini CLI
      const result = await executeGeminiCLI(
        geminiPrompt,
        model as string | undefined,
        !!sandbox,
        !!changeMode,
        onProgress
      );

      // Handle change mode output
      if (changeMode) {
        // Add Gemini's response to chat first
        await chatManager.addMessage(targetChatId.toString(), 'Gemini', result);
        
        return processChangeModeOutput(
          result,
          args.chunkIndex as number | undefined,
          undefined,
          prompt as string
        );
      }

      // Add Gemini's response to chat
      await chatManager.addMessage(targetChatId.toString(), 'Gemini', result);

      return `${chatContext}\n\n🤖 **Gemini's Response:**\n${result}\n\n💡 **Chat ID ${targetChatId}** - Use this ID for follow-up questions to maintain context.`;

    } catch (error) {
      // If there was an error after creating a chat, still inform the user
      if (error instanceof Error) {
        return `❌ Error: ${error.message}`;
      }
      return `❌ An unexpected error occurred while processing your request.`;
    }
  }
};