import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { EnhancedChatManager } from '../managers/enhancedChatManager.js';
import { Logger } from '../utils/logger.js';
import { JsonChatPersistence } from '../persistence/jsonChatPersistence.js';

// Delete Chat Tool
const deleteChatSchema = z.object({
  chatId: z.string().describe('Chat ID to delete')
});

export const deleteChatTool: UnifiedTool = {
  name: 'delete-chat',
  description: 'Delete a specific chat conversation and all associated files',
  zodSchema: deleteChatSchema,
  execute: async (args, progressCallback) => {
    try {
      const { chatId } = args;
      if (!chatId) {
        throw new Error('Chat ID is required');
      }
      
      progressCallback?.(`Deleting chat ${chatId}...`);
      
      const chatManager = EnhancedChatManager.getInstance();
      const success = await chatManager.deleteChat(chatId as string);
      
      if (success) {
        Logger.info(`Chat ${chatId} deleted successfully`);
        return `✅ Chat ${chatId} has been deleted successfully.`;
      } else {
        Logger.warn(`Failed to delete chat ${chatId}`);
        return `❌ Failed to delete chat ${chatId}. Chat may not exist.`;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error('Error deleting chat:', error);
      return `❌ Error deleting chat: ${errorMessage}`;
    }
  }
};

// List Chats Tool  
const listChatsSchema = z.object({
  includeDetails: z.boolean().optional().describe('Include detailed information about each chat')
});

export const listChatsTool: UnifiedTool = {
  name: 'list-chats',
  description: 'List all active chat conversations with metadata',
  zodSchema: listChatsSchema,
  execute: async (args, progressCallback) => {
    try {
      const { includeDetails = false } = args;
      
      progressCallback?.('Retrieving chat list...');
      
      const chatManager = EnhancedChatManager.getInstance();
      const chats = await chatManager.listChats();
      
      if (chats.length === 0) {
        return '📭 No active chats found.';
      }
      
      let result = `📋 **Active Chats (${chats.length})**\n\n`;
      
      for (const chat of chats) {
        const lastAccessTime = new Date(chat.lastAccessTime).toLocaleString();
        const createdTime = new Date(chat.createdAt).toLocaleString();
        
        result += `🗨️ **Chat ${chat.chatId}**: ${chat.title}\n`;
        result += `   📅 Created: ${createdTime}\n`;
        result += `   🕐 Last Access: ${lastAccessTime}\n`;
        
        if (includeDetails) {
          try {
            const fullChat = await chatManager.getChat(chat.chatId);
            if (fullChat) {
              result += `   👥 Participants: ${Array.from(fullChat.participants).join(', ')}\n`;
              result += `   💬 Messages: ${fullChat.messages.length}\n`;
            }
          } catch (error) {
            Logger.warn(`Failed to get details for chat ${chat.chatId}:`, error);
          }
        }
        
        result += '\n';
      }
      
      return result.trim();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error('Error listing chats:', error);
      return `❌ Error listing chats: ${errorMessage}`;
    }
  }
};

// Cleanup Chats Tool
const cleanupChatsSchema = z.object({
  dryRun: z.boolean().optional().describe('If true, shows what would be deleted without actually deleting')
});

export const cleanupChatsTool: UnifiedTool = {
  name: 'cleanup-chats',
  description: 'Manually trigger cleanup of expired chats (older than 24 hours)',
  zodSchema: cleanupChatsSchema,
  execute: async (args, progressCallback) => {
    try {
      const { dryRun = false } = args;
      
      if (dryRun) {
        progressCallback?.('Running cleanup analysis (dry run)...');
      } else {
        progressCallback?.('Cleaning up expired chats...');
      }
      
      const chatManager = EnhancedChatManager.getInstance();
      
      // Access the persistence layer to trigger cleanup
      const persistence = await chatManager.getPersistence();
      
      if (!persistence) {
        return '❌ Persistence layer not available for cleanup.';
      }
      
      if (dryRun) {
        // For dry run, we'd need to implement a separate method that doesn't delete
        // For now, we'll just return a message indicating the feature
        return '🔍 **Dry Run Mode**\n\nTo see what would be deleted, the cleanup process would:\n- Scan all chat files in temp storage\n- Check last access time for each chat\n- Identify chats older than 24 hours\n- Report which files would be removed\n\nRun without `dryRun: true` to perform actual cleanup.';
      }
      
      const result = await persistence.cleanupExpiredFiles();
      
      const message = `🧹 **Cleanup Complete**\n\n` +
        `✅ Deleted: ${result.deletedCount} expired chats\n` +
        `❌ Errors: ${result.errors} files had issues\n\n` +
        `Expired chats (older than 24 hours) have been removed from temporary storage.`;
      
      Logger.info(`Manual cleanup completed: ${result.deletedCount} deleted, ${result.errors} errors`);
      return message;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error('Error during manual cleanup:', error);
      return `❌ Error during cleanup: ${errorMessage}`;
    }
  }
};

// Get Chat Info Tool
const getChatInfoSchema = z.object({
  chatId: z.string().describe('Chat ID to get information about')
});

export const getChatInfoTool: UnifiedTool = {
  name: 'get-chat-info',
  description: 'Get detailed information about a specific chat',
  zodSchema: getChatInfoSchema,
  execute: async (args, progressCallback) => {
    try {
      const { chatId } = args;
      if (!chatId) {
        throw new Error('Chat ID is required');
      }
      
      progressCallback?.(`Retrieving information for chat ${chatId}...`);
      
      const chatManager = EnhancedChatManager.getInstance();
      const chat = await chatManager.getChat(chatId as string);
      
      if (!chat) {
        return `❌ Chat ${chatId} not found.`;
      }
      
      const createdTime = chat.created.toLocaleString();
      const updatedTime = chat.lastActivity.toLocaleString();
      const participants = Array.from(chat.participants);
      
      // Get agent states if available
      const persistence = await chatManager.getPersistence();
      let agentStatesInfo = '';
      
      try {
        const chatData = await persistence.loadChat(chatId as string);
        if (chatData?.agentStates) {
          agentStatesInfo = '\n\n**🤖 Agent Participation States:**\n';
          Object.entries(chatData.agentStates).forEach(([agentId, state]) => {
            const lastActive = state.lastActiveAt 
              ? new Date(state.lastActiveAt).toLocaleString() 
              : 'Never';
            agentStatesInfo += `- **${agentId}**: ${state.participationState} (last active: ${lastActive})\n`;
          });
        }
      } catch (error) {
        Logger.warn(`Failed to get agent states for chat ${chatId}:`, error);
      }
      
      const result = `📊 **Chat ${chatId} Information**\n\n` +
        `**📋 Title:** ${chat.title}\n` +
        `**📅 Created:** ${createdTime}\n` +
        `**🕐 Last updated:** ${updatedTime}\n` +
        `**👥 Participants:** ${participants.join(', ')}\n` +
        `**💬 Total messages:** ${chat.messages.length}\n` +
        agentStatesInfo;
      
      return result.trim();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error('Error getting chat info:', error);
      return `❌ Error getting chat info: ${errorMessage}`;
    }
  }
};

// Export all chat management tools
export const chatManagementTools = [
  deleteChatTool,
  listChatsTool, 
  cleanupChatsTool,
  getChatInfoTool
];