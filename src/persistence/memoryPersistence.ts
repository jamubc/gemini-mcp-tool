// In-memory persistence implementation for inter-agent chat system
// As per PLAN.md: "Memory-Only Storage: Simple, fast access with automatic cleanup on server restart"

import { Chat, ChatMessage, ChatSummary } from '../managers/chatManager.js';

export interface MemoryPersistenceProvider {
  saveChat(chat: Chat): Promise<void>;
  loadChat(chatId: string): Promise<Chat | null>;
  saveMessage(message: ChatMessage): Promise<void>;
  listChats(options?: {
    agentName?: string;
    status?: 'active' | 'archived' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<ChatSummary[]>;
  deleteChat(chatId: string): Promise<void>;
  init(): Promise<void>;
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

  async saveMessage(message: ChatMessage): Promise<void> {
    // Messages are saved as part of the chat object
    // No separate storage needed for in-memory implementation
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

  // Utility methods for testing and management
  clear(): void {
    this.chats.clear();
  }

  size(): number {
    return this.chats.size;
  }
}