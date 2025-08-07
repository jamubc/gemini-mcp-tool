import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { executeGeminiCLI, GeminiExecutionOptions } from '../utils/geminiExecutor.js';
import { EnhancedChatManager } from '../managers/enhancedChatManager.js';
import { 
  ERROR_MESSAGES, 
  STATUS_MESSAGES,
  CHAT_CONSTANTS
} from '../constants.js';
import { Logger } from '../utils/logger.js';

// Get EnhancedChatManager singleton instance
const chatManager = EnhancedChatManager.getInstance();

const askGeminiArgsSchema = z.object({
  prompt: z.string().min(1).describe("Analysis request. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions"),
  agentName: z.string().min(1).max(50).describe("Your agent name (required)"),
  chatId: z.union([z.number(), z.string()]).transform(val => val.toString()).default("0").describe("Chat ID to use (0 or omit to create new chat)"),
  model: z.string().optional().describe("Optional model to use (e.g., 'gemini-2.5-flash'). If not specified, uses the default model (gemini-2.5-pro)."),
  sandbox: z.boolean().default(false).describe("Use sandbox mode (-s flag) to safely test code changes, execute scripts, or run potentially risky operations in an isolated environment")
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
    const { prompt, agentName, chatId, model, sandbox } = args;
    
    if (!prompt?.trim()) {
      throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    }
    
    if (!agentName || typeof agentName !== 'string' || !agentName.trim()) {
      throw new Error('Agent name is required');
    }

    try {
      let targetChatId: string;
      let chatContext = '';

      // Create new chat if chatId is "0" or not provided
      if (!chatId || chatId === "0") {
        // Generate chat title from prompt (first 50 chars)
        const chatTitle = prompt.length > 50 ? prompt.substring(0, 47) + '...' : prompt;
        const newChatId = await chatManager.createChat(chatTitle, agentName);
        targetChatId = newChatId.toString();
        chatContext = `📝 **New chat created**: "${chatTitle}" (ID: ${targetChatId})`;
      } else {
        // Use existing chat - get context
        const chat = await chatManager.getChat(chatId.toString());
        if (!chat) {
          return `❌ Chat ID ${chatId} not found. Use chatId=0 to create a new chat.`;
        }
        targetChatId = chatId.toString();
        chatContext = `💬 **Using existing chat**: "${chat.title || 'Untitled'}" (ID: ${chatId})`;
      }

      // Add agent's message to chat
      await chatManager.addMessage(targetChatId, agentName, prompt);

      // Get updated chat for context
      const chat = await chatManager.getChat(targetChatId);
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
            agentName
          );
          
          if (fileResult.success && fileResult.fileReference) {
            geminiPrompt = `${fileResult.fileReference}\n\n[${agentName}]: ${prompt}`;
            Logger.info(`Using chat history file: ${fileResult.fileReference}`);
          } else {
            Logger.warn(`Failed to generate chat history file`);
            // Fallback to simple message history format
            const messages = chat.messages.slice(0, -1); // Exclude the just-added message
            const history = messages.map((m: any) => `[${m.agent}]: ${m.message}`).join('\n');
            geminiPrompt = `${history}\n\n[${agentName}]: ${prompt}`;
          }
        } catch (error) {
          Logger.warn('Chat history file generation failed, using fallback:', error);
          // Fallback to simple message history format
          const messages = chat.messages.slice(0, -1); // Exclude the just-added message
          const history = messages.map((m: any) => `[${m.agent}]: ${m.message}`).join('\n');
          geminiPrompt = `${history}\n\n[${agentName}]: ${prompt}`;
        }
      }

      // Prepare timeout options for Gemini execution
      const timeoutOptions: GeminiExecutionOptions = {
        rollingTimeout: 30000,   // 30 second rolling timeout
        absoluteTimeout: 600000  // 10 minute absolute timeout
      };

      // Execute Gemini CLI with rolling timeout
      const result = await executeGeminiCLI(
        geminiPrompt,
        model as string | undefined,
        !!sandbox,
        onProgress,
        timeoutOptions
      );

      // Add Gemini's response to chat
      await chatManager.addMessage(targetChatId, 'Gemini', result);

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