import { Logger } from './logger.js';
import { UnifiedChatManager } from '../managers/unifiedChatManager.js';
import { ChatManager } from '../managers/chatManager.js';
import { EnhancedChatManager } from '../managers/enhancedChatManager.js';
import { Chat, ChatSummary } from '../interfaces/chatPersistence.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Migration result interface
 */
export interface MigrationResult {
  success: boolean;
  migratedChats: number;
  skippedChats: number;
  errors: string[];
  details: {
    legacyChats: number;
    enhancedChats: number;
    conflicts: number;
  };
}

/**
 * Migration options
 */
export interface MigrationOptions {
  dryRun?: boolean;
  backupFirst?: boolean;
  resolveConflicts?: 'skip' | 'overwrite' | 'merge';
  cleanupAfter?: boolean;
}

/**
 * Chat Migration Utility
 * Handles migration from dual persistence systems to unified system
 */
export class ChatMigrationManager {
  private unifiedManager: UnifiedChatManager;
  private legacyManager: ChatManager;
  private enhancedManager: EnhancedChatManager;

  constructor() {
    this.unifiedManager = UnifiedChatManager.getInstance({
      persistenceType: 'json',
      enableLegacyCompatibility: true
    });
    this.legacyManager = ChatManager.getInstance();
    this.enhancedManager = EnhancedChatManager.getInstance();
  }

  /**
   * Main migration entry point
   */
  async migrate(options: MigrationOptions = {}): Promise<MigrationResult> {
    const { dryRun = false, backupFirst = true, resolveConflicts = 'skip', cleanupAfter = false } = options;

    Logger.info(`Starting chat migration (dry run: ${dryRun})`);
    
    const result: MigrationResult = {
      success: false,
      migratedChats: 0,
      skippedChats: 0,
      errors: [],
      details: {
        legacyChats: 0,
        enhancedChats: 0,
        conflicts: 0
      }
    };

    try {
      // Initialize all managers
      await this.unifiedManager.initialize();
      await this.enhancedManager.initialize();

      // Step 1: Create backup if requested
      if (backupFirst && !dryRun) {
        await this.createBackup();
      }

      // Step 2: Migrate from legacy ChatManager (memory-based)
      const legacyResult = await this.migrateLegacyChats(dryRun, resolveConflicts);
      result.details.legacyChats = legacyResult.count;
      result.migratedChats += legacyResult.migrated;
      result.skippedChats += legacyResult.skipped;
      result.errors.push(...legacyResult.errors);

      // Step 3: Migrate from enhanced ChatManager (JSON-based)
      const enhancedResult = await this.migrateEnhancedChats(dryRun, resolveConflicts);
      result.details.enhancedChats = enhancedResult.count;
      result.migratedChats += enhancedResult.migrated;
      result.skippedChats += enhancedResult.skipped;
      result.errors.push(...enhancedResult.errors);
      result.details.conflicts = enhancedResult.conflicts;

      // Step 4: Cleanup old data if requested
      if (cleanupAfter && !dryRun && result.errors.length === 0) {
        await this.cleanupOldData();
      }

      result.success = result.errors.length === 0;
      
      Logger.info(`Migration completed. Migrated: ${result.migratedChats}, Skipped: ${result.skippedChats}, Errors: ${result.errors.length}`);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error('Migration failed:', error);
      result.errors.push(`Migration failed: ${errorMessage}`);
      return result;
    }
  }

