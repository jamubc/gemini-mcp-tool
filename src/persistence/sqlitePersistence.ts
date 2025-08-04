import { Logger } from '../utils/logger.js';
import { Chat, ChatMessage, AgentIdentity } from '../managers/chatManager.js';

// Basic SQLite persistence interface (minimal implementation for testing)
export interface PersistenceProvider {
  saveChat(chat: Chat): Promise<void>;
  loadChat(chatId: string): Promise<Chat | null>;
  deleteChat(chatId: string): Promise<void>;
  listChats(options?: ListOptions): Promise<ChatSummary[]>;
  saveMessage(message: ChatMessage): Promise<void>;
  loadMessages(chatId: string, options?: MessageQueryOptions): Promise<ChatMessage[]>;
  getStats(): { chatCount: number; messageCount: number; [key: string]: any }; // Add getStats method
}

export interface ListOptions {
  status?: 'active' | 'archived' | 'all';
  limit?: number;
  offset?: number;
}

export interface MessageQueryOptions {
  limit?: number;
  offset?: number;
  afterTimestamp?: Date;
}

export interface ChatSummary {
  id: number; // Changed to match ChatManager expectations
  title: string;
  participantCount: number;
  messageCount: number;
  lastActivity: Date;
  status: 'active' | 'archived';
}

// Basic SQLite persistence implementation (in-memory for initial testing)
export class SQLitePersistence implements PersistenceProvider {
  private chats = new Map<string, Chat>();
  private messages = new Map<string, ChatMessage[]>();

  constructor(private dbPath?: string) {
    Logger.info(`SQLitePersistence initialized with path: ${dbPath || 'in-memory'}`);
  }

  async saveChat(chat: Chat): Promise<void> {
    this.chats.set(chat.id, { ...chat });
    Logger.info(`Chat saved: ${chat.id}`);
  }

  async loadChat(chatId: string): Promise<Chat | null> {
    const chat = this.chats.get(chatId);
    return chat ? { ...chat } : null;
  }

  async deleteChat(chatId: string): Promise<void> {
    this.chats.delete(chatId);
    this.messages.delete(chatId);
    Logger.info(`Chat deleted: ${chatId}`);
  }

  async listChats(options?: ListOptions): Promise<ChatSummary[]> {
    const chats = Array.from(this.chats.values());
    const filtered = options?.status && options.status !== 'all' 
      ? chats.filter(chat => chat.status === options.status)
      : chats;

    const summaries = filtered.map(chat => ({
      id: parseInt(chat.id), // Convert to number
      title: chat.title,
      participantCount: chat.participants.length,
      messageCount: chat.messages.length,
      lastActivity: chat.lastActivity,
      status: chat.status
    }));

    // Apply limit
    const limit = options?.limit || 50;
    return summaries.slice(0, limit);
  }

  async saveMessage(message: ChatMessage): Promise<void> {
    const chatMessages = this.messages.get(message.chatId) || [];
    chatMessages.push({ ...message });
    this.messages.set(message.chatId, chatMessages);
    Logger.info(`Message saved to chat: ${message.chatId}`);
  }

  async loadMessages(chatId: string, options?: MessageQueryOptions): Promise<ChatMessage[]> {
    const messages = this.messages.get(chatId) || [];
    
    // Apply filters
    let filtered = messages;
    if (options?.afterTimestamp) {
      filtered = messages.filter(msg => msg.timestamp > options.afterTimestamp!);
    }

    // Apply limit
    const limit = options?.limit || 1000;
    return filtered.slice(-limit); // Return latest messages
  }

  // Additional methods for testing
  reset(): void {
    this.chats.clear();
    this.messages.clear();
    Logger.info('SQLitePersistence reset');
  }

  getStats(): { chatCount: number; messageCount: number } {
    const messageCount = Array.from(this.messages.values())
      .reduce((total, messages) => total + messages.length, 0);
    
    return {
      chatCount: this.chats.size,
      messageCount
    };
  }
}