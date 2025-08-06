// Unified in-memory persistence implementation for chat system
// Implements IChatPersistence interface for compatibility with UnifiedChatManager

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
import { Logger } from '../utils/logger.js';

/**
 * Unified In-Memory Persistence Implementation
 * Provides memory-only storage that resets on server restart
 * Compatible with both legacy and new chat management systems
 */
export class UnifiedInMemoryPersistence implements IChatPersistence {
  private chats = new Map<string, ChatData>();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    this.chats.clear();
    this.initialized = true;
    Logger.info('Unified in-memory persistence initialized (data will be lost on server restart)');
  }

  async saveChat(chat: Chat, agentStates?: Record<string, AgentState>): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    const chatData: ChatData = {
      chat: {
        ...chat,
        // Ensure agentsWithHistory is a Set
        agentsWithHistory: chat.agentsWithHistory || new Set(chat.participants)
      },
      agentStates: agentStates || {}
    };

    this.chats.set(chat.id, chatData);
    Logger.debug(`Saved chat ${chat.id} to memory (${chat.messages.length} messages)`);
  }

  async loadChat(chatId: string): Promise<ChatData | null> {
    if (!this.initialized) {
      await this.init();
    }

    const chatData = this.chats.get(chatId);
    if (!chatData) {
      return null;
    }

    // Ensure agentsWithHistory is a Set when loading
    if (chatData.chat.agentsWithHistory && !(chatData.chat.agentsWithHistory instanceof Set)) {
      chatData.chat.agentsWithHistory = new Set(chatData.chat.participants);
    }

    return chatData;
  }

  async listChats(options?: ListChatOptions): Promise<ChatSummary[]> {
    if (!this.initialized) {
      await this.init();
    }

    const {
      status = 'active',
      limit,
      offset = 0,
      agentFilter
    } = options || {};

    let chats = Array.from(this.chats.values());

    // Filter by status
    if (status !== 'all') {
      chats = chats.filter(chatData => chatData.chat.status === status);
    }

    // Filter by agent
    if (agentFilter) {
      chats = chats.filter(chatData => 
        chatData.chat.participants.includes(agentFilter)
      );
    }

    // Sort by last activity (most recent first)
    chats.sort((a, b) => b.chat.lastActivity.getTime() - a.chat.lastActivity.getTime());

    // Apply pagination
    const startIndex = Math.max(0, offset);
    const endIndex = limit ? startIndex + limit : chats.length;
    const paginatedChats = chats.slice(startIndex, endIndex);

    // Convert to ChatSummary format
    return paginatedChats.map(chatData => {
      const chat = chatData.chat;
      return {
        chatId: chat.id,
        title: chat.title,
        participantCount: chat.participants.length,
        messageCount: chat.messages.length,
        lastActivity: chat.lastActivity,
        status: chat.status,
        createdAt: chat.created,
        lastAccessTime: chat.lastActivity // Use lastActivity as lastAccessTime for memory
      };
    });
  }

  async deleteChat(chatId: string): Promise<boolean> {
    if (!this.initialized) {
      await this.init();
    }

    const existed = this.chats.has(chatId);
    this.chats.delete(chatId);
    
    if (existed) {
      Logger.info(`Deleted chat ${chatId} from memory`);
    }
    
    return existed;
  }

  // Optional cleanup method (no-op for memory storage)
  async cleanupExpiredFiles(): Promise<CleanupResult> {
    // Memory storage doesn't have "expired files" concept
    // But we can clean up very old chats if needed
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    let deletedCount = 0;

    for (const [chatId, chatData] of this.chats.entries()) {
      if (chatData.chat.lastActivity < cutoffTime) {
        this.chats.delete(chatId);
        deletedCount++;
      }
    }

    Logger.info(`Cleaned up ${deletedCount} expired chats from memory`);
    
    return {
      deletedCount,
      errors: 0,
      details: [`Removed ${deletedCount} chats older than 24 hours`]
    };
  }

  // Optional storage paths method
  getStoragePaths(): { base?: string; storage?: string; gemini?: string } {
    return {
      base: 'memory://',
      storage: 'memory://chats',
      gemini: 'memory://gemini-temp'
    };
  }

  // Utility methods for debugging and testing
  getChatCount(): number {
    return this.chats.size;
  }

  clear(): void {
    this.chats.clear();
    Logger.debug('Cleared all chats from memory');
  }

  getMemoryUsage(): { 
    chatCount: number; 
    totalMessages: number; 
    estimatedSizeMB: number;
  } {
    let totalMessages = 0;
    let estimatedBytes = 0;

    for (const chatData of this.chats.values()) {
      const chat = chatData.chat;
      totalMessages += chat.messages.length;
      
      // Rough size estimation
      estimatedBytes += JSON.stringify(chatData).length * 2; // UTF-16
    }

    return {
      chatCount: this.chats.size,
      totalMessages,
      estimatedSizeMB: estimatedBytes / (1024 * 1024)
    };
  }
}