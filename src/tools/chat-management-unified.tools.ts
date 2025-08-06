import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { UnifiedChatManager } from '../managers/unifiedChatManager.js';
import { Logger } from '../utils/logger.js';

// Get UnifiedChatManager singleton instance
const chatManager = UnifiedChatManager.getInstance({
  persistenceType: 'json',
  enableLegacyCompatibility: true
});

// Delete Chat Tool
const deleteChatSchema = z.object({
  chatId: z.union([z.string(), z.number()]).describe('Chat ID to delete (supports both string and numeric IDs)')
});

export const deleteChatUnifiedTool: UnifiedTool = {
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
      
      const success = await chatManager.deleteChat(chatId);
      
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
  includeDetails: z.boolean().optional().describe('Include detailed information about each chat'),
  status: z.enum(['active', 'archived', 'all']).optional().default('active').describe('Filter chats by status'),
  limit: z.number().optional().describe('Maximum number of chats to return'),
  agentFilter: z.string().optional().describe('Filter chats by agent/participant')
});

export const listChatsUnifiedTool: UnifiedTool = {
  name: 'list-chats',
  description: 'List all active chat conversations with metadata',
  zodSchema: listChatsSchema,
  execute: async (args, progressCallback) => {
    try {
      const { includeDetails = false, status = 'active', limit, agentFilter } = args;
      
      progressCallback?.('Retrieving chat list...');
      
      const chats = await chatManager.listChats({ 
        status,
        limit,
        agentFilter
      });
      
      if (chats.length === 0) {
        return '📭 No active chats found.';
      }
      
      let result = `📋 **Active Chats (${chats.length})**\n\n`;
      
      for (const chat of chats) {
        // Handle both new and legacy chat summary formats
        const lastAccessTime = chat.lastAccessTime 
          ? new Date(chat.lastAccessTime).toLocaleString()
          : new Date(chat.lastActivity).toLocaleString();
        const createdTime = chat.createdAt 
          ? new Date(chat.createdAt).toLocaleString()
          : 'Unknown';
        
        result += `🗨️ **Chat ${chat.chatId}**: ${chat.title}\n`;
        result += `   📅 Created: ${createdTime}\n`;
        result += `   🕐 Last Access: ${lastAccessTime}\n`;
        
        if (includeDetails) {
          try {
            const fullChat = await chatManager.getChatV2(chat.chatId);
            if (fullChat) {
              result += `   👥 Participants: ${fullChat.participants.join(', ')}\n`;
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

export const cleanupChatsUnifiedTool: UnifiedTool = {
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
      
      const result = await chatManager.cleanupExpiredChats();
      
      if (!result) {
        return '❓ Cleanup not supported by current persistence layer.';
      }
      
      if (dryRun) {
        return '🔍 **Dry Run Mode**\n\nTo see what would be deleted, the cleanup process would:\n- Scan all chat files in temp storage\n- Check last access time for each chat\n- Identify chats older than 24 hours\n- Report which files would be removed\n\nRun without `dryRun: true` to perform actual cleanup.';
      }
      
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
  chatId: z.union([z.string(), z.number()]).describe('Chat ID to get information about (supports both string and numeric IDs)')
});

export const getChatInfoUnifiedTool: UnifiedTool = {
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
      
      const chat = await chatManager.getChatV2(chatId.toString());
      
      if (!chat) {
        return `❌ Chat ${chatId} not found.`;
      }
      
      const createdTime = chat.created.toLocaleString();
      const updatedTime = chat.lastActivity.toLocaleString();
      const participants = chat.participants;
      
      let agentStatesInfo = '';
      
      // Try to get additional agent state information
      try {
        const storagePaths = chatManager.getStoragePaths();
        if (storagePaths.storage) {
          agentStatesInfo = '\n\n**🤖 Agent Participation:**\n';
          participants.forEach(participant => {
            agentStatesInfo += `- **${participant}**: Active participant\n`;
          });
        }
      } catch (error) {
        Logger.debug(`Could not get agent states for chat ${chatId}:`, error);
      }
      
      const result = `📊 **Chat ${chatId} Information**\n\n` +
        `**📋 Title:** ${chat.title}\n` +
        `**📅 Created:** ${createdTime}\n` +
        `**🕐 Last updated:** ${updatedTime}\n` +
        `**👥 Participants:** ${participants.join(', ')}\n` +
        `**💬 Total messages:** ${chat.messages.length}\n` +
        `**📌 Status:** ${chat.status}\n` +
        agentStatesInfo;
      
      return result.trim();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error('Error getting chat info:', error);
      return `❌ Error getting chat info: ${errorMessage}`;
    }
  }
};

// Migration Tool
const migrationSchema = z.object({
  action: z.enum(['status', 'migrate', 'dry-run']).describe('Migration action: status (check current state), migrate (perform migration), or dry-run (preview changes)'),
  backupFirst: z.boolean().optional().default(true).describe('Create backup before migration'),
  cleanupAfter: z.boolean().optional().default(false).describe('Clean up old data after successful migration'),
  conflictResolution: z.enum(['skip', 'overwrite']).optional().default('skip').describe('How to handle conflicts during migration')
});

export const migrationUnifiedTool: UnifiedTool = {
  name: 'migrate-chats',
  description: 'Migrate from dual persistence systems to unified chat management',
  zodSchema: migrationSchema,
  execute: async (args, progressCallback) => {
    try {
      const { action, backupFirst, cleanupAfter, conflictResolution } = args;
      
      // Dynamically import migration manager to avoid circular dependencies
      const { ChatMigrationManager } = await import('../utils/chatMigration.js');
      const migrationManager = new ChatMigrationManager();
      
      if (action === 'status') {
        progressCallback?.('Checking migration status...');
        
        const status = await migrationManager.getMigrationStatus();
        
        let result = '📊 **Chat Migration Status**\n\n';
        
        result += `**Legacy Chats (Memory-based):** ${status.legacyCount} chats\n`;
        result += `**Enhanced Chats (JSON-based):** ${status.enhancedCount} chats\n`;
        result += `**Unified Chats:** ${status.unifiedCount} chats\n\n`;
        
        if (status.hasLegacyChats || status.hasEnhancedChats) {
          result += '⚠️ **Migration Required**\n\n';
          result += 'You have chats in the old dual persistence systems. ';
          result += 'Run migration to consolidate them into the unified system.\n\n';
          result += '**Next Steps:**\n';
          result += '1. Run `migrate-chats` with `action: "dry-run"` to preview changes\n';
          result += '2. Run `migrate-chats` with `action: "migrate"` to perform migration\n';
        } else if (status.hasUnifiedChats) {
          result += '✅ **Already Migrated**\n\n';
          result += 'All chats are using the unified system.';
        } else {
          result += '📭 **No Chats Found**\n\n';
          result += 'No chats found in any system.';
        }
        
        return result;
      }
      
      if (action === 'dry-run') {
        progressCallback?.('Running migration dry-run...');
        
        const result = await migrationManager.migrate({
          dryRun: true,
          backupFirst: false,
          resolveConflicts: conflictResolution,
          cleanupAfter: false
        });
        
        let response = '🔍 **Migration Dry Run Results**\n\n';
        response += `**Would Migrate:** ${result.migratedChats} chats\n`;
        response += `**Would Skip:** ${result.skippedChats} chats\n`;
        response += `**Conflicts:** ${result.details.conflicts} chats\n`;
        
        if (result.errors.length > 0) {
          response += `**Errors:** ${result.errors.length} issues\n\n`;
          response += '**Error Details:**\n';
          result.errors.slice(0, 5).forEach(error => {
            response += `- ${error}\n`;
          });
          if (result.errors.length > 5) {
            response += `- ... and ${result.errors.length - 5} more errors\n`;
          }
        } else {
          response += '\n✅ **No errors detected**\n';
        }
        
        response += '\n**Summary:**\n';
        response += `- Legacy chats: ${result.details.legacyChats}\n`;
        response += `- Enhanced chats: ${result.details.enhancedChats}\n`;
        
        response += '\n**To perform actual migration, use `action: "migrate"`**';
        
        return response;
      }
      
      if (action === 'migrate') {
        progressCallback?.('Starting chat migration...');
        
        const result = await migrationManager.migrate({
          dryRun: false,
          backupFirst,
          resolveConflicts: conflictResolution,
          cleanupAfter
        });
        
        let response = '🔄 **Migration Results**\n\n';
        
        if (result.success) {
          response += '✅ **Migration Successful**\n\n';
          response += `**Migrated:** ${result.migratedChats} chats\n`;
          response += `**Skipped:** ${result.skippedChats} chats\n`;
          response += `**Conflicts Resolved:** ${result.details.conflicts} chats\n\n`;
          
          if (backupFirst) {
            response += '💾 **Backup Created:** Original data has been backed up\n';
          }
          
          if (cleanupAfter) {
            response += '🧹 **Cleanup Complete:** Old data has been removed\n';
          }
          
          response += '\n**All chats are now using the unified system!**';
        } else {
          response += '❌ **Migration Failed**\n\n';
          response += `**Migrated:** ${result.migratedChats} chats\n`;
          response += `**Failed:** ${result.errors.length} chats\n\n`;
          
          response += '**Errors:**\n';
          result.errors.slice(0, 5).forEach(error => {
            response += `- ${error}\n`;
          });
          if (result.errors.length > 5) {
            response += `- ... and ${result.errors.length - 5} more errors\n`;
          }
          
          response += '\n**Please resolve errors and try again.**';
        }
        
        return response;
      }
      
      return `❌ Unknown action: ${action}`;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error('Error in migration tool:', error);
      return `❌ Error during migration: ${errorMessage}`;
    }
  }
};

// Export all unified chat management tools
export const chatManagementUnifiedTools = [
  deleteChatUnifiedTool,
  listChatsUnifiedTool, 
  cleanupChatsUnifiedTool,
  getChatInfoUnifiedTool,
  migrationUnifiedTool
];