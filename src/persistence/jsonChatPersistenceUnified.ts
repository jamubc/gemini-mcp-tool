import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Logger } from '../utils/logger.js';
import { 
  IChatPersistence, 
  Chat, 
  ChatMessage, 
  ChatSummary, 
  ChatData, 
  ListChatOptions, 
  CleanupResult, 
  AgentState 
} from '../interfaces/chatPersistence.js';

export interface UnifiedChatFileData {
  metadata: {
    chatId: string;
    timestamp: number;
    title: string;
    created: string;
    lastActivity: string;
    participants: string[];
    lastAccessTime: string;
    status: 'active' | 'archived';
    agentsWithHistory: string[];
  };
  messages: ChatMessage[];
  agentStates: Record<string, AgentState>;
}

/**
 * Unified JSON Chat Persistence Implementation
 * Provides file-based storage with compatibility for both legacy and new systems
 */
export class UnifiedJsonChatPersistence implements IChatPersistence {
  private basePath: string;
  private storagePath: string;
  private geminiPath: string;
  private processId: string;
  private initialized = false;
  
  constructor() {
    // Use process PID + timestamp for unique folder identification
    this.processId = `${process.pid}-${Date.now()}`;
    this.basePath = join(tmpdir(), `unified-gemini-mcp-${this.processId}`);
    this.storagePath = join(this.basePath, 'storage');
    this.geminiPath = join(this.basePath, 'gemini');
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await fs.mkdir(this.basePath, { recursive: true });
      await fs.mkdir(this.storagePath, { recursive: true });
      await fs.mkdir(this.geminiPath, { recursive: true });
      
      this.initialized = true;
      Logger.info(`Unified JSON persistence initialized at: ${this.basePath}`);
    } catch (error) {
      Logger.error('Failed to initialize unified JSON persistence:', error);
      throw error;
    }
  }

  async saveChat(chat: Chat, agentStates?: Record<string, AgentState>): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    try {
      const now = Date.now();
      const agentsWithHistoryArray = chat.agentsWithHistory 
        ? Array.from(chat.agentsWithHistory)
        : chat.participants;

      const fileData: UnifiedChatFileData = {
        metadata: {
          chatId: chat.id,
          timestamp: now,
          title: chat.title,
          created: chat.created.toISOString(),
          lastActivity: chat.lastActivity.toISOString(),
          participants: [...chat.participants],
          lastAccessTime: new Date(now).toISOString(),
          status: chat.status,
          agentsWithHistory: agentsWithHistoryArray
        },
        messages: chat.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })),
        agentStates: agentStates || {}
      };

      const filename = `chat-${chat.id}.json`;
      const filePath = join(this.storagePath, filename);
      
      await fs.writeFile(filePath, JSON.stringify(fileData, null, 2), 'utf8');
      
      Logger.debug(`Saved unified chat ${chat.id} to ${filePath}`);
    } catch (error) {
      Logger.error(`Failed to save unified chat ${chat.id}:`, error);
      throw error;
    }
  }

  async loadChat(chatId: string): Promise<ChatData | null> {
    if (!this.initialized) {
      await this.init();
    }

    try {
      const filename = `chat-${chatId}.json`;
      const filePath = join(this.storagePath, filename);
      
      const fileContent = await fs.readFile(filePath, 'utf8');
      const fileData: UnifiedChatFileData = JSON.parse(fileContent);
      
      // Convert back to Chat object
      const chat: Chat = {
        id: fileData.metadata.chatId,
        title: fileData.metadata.title,
        participants: fileData.metadata.participants,
        messages: fileData.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })),
        created: new Date(fileData.metadata.created),
        lastActivity: new Date(fileData.metadata.lastActivity),
        status: fileData.metadata.status,
        agentsWithHistory: new Set(fileData.metadata.agentsWithHistory || [])
      };

      // Convert AgentState dates
      const agentStates: Record<string, AgentState> = {};
      for (const [agentId, state] of Object.entries(fileData.agentStates)) {
        agentStates[agentId] = {
          ...state,
          lastActiveAt: state.lastActiveAt ? new Date(state.lastActiveAt) : new Date()
        };
      }

      // Update last access time
      fileData.metadata.lastAccessTime = new Date().toISOString();
      await fs.writeFile(filePath, JSON.stringify(fileData, null, 2), 'utf8');
      
      Logger.debug(`Loaded unified chat ${chatId} from ${filePath}`);
      
      return {
        chat,
        agentStates
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null; // Chat not found
      }
      Logger.error(`Failed to load unified chat ${chatId}:`, error);
      throw error;
    }
  }

  async listChats(options?: ListChatOptions): Promise<ChatSummary[]> {
    if (!this.initialized) {
      await this.init();
    }

    try {
      const {
        status = 'active',
        limit,
        offset = 0,
        agentFilter
      } = options || {};

      const files = await fs.readdir(this.storagePath);
      const chatFiles = files.filter(file => file.startsWith('chat-') && file.endsWith('.json'));
      
      const summaries: ChatSummary[] = [];

      for (const file of chatFiles) {
        try {
          const filePath = join(this.storagePath, file);
          const fileContent = await fs.readFile(filePath, 'utf8');
          const fileData: UnifiedChatFileData = JSON.parse(fileContent);
          
          // Filter by status
          if (status !== 'all' && fileData.metadata.status !== status) {
            continue;
          }

          // Filter by agent
          if (agentFilter && !fileData.metadata.participants.includes(agentFilter)) {
            continue;
          }

          summaries.push({
            chatId: fileData.metadata.chatId,
            title: fileData.metadata.title,
            participantCount: fileData.metadata.participants.length,
            messageCount: fileData.messages.length,
            lastActivity: new Date(fileData.metadata.lastActivity),
            status: fileData.metadata.status,
            createdAt: new Date(fileData.metadata.created),
            lastAccessTime: new Date(fileData.metadata.lastAccessTime)
          });
        } catch (error) {
          Logger.warn(`Failed to parse chat file ${file}:`, error);
        }
      }

      // Sort by last activity (most recent first)
      summaries.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

      // Apply pagination
      const startIndex = Math.max(0, offset);
      const endIndex = limit ? startIndex + limit : summaries.length;
      
      return summaries.slice(startIndex, endIndex);
    } catch (error) {
      Logger.error('Failed to list unified chats:', error);
      throw error;
    }
  }

  async deleteChat(chatId: string): Promise<boolean> {
    if (!this.initialized) {
      await this.init();
    }

    try {
      const filename = `chat-${chatId}.json`;
      const filePath = join(this.storagePath, filename);
      
      await fs.unlink(filePath);
      Logger.info(`Deleted unified chat ${chatId} from ${filePath}`);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        Logger.warn(`Chat ${chatId} not found for deletion`);
        return false;
      }
      Logger.error(`Failed to delete unified chat ${chatId}:`, error);
      throw error;
    }
  }

  async cleanupExpiredFiles(): Promise<CleanupResult> {
    if (!this.initialized) {
      await this.init();
    }

    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    let deletedCount = 0;
    let errors = 0;
    const details: string[] = [];

    try {
      const files = await fs.readdir(this.storagePath);
      const chatFiles = files.filter(file => file.startsWith('chat-') && file.endsWith('.json'));

      for (const file of chatFiles) {
        try {
          const filePath = join(this.storagePath, file);
          const fileContent = await fs.readFile(filePath, 'utf8');
          const fileData: UnifiedChatFileData = JSON.parse(fileContent);
          
          const lastAccessTime = new Date(fileData.metadata.lastAccessTime);
          
          if (lastAccessTime < cutoffTime) {
            await fs.unlink(filePath);
            deletedCount++;
            details.push(`Deleted expired chat: ${fileData.metadata.chatId} (${fileData.metadata.title})`);
          }
        } catch (error) {
          errors++;
          details.push(`Failed to process ${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Also cleanup Gemini temporary files
      try {
        const geminiFiles = await fs.readdir(this.geminiPath);
        for (const file of geminiFiles) {
          try {
            const filePath = join(this.geminiPath, file);
            const stats = await fs.stat(filePath);
            
            if (stats.mtime < cutoffTime) {
              await fs.unlink(filePath);
              details.push(`Deleted expired Gemini file: ${file}`);
            }
          } catch (error) {
            errors++;
            details.push(`Failed to cleanup Gemini file ${file}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      } catch (error) {
        Logger.debug('No Gemini files to cleanup:', error);
      }

      Logger.info(`Unified cleanup completed: ${deletedCount} deleted, ${errors} errors`);
      
      return {
        deletedCount,
        errors,
        details
      };
    } catch (error) {
      Logger.error('Failed to cleanup expired unified files:', error);
      return {
        deletedCount: 0,
        errors: 1,
        details: [`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  getStoragePaths(): { base: string; storage: string; gemini: string } {
    return {
      base: this.basePath,
      storage: this.storagePath,
      gemini: this.geminiPath
    };
  }

  // Legacy compatibility methods
  getBasePath(): string {
    return this.basePath;
  }

  getStoragePath(): string {
    return this.storagePath;
  }

  getGeminiPath(): string {
    return this.geminiPath;
  }

  // Utility methods for debugging and management
  async getChatCount(): Promise<number> {
    if (!this.initialized) {
      await this.init();
    }

    try {
      const files = await fs.readdir(this.storagePath);
      const chatFiles = files.filter(file => file.startsWith('chat-') && file.endsWith('.json'));
      return chatFiles.length;
    } catch (error) {
      Logger.error('Failed to get chat count:', error);
      return 0;
    }
  }

  async getStorageUsage(): Promise<{
    chatCount: number;
    totalSizeBytes: number;
    totalSizeMB: number;
  }> {
    if (!this.initialized) {
      await this.init();
    }

    let chatCount = 0;
    let totalSizeBytes = 0;

    try {
      const files = await fs.readdir(this.storagePath);
      const chatFiles = files.filter(file => file.startsWith('chat-') && file.endsWith('.json'));
      
      for (const file of chatFiles) {
        try {
          const filePath = join(this.storagePath, file);
          const stats = await fs.stat(filePath);
          totalSizeBytes += stats.size;
          chatCount++;
        } catch (error) {
          Logger.debug(`Failed to stat file ${file}:`, error);
        }
      }
    } catch (error) {
      Logger.error('Failed to calculate storage usage:', error);
    }

    return {
      chatCount,
      totalSizeBytes,
      totalSizeMB: totalSizeBytes / (1024 * 1024)
    };
  }
}