  /**
   * Migrate chats from legacy ChatManager (memory-based)
   */
  private async migrateLegacyChats(
    dryRun: boolean, 
    conflictResolution: 'skip' | 'overwrite' | 'merge'
  ): Promise<{ count: number; migrated: number; skipped: number; errors: string[]; conflicts: number }> {
    const result = { count: 0, migrated: 0, skipped: 0, errors: [], conflicts: 0 };

    try {
      // Get all legacy chats
      const legacyChats = await this.legacyManager.listChats();
      result.count = legacyChats.length;

      Logger.info(`Found ${legacyChats.length} legacy chats to migrate`);

      for (const summary of legacyChats) {
        try {
          // Get full chat data
          const legacyChat = await this.legacyManager.getChat(summary.id);
          if (!legacyChat) {
            result.errors.push(`Could not load legacy chat ${summary.id}`);
            continue;
          }

          // Convert legacy chat to unified format
          const unifiedChat: Chat = {
            id: `legacy_${summary.id}`, // Use legacy prefix
            title: legacyChat.title,
            participants: legacyChat.participants,
            messages: legacyChat.messages.map(msg => ({
              ...msg,
              chatId: `legacy_${summary.id}` // Update chatId in messages
            })),
            created: legacyChat.created,
            lastActivity: legacyChat.lastActivity,
            status: legacyChat.status,
            agentsWithHistory: legacyChat.agentsWithHistory
          };

          // Check for conflicts with existing unified chats
          const existingChat = await this.unifiedManager.getChatV2(unifiedChat.id);
          if (existingChat) {
            result.conflicts++;
            
            if (conflictResolution === 'skip') {
              result.skipped++;
              Logger.info(`Skipping legacy chat ${summary.id} due to conflict`);
              continue;
            } else if (conflictResolution === 'overwrite') {
              Logger.info(`Overwriting existing chat for legacy ${summary.id}`);
            }
            // 'merge' would require more complex logic - for now treat as overwrite
          }

          if (!dryRun) {
            // Create agent states for the unified system
            const agentStates: Record<string, any> = {};
            for (const participant of unifiedChat.participants) {
              agentStates[participant] = {
                lastSeenMessageId: unifiedChat.messages[unifiedChat.messages.length - 1]?.id || null,
                participationState: 'active',
                lastActiveAt: unifiedChat.lastActivity
              };
            }

            // Save to unified system (directly to persistence layer to avoid ID conflicts)
            const unifiedPersistence = (this.unifiedManager as any).persistence;
            await unifiedPersistence.saveChat(unifiedChat, agentStates);
          }

          result.migrated++;
          Logger.debug(`Migrated legacy chat ${summary.id} -> ${unifiedChat.id}`);

        } catch (error) {
          const errorMsg = `Failed to migrate legacy chat ${summary.id}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          Logger.error(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = `Failed to list legacy chats: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMsg);
      Logger.error(errorMsg);
    }

    return result;
  }

  /**
   * Migrate chats from enhanced ChatManager (JSON-based)
   */
  private async migrateEnhancedChats(
    dryRun: boolean,
    conflictResolution: 'skip' | 'overwrite' | 'merge'
  ): Promise<{ count: number; migrated: number; skipped: number; errors: string[]; conflicts: number }> {
    const result = { count: 0, migrated: 0, skipped: 0, errors: [], conflicts: 0 };

    try {
      // Get all enhanced chats
      const enhancedChats = await this.enhancedManager.listChats();
      result.count = enhancedChats.length;

      Logger.info(`Found ${enhancedChats.length} enhanced chats to migrate`);

      for (const summary of enhancedChats) {
        try {
          // Get full chat data
          const enhancedChat = await this.enhancedManager.getChat(summary.chatId);
          if (!enhancedChat) {
            result.errors.push(`Could not load enhanced chat ${summary.chatId}`);
            continue;
          }

          // Enhanced chats already use string IDs, so we can migrate them directly
          const unifiedId = enhancedChat.id;

          // Check for conflicts
          const existingChat = await this.unifiedManager.getChatV2(unifiedId);
          if (existingChat) {
            result.conflicts++;
            
            if (conflictResolution === 'skip') {
              result.skipped++;
              Logger.info(`Skipping enhanced chat ${summary.chatId} due to conflict`);
              continue;
            }
          }

          if (!dryRun) {
            // Get agent states from enhanced system
            const enhancedPersistence = await this.enhancedManager.getPersistence();
            const fullChatData = await enhancedPersistence.loadChat(summary.chatId);
            const agentStates = fullChatData?.agentStates || {};

            // Convert to unified format (minimal changes needed)
            const unifiedChat: Chat = {
              ...enhancedChat,
              agentsWithHistory: new Set(enhancedChat.participants)
            };

            // Save to unified system
            const unifiedPersistence = (this.unifiedManager as any).persistence;
            await unifiedPersistence.saveChat(unifiedChat, agentStates);
          }

          result.migrated++;
          Logger.debug(`Migrated enhanced chat ${summary.chatId}`);

        } catch (error) {
          const errorMsg = `Failed to migrate enhanced chat ${summary.chatId}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          Logger.error(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = `Failed to list enhanced chats: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMsg);
      Logger.error(errorMsg);
    }

    return result;
  }

  /**
   * Create backup of existing chat data
   */
  private async createBackup(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'backups', `chat-backup-${timestamp}`);
    
    try {
      await fs.mkdir(backupDir, { recursive: true });

      // Backup enhanced chats (they have persistent files)
      const enhancedPaths = this.enhancedManager.getStoragePaths();
      if (enhancedPaths.storage) {
        try {
          const backupEnhancedDir = path.join(backupDir, 'enhanced-chats');
          await fs.mkdir(backupEnhancedDir, { recursive: true });
          
          // Copy all JSON files from enhanced storage
          const files = await fs.readdir(enhancedPaths.storage);
          for (const file of files) {
            if (file.endsWith('.json')) {
              const sourcePath = path.join(enhancedPaths.storage, file);
              const destPath = path.join(backupEnhancedDir, file);
              await fs.copyFile(sourcePath, destPath);
            }
          }
          
          Logger.info(`Enhanced chats backed up to: ${backupEnhancedDir}`);
        } catch (error) {
          Logger.warn('Failed to backup enhanced chats:', error);
        }
      }

      // Backup legacy chats (export to JSON since they're in memory)
      try {
        const legacyChats = await this.legacyManager.listChats();
        const legacyData = [];
        
        for (const summary of legacyChats) {
          const chat = await this.legacyManager.getChat(summary.id);
          if (chat) {
            // Convert Set to Array for JSON serialization
            const serializableChat = {
              ...chat,
              agentsWithHistory: Array.from(chat.agentsWithHistory || [])
            };
            legacyData.push(serializableChat);
          }
        }
        
        const legacyBackupPath = path.join(backupDir, 'legacy-chats.json');
        await fs.writeFile(legacyBackupPath, JSON.stringify(legacyData, null, 2));
        Logger.info(`Legacy chats backed up to: ${legacyBackupPath}`);
      } catch (error) {
        Logger.warn('Failed to backup legacy chats:', error);
      }

      Logger.info(`Backup created at: ${backupDir}`);
    } catch (error) {
      Logger.error('Failed to create backup:', error);
      throw error;
    }
  }

  /**
   * Clean up old data after successful migration
   */
  private async cleanupOldData(): Promise<void> {
    Logger.info('Cleaning up old data after migration...');
    
    try {
      // Clean up enhanced chats storage
      const enhancedPaths = this.enhancedManager.getStoragePaths();
      if (enhancedPaths.storage) {
        try {
          const files = await fs.readdir(enhancedPaths.storage);
          for (const file of files) {
            if (file.endsWith('.json')) {
              const filePath = path.join(enhancedPaths.storage, file);
              await fs.unlink(filePath);
            }
          }
          Logger.info('Enhanced chats storage cleaned up');
        } catch (error) {
          Logger.warn('Failed to cleanup enhanced chats storage:', error);
        }
      }

      // Reset legacy manager (clear memory)
      this.legacyManager.reset();
      Logger.info('Legacy chats memory cleared');

    } catch (error) {
      Logger.error('Failed to cleanup old data:', error);
    }
  }

  /**
   * Get migration status/report
   */
  async getMigrationStatus(): Promise<{
    hasLegacyChats: boolean;
    hasEnhancedChats: boolean;
    hasUnifiedChats: boolean;
    legacyCount: number;
    enhancedCount: number;
    unifiedCount: number;
  }> {
    try {
      // Check legacy chats
      let legacyCount = 0;
      let hasLegacyChats = false;
      try {
        const legacyChats = await this.legacyManager.listChats();
        legacyCount = legacyChats.length;
        hasLegacyChats = legacyCount > 0;
      } catch (error) {
        Logger.debug('Could not check legacy chats:', error);
      }

      // Check enhanced chats
      let enhancedCount = 0;
      let hasEnhancedChats = false;
      try {
        await this.enhancedManager.initialize();
        const enhancedChats = await this.enhancedManager.listChats();
        enhancedCount = enhancedChats.length;
        hasEnhancedChats = enhancedCount > 0;
      } catch (error) {
        Logger.debug('Could not check enhanced chats:', error);
      }

      // Check unified chats
      let unifiedCount = 0;
      let hasUnifiedChats = false;
      try {
        await this.unifiedManager.initialize();
        const unifiedChats = await this.unifiedManager.listChats();
        unifiedCount = unifiedChats.length;
        hasUnifiedChats = unifiedCount > 0;
      } catch (error) {
        Logger.debug('Could not check unified chats:', error);
      }

      return {
        hasLegacyChats,
        hasEnhancedChats,
        hasUnifiedChats,
        legacyCount,
        enhancedCount,
        unifiedCount
      };
    } catch (error) {
      Logger.error('Failed to get migration status:', error);
      throw error;
    }
  }
}