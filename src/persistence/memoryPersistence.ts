// In-memory persistence implementation for inter-agent chat system
// As per PLAN.md: "Memory-Only Storage: Simple, fast access with automatic cleanup on server restart"

import { Chat, ChatMessage, ChatSummary } from '../managers/chatManager.js';

export interface MemoryPersistenceProvider {
  saveChat(chat: Chat): Promise<void>;
  loadChat(chatId: string): Promise<Chat | null>;
  listChats(options?: {
    agentName?: string;
    status?: 'active' | 'archived' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<ChatSummary[]>;
  deleteChat(chatId: string): Promise<void>;
  init(): Promise<void>;
  // Additional methods for compatibility with performance tests
  createChat(agentId: string, title: string): Promise<string>;
  saveMessage(chatId: string, agentId: string, message: string): Promise<void>;
  getMessages(chatId: string, options?: { limit?: number; offset?: number }): Promise<ChatMessage[]>;
}

/**
 * Simple in-memory storage that resets on server restart
 * Follows the core design principle of "Memory-Only Storage"
 */
export class InMemoryPersistence implements MemoryPersistenceProvider {
  private chats = new Map<string, Chat>();

  async init(): Promise<void> {
    // No initialization needed for in-memory storage
  }

  async saveChat(chat: Chat): Promise<void> {
    // Simple in-memory storage - just keep the reference
    this.chats.set(chat.id, chat);
  }

  async loadChat(chatId: string): Promise<Chat | null> {
    return this.chats.get(chatId) || null;
  }


  async listChats(options?: {
    agentName?: string;
    status?: 'active' | 'archived' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<ChatSummary[]> {
    const allChats = Array.from(this.chats.values());
    
    // Filter by status
    let filteredChats = allChats;
    if (options?.status && options.status !== 'all') {
      filteredChats = allChats.filter(chat => chat.status === options.status);
    }

    // Filter by agent (if agent is a participant)
    if (options?.agentName) {
      filteredChats = filteredChats.filter(chat => 
        chat.participants.includes(options.agentName!)
      );
    }

    // Convert to summaries
    const summaries: ChatSummary[] = filteredChats.map(chat => ({
      id: parseInt(chat.id),
      title: chat.title,
      participantCount: chat.participants.length,
      messageCount: chat.messages.length,
      lastActivity: chat.lastActivity,
      status: chat.status
    }));

    // Sort by last activity (most recent first)
    summaries.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    
    return summaries.slice(offset, offset + limit);
  }

  async deleteChat(chatId: string): Promise<void> {
    this.chats.delete(chatId);
  }

  // Additional methods for compatibility with performance tests
  async createChat(agentId: string, title: string): Promise<string> {
    const chatId = (this.chats.size + 1).toString();
    const chat: Chat = {
      id: chatId,
      title,
      participants: [agentId],
      messages: [],
      created: new Date(),
      lastActivity: new Date(),
      status: 'active',
      agentsWithHistory: new Set([agentId])
    };
    
    await this.saveChat(chat);
    return chatId;
  }

  async saveMessage(chatId: string, agentId: string, message: string): Promise<void> {
    let chat = await this.loadChat(chatId);
    if (!chat) {
      // Auto-create chat if it doesn't exist (for test compatibility)
      const newChatId = await this.createChat(agentId, `Auto-created chat ${chatId}`);
      // Update the chat to use the requested chatId instead of the generated one
      chat = await this.loadChat(newChatId);
      if (chat) {
        chat.id = chatId; // Use the requested chatId
        await this.saveChat(chat);
      }
    }

    const chatMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2)}`,
      chatId,
      agent: agentId,
      message,
      timestamp: new Date(),
      sanitized: true
    };

    chat.messages.push(chatMessage);
    if (!chat.participants.includes(agentId)) {
      chat.participants.push(agentId);
    }
    if (!chat.agentsWithHistory) {
      chat.agentsWithHistory = new Set();
    }
    chat.agentsWithHistory.add(agentId);
    chat.lastActivity = new Date();

    await this.saveChat(chat);
  }

  async getMessages(chatId: string, options?: { limit?: number; offset?: number }): Promise<ChatMessage[]> {
    const chat = await this.loadChat(chatId);
    if (!chat) {
      return [];
    }

    const { limit = 100, offset = 0 } = options || {};
    return chat.messages.slice(offset, offset + limit);
  }

  // Utility methods for testing and management
  clear(): void {
    this.chats.clear();
  }

  size(): number {
    return this.chats.size;
  }
}