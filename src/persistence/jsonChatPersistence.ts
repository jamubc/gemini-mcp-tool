import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Logger } from '../utils/logger.js';
import { Chat, ChatMessage } from '../managers/chatManager.js';

export type ParticipationState = 'new' | 'returning' | 'continuous';

export interface AgentState {
  lastSeenMessageId: string | null;
  participationState: ParticipationState;
  lastActiveAt: Date | null;
}

export interface ChatFileData {
  metadata: {
    chatId: string;
    timestamp: number;
    title: string;
    created: string;
    lastActivity: string;
    participants: string[];
    lastAccessTime: string;
    status: 'active' | 'archived';
    agentsWithHistory?: string[];
  };
  messages: ChatMessage[];
  agentStates: Record<string, AgentState>;
}

export class JsonChatPersistence {
  private basePath: string;
  private storagePath: string;
  private geminiPath: string;
  private processId: string;
  
  constructor() {
    // Use process PID + timestamp for unique folder identification
    this.processId = `${process.pid}-${Date.now()}`;
    this.basePath = join(tmpdir(), `gemini-mcp-${this.processId}`);
    this.storagePath = join(this.basePath, 'storage');
    this.geminiPath = join(this.basePath, 'gemini');
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
      await fs.mkdir(this.storagePath, { recursive: true });
      await fs.mkdir(this.geminiPath, { recursive: true });
      
      // Cleanup any old files on startup
      await this.cleanupExpiredFiles();
      
      Logger.info(`JsonChatPersistence initialized at: ${this.basePath}`);
    } catch (error) {
      Logger.error('Failed to initialize JsonChatPersistence:', error);
      throw error;
    }
  }

  private getStorageFilePath(chatId: string, timestamp?: number): string {
    const ts = timestamp || Date.now();
    return join(this.storagePath, `chat-${ts}-${chatId}.json`);
  }

  private getGeminiFilePath(chatId: string): string {
    return join(this.geminiPath, `chat-${chatId}.json`);
  }

  async saveChat(chat: Chat, agentStates: Record<string, AgentState>): Promise<void> {
    const timestamp = Date.now();
    const filePath = this.getStorageFilePath(chat.id, timestamp);
    
    const chatData: ChatFileData = {
      metadata: {
        chatId: chat.id,
        timestamp,
        title: chat.title,
        created: (chat.created || new Date()).toISOString(),
        lastActivity: (chat.lastActivity || new Date()).toISOString(),
        participants: chat.participants,
        lastAccessTime: new Date().toISOString(),
        status: chat.status,
        agentsWithHistory: chat.agentsWithHistory ? Array.from(chat.agentsWithHistory) : []
      },
      messages: chat.messages,
      agentStates
    };

    try {
      await fs.writeFile(filePath, JSON.stringify(chatData, null, 2), 'utf8');
      
      // Remove any older versions of this chat
      await this.cleanupOldChatVersions(chat.id, timestamp);
      
      Logger.debug(`Chat ${chat.id} saved to: ${filePath}`);
    } catch (error) {
      Logger.error(`Failed to save chat ${chat.id}:`, error);
      throw error;
    }
  }

  async loadChat(chatId: string): Promise<{ chat: Chat; agentStates: Record<string, AgentState> } | null> {
    try {
      const filePath = await this.findLatestChatFile(chatId);
      if (!filePath) {
        return null;
      }

      const fileContent = await fs.readFile(filePath, 'utf8');
      const chatData: ChatFileData = JSON.parse(fileContent);

      // Update last access time
      chatData.metadata.lastAccessTime = new Date().toISOString();
      await fs.writeFile(filePath, JSON.stringify(chatData, null, 2), 'utf8');

      // Reconstruct Chat object
      const chat: Chat = {
        id: chatData.metadata.chatId,
        title: chatData.metadata.title,
        participants: chatData.metadata.participants,
        messages: chatData.messages,
        created: new Date(chatData.metadata.created),
        lastActivity: new Date(chatData.metadata.lastActivity),
        status: chatData.metadata.status,
        agentsWithHistory: chatData.metadata.agentsWithHistory ? new Set(chatData.metadata.agentsWithHistory) : new Set()
      };

      return { chat, agentStates: chatData.agentStates };
    } catch (error) {
      Logger.error(`Failed to load chat ${chatId}:`, error);
      return null;
    }
  }

  async listChats(): Promise<Array<{ chatId: string; title: string; lastAccessTime: Date; createdAt: Date }>> {
    try {
      const files = await fs.readdir(this.storagePath);
      const chatFiles = files.filter(file => file.startsWith('chat-') && file.endsWith('.json'));
      
      const chats = [];
      for (const file of chatFiles) {
        try {
          const filePath = join(this.storagePath, file);
          const fileContent = await fs.readFile(filePath, 'utf8');
          const chatData: ChatFileData = JSON.parse(fileContent);
          
          chats.push({
            chatId: chatData.metadata.chatId,
            title: chatData.metadata.title,
            lastAccessTime: new Date(chatData.metadata.lastAccessTime),
            createdAt: new Date(chatData.metadata.created)
          });
        } catch (error) {
          Logger.warn(`Failed to read chat file ${file}:`, error);
        }
      }

      // Sort by last access time, most recent first
      return chats.sort((a, b) => b.lastAccessTime.getTime() - a.lastAccessTime.getTime());
    } catch (error) {
      Logger.error('Failed to list chats:', error);
      return [];
    }
  }

  async deleteChat(chatId: string): Promise<boolean> {
    try {
      // Delete storage file
      const storageFiles = await fs.readdir(this.storagePath);
      const chatFiles = storageFiles.filter(file => 
        file.includes(`-${chatId}.json`) && file.startsWith('chat-')
      );

      for (const file of chatFiles) {
        await fs.unlink(join(this.storagePath, file));
        Logger.debug(`Deleted storage file: ${file}`);
      }

      // Delete Gemini file if exists
      const geminiFilePath = this.getGeminiFilePath(chatId);
      try {
        await fs.unlink(geminiFilePath);
        Logger.debug(`Deleted Gemini file for chat ${chatId}`);
      } catch (error) {
        // File might not exist, that's okay
        Logger.debug(`Gemini file for chat ${chatId} not found (this is normal)`);
      }

      Logger.info(`Chat ${chatId} deleted successfully`);
      return true;
    } catch (error) {
      Logger.error(`Failed to delete chat ${chatId}:`, error);
      return false;
    }
  }

  async cleanupExpiredFiles(): Promise<{ deletedCount: number; errors: number }> {
    const now = Date.now();
    const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
    let deletedCount = 0;
    let errors = 0;

    try {
      const files = await fs.readdir(this.storagePath);
      const chatFiles = files.filter(file => file.startsWith('chat-') && file.endsWith('.json'));

      for (const file of chatFiles) {
        try {
          const filePath = join(this.storagePath, file);
          const fileContent = await fs.readFile(filePath, 'utf8');
          const chatData: ChatFileData = JSON.parse(fileContent);
          
          const lastAccess = new Date(chatData.metadata.lastAccessTime).getTime();
          const isExpired = (now - lastAccess) > TTL_MS;

          if (isExpired) {
            await fs.unlink(filePath);
            
            // Also delete corresponding Gemini file
            const geminiFilePath = this.getGeminiFilePath(chatData.metadata.chatId);
            try {
              await fs.unlink(geminiFilePath);
            } catch {
              // Gemini file might not exist
            }

            Logger.debug(`Deleted expired chat: ${chatData.metadata.chatId} (last access: ${new Date(lastAccess).toISOString()})`);
            deletedCount++;
          }
        } catch (error) {
          Logger.warn(`Failed to process file ${file} during cleanup:`, error);
          errors++;
        }
      }

      Logger.info(`Cleanup completed: ${deletedCount} expired chats deleted, ${errors} errors`);
      return { deletedCount, errors };
    } catch (error) {
      Logger.error('Failed to cleanup expired files:', error);
      return { deletedCount: 0, errors: 1 };
    }
  }

  private async findLatestChatFile(chatId: string): Promise<string | null> {
    try {
      const files = await fs.readdir(this.storagePath);
      const chatFiles = files.filter(file => 
        file.includes(`-${chatId}.json`) && file.startsWith('chat-')
      );

      if (chatFiles.length === 0) {
        return null;
      }

      // Extract timestamps and find the latest
      const filesWithTimestamps = chatFiles.map(file => {
        const match = file.match(/chat-(\d+)-(.+)\.json$/);
        return {
          file,
          timestamp: match ? parseInt(match[1]) : 0
        };
      });

      filesWithTimestamps.sort((a, b) => b.timestamp - a.timestamp);
      return join(this.storagePath, filesWithTimestamps[0].file);
    } catch (error) {
      Logger.error(`Failed to find latest chat file for ${chatId}:`, error);
      return null;
    }
  }

  private async cleanupOldChatVersions(chatId: string, keepTimestamp: number): Promise<void> {
    try {
      const files = await fs.readdir(this.storagePath);
      const oldChatFiles = files.filter(file => {
        const match = file.match(/chat-(\d+)-(.+)\.json$/);
        return match && match[2] === `${chatId}` && parseInt(match[1]) !== keepTimestamp;
      });

      for (const file of oldChatFiles) {
        await fs.unlink(join(this.storagePath, file));
        Logger.debug(`Cleaned up old chat version: ${file}`);
      }
    } catch (error) {
      Logger.warn(`Failed to cleanup old versions of chat ${chatId}:`, error);
    }
  }

  getBasePath(): string {
    return this.basePath;
  }

  getStoragePath(): string {
    return this.storagePath;
  }

  getGeminiPath(): string {
    return this.geminiPath;
  }
}