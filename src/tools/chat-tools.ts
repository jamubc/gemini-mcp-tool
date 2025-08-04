import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { ToolArguments } from '../constants.js';
import { ChatManager } from '../managers/chatManager.js';
import { executeGeminiCLI } from '../utils/geminiExecutor.js';
import { CHAT_CONSTANTS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants.js';
import { Logger } from '../utils/logger.js';

// Get ChatManager singleton instance
const chatManager = ChatManager.getInstance();

// Schema for start-chat tool
const startChatSchema = z.object({
  title: z.string()
    .min(1, "Chat title cannot be empty")
    .max(CHAT_CONSTANTS.MAX_TITLE_LENGTH, `Chat title cannot exceed ${CHAT_CONSTANTS.MAX_TITLE_LENGTH} characters`)
    .describe("Chat title/description"),
  agentName: z.string()
    .min(1, "Agent name cannot be empty")
    .max(50, "Agent name cannot exceed 50 characters")
    .describe("Your agent name"),
});

// Schema for list-chats tool
const listChatsSchema = z.object({
  agentName: z.string()
    .min(1, "Agent name cannot be empty")
    .describe("Your agent name"),
  status: z.enum(['active', 'archived', 'all'])
    .default('active')
    .describe("Chat status filter"),
  limit: z.number()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum chats to return"),
});

// Schema for show-chat tool
const showChatSchema = z.object({
  chatId: z.string()
    .min(1, "Chat ID cannot be empty")
    .describe("Chat identifier"),
  agentName: z.string()
    .min(1, "Agent name cannot be empty")
    .describe("Your agent name"),
  limit: z.number()
    .min(1)
    .max(100)
    .default(50)
    .describe("Maximum messages to show"),
});

// Schema for send-message tool
const sendMessageSchema = z.object({
  chatId: z.string()
    .min(1, "Chat ID cannot be empty")
    .describe("Chat identifier"),
  agentName: z.string()
    .min(1, "Agent name cannot be empty")
    .describe("Your agent name"),
  message: z.string()
    .min(1, "Message content cannot be empty")
    .max(CHAT_CONSTANTS.MAX_MESSAGE_LENGTH, `Message cannot exceed ${CHAT_CONSTANTS.MAX_MESSAGE_LENGTH} characters`)
    .describe("Message content"),
  includeHistory: z.boolean()
    .default(true)
    .describe("Include chat history for context"),
});

// Start-chat tool implementation
export const startChatTool: UnifiedTool = {
  name: 'start-chat',
  description: 'Create a new inter-agent chat session',
  zodSchema: startChatSchema,
  async execute(args: ToolArguments): Promise<string> {
    try {
      const { title, agentName } = startChatSchema.parse(args);
      
      const chatId = await chatManager.createChat(title, agentName);
      
      return `✅ Chat "${title}" created successfully with ID: ${chatId}\n\n📋 **Next Steps:**\n- Use \`list-chats\` to see all your chats\n- Use \`send-message\` to start the conversation\n- Use \`show-chat\` to view chat history`;
    } catch (error) {
      Logger.error('Error creating chat:', error);
      if (error instanceof z.ZodError) {
        return `❌ Validation Error: ${error.errors.map(e => e.message).join(', ')}`;
      }
      if (error instanceof Error) {
        return `❌ ${error.message}`;
      }
      return ERROR_MESSAGES.PERSISTENCE_FAILURE;
    }
  },
};

// List-chats tool implementation
export const listChatsTool: UnifiedTool = {
  name: 'list-chats',
  description: 'List available chat sessions with status information',
  zodSchema: listChatsSchema,
  async execute(args: ToolArguments): Promise<string> {
    try {
      const { agentName, status, limit } = listChatsSchema.parse(args);
      
      const chats = await chatManager.listChats(agentName, status);
      const limitedChats = chats.slice(0, limit);
      
      if (limitedChats.length === 0) {
        return `📭 **No ${status} chats found**\n\n💡 **Tip**: Use \`start-chat\` to create your first chat session`;
      }
      
      const chatList = limitedChats.map(chat => {
        const statusIcon = chat.status === 'active' ? '🟢' : '📁';
        const lastActivity = chat.lastActivity.toISOString().split('T')[0]; // YYYY-MM-DD format
        return `${statusIcon} **Chat ${chat.id}**: "${chat.title}"\n   👥 ${chat.participantCount} participants • 💬 ${chat.messageCount} messages • 📅 ${lastActivity}`;
      }).join('\n\n');
      
      const memoryUsage = chatManager.getMemoryUsage().toFixed(1);
      const cacheSize = chatManager.getCacheSize();
      
      return `📋 **${status.toUpperCase()} CHATS** (showing ${limitedChats.length} of ${chats.length})\n\n${chatList}\n\n📊 **System Status**: ${cacheSize} chats in memory (${memoryUsage}MB used)`;
    } catch (error) {
      Logger.error('Error listing chats:', error);
      if (error instanceof z.ZodError) {
        return `❌ Validation Error: ${error.errors.map(e => e.message).join(', ')}`;
      }
      return '❌ Failed to retrieve chat list. Please try again.';
    }
  },
};

// Show-chat tool implementation
export const showChatTool: UnifiedTool = {
  name: 'show-chat',
  description: 'Display chat history and participants',
  zodSchema: showChatSchema,
  async execute(args: ToolArguments): Promise<string> {
    try {
      const { chatId, agentName, limit } = showChatSchema.parse(args);
      
      const chat = await chatManager.getChat(chatId, agentName);
      if (!chat) {
        return ERROR_MESSAGES.CHAT_NOT_FOUND.replace('{chatId}', chatId);
      }
      
      const participants = chat.participants.map(p => p.name).join(', ');
      const messageCount = chat.messages.length;
      const limitedMessages = chat.messages.slice(-limit); // Show latest messages
      
      let result = `💬 **Chat "${chat.title}"** (ID: ${chatId})\n`;
      result += `👥 **Participants**: ${participants}\n`;
      result += `📅 **Created**: ${chat.created.toISOString().split('T')[0]}\n`;
      result += `💬 **Messages**: ${messageCount} total (showing latest ${Math.min(limit, messageCount)})\n\n`;
      
      if (limitedMessages.length === 0) {
        result += `📭 **No messages yet**\n\n💡 **Tip**: Use \`send-message\` to start the conversation`;
      } else {
        result += `📜 **CONVERSATION HISTORY**\n${'─'.repeat(50)}\n`;
        
        for (const msg of limitedMessages) {
          const participant = chat.participants.find(p => p.id === msg.senderId);
          const agentName = participant ? participant.name : 'Unknown';
          const timestamp = msg.timestamp.toISOString().replace('T', ' ').split('.')[0];
          
          result += `**[${timestamp}] ${agentName}:**\n${msg.content}\n\n`;
        }
        
        if (messageCount > limit) {
          result += `⚠️ **Note**: Only showing latest ${limit} messages. ${messageCount - limit} older messages hidden.`;
        }
      }
      
      return result;
    } catch (error) {
      Logger.error('Error showing chat:', error);
      if (error instanceof z.ZodError) {
        return `❌ Validation Error: ${error.errors.map(e => e.message).join(', ')}`;
      }
      return '❌ Failed to retrieve chat history. Please try again.';
    }
  },
};

// Send-message tool implementation
export const sendMessageTool: UnifiedTool = {
  name: 'send-message',
  description: 'Send message to inter-agent chat and get Gemini response',
  zodSchema: sendMessageSchema,
  async execute(args: ToolArguments): Promise<string> {
    try {
      const { chatId, agentName, message, includeHistory } = sendMessageSchema.parse(args);
      
      // Add the agent's message to chat
      const addResult = await chatManager.addMessage(chatId, agentName, message);
      if (!addResult.success) {
        return addResult.message;
      }
      
      // Get updated chat for Gemini interaction
      const chat = await chatManager.getChat(chatId, agentName);
      if (!chat) {
        return ERROR_MESSAGES.CHAT_NOT_FOUND.replace('{chatId}', chatId);
      }
      
      // Format prompt for Gemini
      let prompt = message;
      
      if (includeHistory && chat.messages.length > 1) {
        const history = chatManager.formatHistoryForGemini(chat);
        prompt = `${history}\n\n[${agentName}]: ${message}`;
      }
      
      try {
        // Send to Gemini CLI
        const geminiResponse = await executeGeminiCLI(
          prompt,
          'gemini-2.5-pro',
          false, // sandbox
          false  // changeMode
        );
        
        // Add Gemini's response to chat
        await chatManager.addMessage(chatId, 'Gemini', geminiResponse);
        
        return `✅ **Message sent to chat "${chat.title}"**\n\n🤖 **Gemini's Response:**\n${geminiResponse}`;
        
      } catch (geminiError) {
        Logger.error('Gemini CLI error:', geminiError);
        
        // Add error to chat for context
        const errorMsg = `⚠️ Gemini CLI error: ${geminiError instanceof Error ? geminiError.message : 'Unknown error'}`;
        await chatManager.addMessage(chatId, 'System', errorMsg);
        
        return `✅ **Message sent to chat "${chat.title}"**\n\n❌ **Gemini Error:**\n${errorMsg}\n\n💡 **Your message was saved.** You can try sending another message or check \`show-chat\` to see the conversation.`;
      }
      
    } catch (error) {
      Logger.error('Error sending message:', error);
      if (error instanceof z.ZodError) {
        return `❌ Validation Error: ${error.errors.map(e => e.message).join(', ')}`;
      }
      return '❌ Failed to send message. Please try again.';
    }
  },
};

// Export all chat tools as an array
export const chatTools: UnifiedTool[] = [
  startChatTool,
  listChatsTool,
  showChatTool,
  sendMessageTool,
];