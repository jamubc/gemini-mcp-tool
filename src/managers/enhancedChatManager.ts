import { Logger } from '../utils/logger.js';
import { CHAT_CONSTANTS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants.js';
import { Chat, ChatMessage, ChatSummary } from '../types/chat.js';
import { JsonChatPersistence, AgentState } from '../persistence/jsonChatPersistence.js';
import { AgentParticipationManager } from './agentParticipationManager.js';
import { ChatIdGenerator } from '../utils/chatIdGenerator.js';

/**
 * Enhanced ChatManager with JSON persistence and agent participation tracking
 * Extends the existing ChatManager interface while adding new persistent storage capabilities
 */
export class EnhancedChatManager {
  private static instance: EnhancedChatManager | null = null;
  private persistence: JsonChatPersistence;
  private chatQuotas = new Map<string, number>();
  private readonly maxChatsPerAgent = 10;
  private isInitialized = false;
  private existingChatIds = new Set<string>();

  private constructor() {
    this.persistence = new JsonChatPersistence();
  }

  static getInstance(): EnhancedChatManager {
    if (!this.instance) {
      this.instance = new EnhancedChatManager();
    }
    return this.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.persistence.initialize();
      
      // Load existing chats to track hash collisions
      const existingChats = await this.persistence.listChats();
      this.existingChatIds = new Set(existingChats.map(chat => chat.chatId));

      // Trigger cleanup on startup
      await this.persistence.cleanupExpiredFiles();
      
      this.isInitialized = true;
      Logger.info(`EnhancedChatManager initialized with ${this.existingChatIds.size} existing chats`);
    } catch (error) {
      Logger.error('Failed to initialize EnhancedChatManager:', error);
      throw error;
    }
  }

  reset(): void {
    // Reset for testing purposes
    this.existingChatIds.clear();
    this.chatQuotas.clear();
  }

  async createChat(title: string, creatorAgent: string): Promise<string> {
    await this.initialize();

    // Check quota
    const currentQuota = this.chatQuotas.get(creatorAgent) || 0;
    if (currentQuota >= this.maxChatsPerAgent) {
      throw new Error('Chat creation quota exceeded');
    }

    // Generate hash-based chat ID
    const chatId = ChatIdGenerator.generateUniqueFromTitle(title, this.existingChatIds);
    this.existingChatIds.add(chatId);
    
    const now = new Date();

    const chat: Chat = {
      id: chatId,
      title,
      participants: [creatorAgent],
      messages: [],
      created: now,
      lastActivity: now,
      status: 'active',
      agentsWithHistory: new Set<string>()
    };

    // Initialize agent states - creator starts as 'new'
    const agentStates: Record<string, AgentState> = {
      [creatorAgent]: {
        lastSeenMessageId: null,
        participationState: 'new',
        lastActiveAt: now
      }
    };

    await this.persistence.saveChat(chat, agentStates);
    
    // Update quota
    this.chatQuotas.set(creatorAgent, currentQuota + 1);
    
    Logger.info(`Chat ${chatId} created by ${creatorAgent}`);
    return chatId;
  }

  async getChat(chatId: number | string): Promise<Chat | null> {
    await this.initialize();

    const chatIdStr = chatId.toString();
    const result = await this.persistence.loadChat(chatIdStr);
    
    if (!result) {
      return null;
    }

    return result.chat;
  }

  async addMessage(
    chatId: number | string,
    agentId: string,
    message: string,
    sanitized: boolean = false
  ): Promise<void> {
    await this.initialize();

    const chatIdStr = chatId.toString();
    const result = await this.persistence.loadChat(chatIdStr);
    
    if (!result) {
      throw new Error(`Chat ${chatId} not found`);
    }

    const { chat, agentStates } = result;

    // Validate message size
    if (message.length > CHAT_CONSTANTS.MAX_MESSAGE_LENGTH) {
      throw new Error('Message exceeds maximum size limit');
    }

    // Create new message
    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      chatId: chatIdStr,
      agent: agentId,
      message,
      timestamp: new Date(),
      sanitized
    };

    // Add message to chat
    chat.messages.push(newMessage);
    chat.lastActivity = new Date();
    
    // Add agent to participants if not already there
    if (!chat.participants.includes(agentId)) {
      chat.participants.push(agentId);
    }

    // Update agent participation states
    const updatedStates = AgentParticipationManager.updateStatesForNewMessage(agentId, agentStates);
    const finalStates = AgentParticipationManager.updateAgentParticipation(
      agentId,
      chatIdStr,
      newMessage.id,
      updatedStates
    );

    // Truncate history if needed
    await this.truncateHistoryIfNeeded(chat);

    // Save updated chat
    await this.persistence.saveChat(chat, finalStates);

    Logger.debug(`Message added to chat ${chatId} by ${agentId}`);
  }

  async listChats(): Promise<Array<{ chatId: string; title: string; lastAccessTime: Date; createdAt: Date }>> {
    await this.initialize();
    return await this.persistence.listChats();
  }

  async deleteChat(chatId: number | string): Promise<boolean> {
    await this.initialize();

    const chatIdStr = chatId.toString();
    const success = await this.persistence.deleteChat(chatIdStr);
    
    if (success) {
      // Update quota (find which agent created this chat and decrement)
      // This is a simplification - in a real implementation, we'd track chat ownership
      Logger.info(`Chat ${chatId} deleted successfully`);
    }

    return success;
  }

  /**
   * Get messages for a specific agent based on their participation state
   */
  async getMessagesForAgent(
    chatId: number | string,
    agentId: string,
    currentGeminiReply?: string
  ): Promise<ChatMessage[]> {
    await this.initialize();

    const chatIdStr = chatId.toString();
    const result = await this.persistence.loadChat(chatIdStr);
    
    if (!result) {
      throw new Error(`Chat ${chatId} not found`);
    }

    const { chat, agentStates } = result;
    
    return AgentParticipationManager.getMessagesForAgent(
      agentId,
      chat.messages,
      agentStates,
      currentGeminiReply
    );
  }

  /**
   * Get agent participation summary for debugging
   */
  async getAgentParticipationSummary(chatId: number | string): Promise<string> {
    await this.initialize();

    const chatIdStr = chatId.toString();
    const result = await this.persistence.loadChat(chatIdStr);
    
    if (!result) {
      return `Chat ${chatId} not found`;
    }

    return AgentParticipationManager.getParticipationSummary(result.agentStates);
  }

  /**
   * Generate chat history file for Gemini CLI (separate from storage)
   */
  async generateChatHistoryFile(
    chatId: number | string,
    currentPrompt: string,
    agentId: string,
    keepForDebug: boolean = false
  ): Promise<{ success: true; filePath: string; fileReference: string } | { success: false; error: string }> {
    try {
      await this.initialize();

      // Get messages appropriate for this agent
      const messages = await this.getMessagesForAgent(chatId, agentId, currentPrompt);
      
      if (messages.length === 0) {
        return { success: false, error: 'No messages available for this agent' };
      }

      // Create Gemini-compatible file (this could be integrated with ChatHistoryFileManager)
      const geminiFilePath = this.persistence.getGeminiPath();
      const fileName = `chat-${chatId}.json`;
      const fullPath = require('path').join(geminiFilePath, fileName);

      // Ensure Gemini directory exists
      const fs = require('fs').promises;
      await fs.mkdir(geminiFilePath, { recursive: true });

      const geminiData = {
        chatId: chatId.toString(),
        messages: messages.map(msg => ({
          agent: msg.agent,
          message: msg.message,
          timestamp: msg.timestamp.toISOString()
        })),
        currentPrompt,
        metadata: {
          created: new Date().toISOString(),
          totalMessages: messages.length,
          estimatedTokens: this.estimateTokenCount(messages, currentPrompt)
        }
      };

      await fs.writeFile(fullPath, JSON.stringify(geminiData, null, 2), 'utf8');

      const fileReference = `@${fullPath}`;
      
      Logger.debug(`Generated Gemini chat file for agent ${agentId}: ${fullPath}`);
      
      return {
        success: true,
        filePath: fullPath,
        fileReference
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`Failed to generate chat history file for chat ${chatId}:`, error);
      return { success: false, error: errorMessage };
    }
  }

  private async truncateHistoryIfNeeded(chat: Chat): Promise<void> {
    const totalChars = chat.messages.reduce((sum: number, msg: any) => sum + msg.message.length, 0);
    
    if (totalChars > CHAT_CONSTANTS.HISTORY_LIMIT) {
      const originalCount = chat.messages.length;
      
      // Remove oldest messages until under limit
      while (totalChars > CHAT_CONSTANTS.HISTORY_LIMIT && chat.messages.length > 1) {
        const removed = chat.messages.shift()!;
        Logger.info(`Chat history truncated for chat ${chat.id}: removed message from ${removed.agent}`);
      }
      
      Logger.info(`Chat ${chat.id} truncated from ${originalCount} to ${chat.messages.length} messages`);
    }
  }

  private estimateTokenCount(messages: ChatMessage[], currentPrompt: string): number {
    const allText = messages.map(m => m.message).join(' ') + ' ' + currentPrompt;
    return Math.ceil(allText.length / 4); // Rough estimate: 4 characters per token
  }

  // Compatibility method for existing code
  async getPersistence(): Promise<JsonChatPersistence> {
    await this.initialize();
    return this.persistence;
  }

  // Get storage paths for debugging/management
  getStoragePaths(): { base: string; storage: string; gemini: string } {
    return {
      base: this.persistence.getBasePath(),
      storage: this.persistence.getStoragePath(),
      gemini: this.persistence.getGeminiPath()
    };
  }
}