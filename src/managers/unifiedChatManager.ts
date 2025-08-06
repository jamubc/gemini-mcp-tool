import { Logger } from '../utils/logger.js';
import { CHAT_CONSTANTS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants.js';
import { 
  IChatPersistence, 
  Chat, 
  ChatMessage, 
  ChatSummary, 
  ChatData,
  ChatOperationResult,
  ChatFileResult,
  ListChatOptions,
  AgentState,
  CleanupResult
} from '../interfaces/chatPersistence.js';
import { InMemoryPersistence } from '../persistence/memoryPersistence.js';
import { JsonChatPersistence } from '../persistence/jsonChatPersistence.js';

/**
 * ID Migration Strategy
 * Handles conversion between legacy numeric IDs and new string IDs
 */
class ChatIdManager {
  private static readonly LEGACY_PREFIX = 'legacy_';
  private static readonly UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  /**
   * Convert any ID format to normalized string format
   */
  static normalize(id: number | string): string {
    if (typeof id === 'number') {
      return `${this.LEGACY_PREFIX}${id}`;
    }
    return id.toString();
  }

  /**
   * Convert string ID back to numeric for legacy compatibility
   */
  static toLegacyNumber(stringId: string): number {
    if (stringId.startsWith(this.LEGACY_PREFIX)) {
      return parseInt(stringId.replace(this.LEGACY_PREFIX, ''));
    }
    
    // For non-legacy string IDs, generate a hash-based number
    let hash = 0;
    for (let i = 0; i < stringId.length; i++) {
      const char = stringId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Check if ID is in legacy format
   */
  static isLegacy(stringId: string): boolean {
    return stringId.startsWith(this.LEGACY_PREFIX);
  }

  /**
   * Generate new string-based ID
   */
  static generateNewId(): string {
    return `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Configuration for the Unified Chat Manager
 */
export interface UnifiedChatConfig {
  persistenceType: 'memory' | 'json';
  maxChatsPerAgent?: number;
  enableLegacyCompatibility?: boolean;
  cacheSize?: number;
  maxMemoryMB?: number;
}

/**
 * Unified Chat Manager
 * Single source of truth for all chat management operations
 * Supports both legacy and new APIs with seamless migration
 */
export class UnifiedChatManager {
  private static instance: UnifiedChatManager | null = null;
  private persistence: IChatPersistence;
  private config: Required<UnifiedChatConfig>;
  private isInitialized = false;
  private chatQuotas = new Map<string, number>();
  private nextNumericId = 1; // For legacy compatibility

  private constructor(config: UnifiedChatConfig) {
    this.config = {
      maxChatsPerAgent: 10,
      enableLegacyCompatibility: true,
      cacheSize: 50,
      maxMemoryMB: 80,
      ...config
    };

    // Initialize persistence layer based on configuration
    this.persistence = this.config.persistenceType === 'memory' 
      ? new InMemoryPersistence() 
      : new JsonChatPersistence();
  }

  /**
   * Get singleton instance with configuration
   */
  static getInstance(config?: UnifiedChatConfig): UnifiedChatManager {
    if (!this.instance) {
      const defaultConfig: UnifiedChatConfig = {
        persistenceType: 'json', // Default to persistent storage
        enableLegacyCompatibility: true
      };
      this.instance = new UnifiedChatManager(config || defaultConfig);
    }
    return this.instance;
  }

  /**
   * Reset singleton for testing
   */
  static resetInstance(): void {
    this.instance = null;
  }

  /**
   * Initialize the chat manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.persistence.init();
      
      // Initialize next numeric ID for legacy compatibility
      if (this.config.enableLegacyCompatibility) {
        const existingChats = await this.persistence.listChats({ limit: 1000 });
        const legacyIds = existingChats
          .map(chat => ChatIdManager.isLegacy(chat.chatId) ? ChatIdManager.toLegacyNumber(chat.chatId) : 0)
          .filter(id => id > 0);
        
        if (legacyIds.length > 0) {
          this.nextNumericId = Math.max(...legacyIds) + 1;
        }
      }

      // Trigger cleanup if supported
      if (this.persistence.cleanupExpiredFiles) {
        await this.persistence.cleanupExpiredFiles();
      }

      this.isInitialized = true;
      Logger.info(`UnifiedChatManager initialized (${this.config.persistenceType} persistence)`);
    } catch (error) {
      Logger.error('Failed to initialize UnifiedChatManager:', error);
      throw error;
    }
  }

  // ============================================================================
  // LEGACY COMPATIBILITY API (numeric IDs)
  // ============================================================================

  /**
   * Create chat with legacy numeric ID return
   * @deprecated Use createChatV2 for new implementations
   */
  async createChat(title: string, creatorName: string, options?: { private?: boolean }): Promise<number> {
    await this.initialize();
    
    if (!this.config.enableLegacyCompatibility) {
      throw new Error('Legacy API disabled. Use createChatV2 instead.');
    }

    const stringId = await this.createChatV2(title, creatorName, options);
    
    // If this is a legacy ID, extract the numeric part
    if (ChatIdManager.isLegacy(stringId)) {
      return ChatIdManager.toLegacyNumber(stringId);
    }
    
    // For new string IDs, return a computed numeric representation
    return ChatIdManager.toLegacyNumber(stringId);
  }

  /**
   * Get chat with legacy numeric ID support
   * @deprecated Use getChatV2 for new implementations
   */
  async getChat(chatId: number | string, agentName?: string): Promise<Chat | null> {
    const stringId = ChatIdManager.normalize(chatId);
    return this.getChatV2(stringId, agentName);
  }

  /**
   * Add message with legacy numeric ID support
   * @deprecated Use addMessageV2 for new implementations
   */
  async addMessage(
    chatId: number | string, 
    agentName: string, 
    content: string, 
    processorFn?: (message: string) => Promise<void>
  ): Promise<ChatOperationResult> {
    const stringId = ChatIdManager.normalize(chatId);
    return this.addMessageV2(stringId, agentName, content, processorFn);
  }

  // ============================================================================
  // NEW UNIFIED API (string IDs)
  // ============================================================================

  /**
   * Create new chat with string ID
   */
  async createChatV2(title: string, creatorName: string, options?: { private?: boolean }): Promise<string> {
    await this.initialize();

    // Validation
    if (!title || title.trim().length === 0) {
      throw new Error('Chat title cannot be empty');
    }
    if (title.length > CHAT_CONSTANTS.MAX_TITLE_LENGTH) {
      throw new Error('Chat title exceeds maximum length');
    }
    if (!creatorName || creatorName.trim().length === 0) {
      throw new Error('Agent name cannot be empty');
    }

    // Check quota
    const currentQuota = this.chatQuotas.get(creatorName) || 0;
    if (currentQuota >= this.config.maxChatsPerAgent) {
      throw new Error('Chat creation quota exceeded');
    }

    // Generate ID based on compatibility mode
    let chatId: string;
    if (this.config.enableLegacyCompatibility) {
      chatId = ChatIdManager.normalize(this.nextNumericId++);
    } else {
      chatId = ChatIdManager.generateNewId();
    }

    // Create chat object
    const now = new Date();
    const chat: Chat = {
      id: chatId,
      title: title.trim(),
      participants: [creatorName],
      messages: [],
      created: now,
      lastActivity: now,
      status: 'active',
      agentsWithHistory: new Set<string>()
    };

    // Create initial agent states for enhanced persistence
    const agentStates: Record<string, AgentState> = {
      [creatorName]: {
        lastSeenMessageId: null,
        participationState: 'new',
        lastActiveAt: now
      }
    };

    // Save to persistence
    await this.persistence.saveChat(chat, agentStates);
    
    // Update quota
    this.chatQuotas.set(creatorName, currentQuota + 1);
    
    Logger.info(`Chat created: ${chatId} by ${creatorName}`);
    return chatId;
  }

  /**
   * Get chat by string ID
   */
  async getChatV2(chatId: string, agentName?: string): Promise<Chat | null> {
    await this.initialize();

    const result = await this.persistence.loadChat(chatId);
    if (!result) {
      return null;
    }

    const chat = result.chat;

    // Add agent as participant if provided and not already present
    if (agentName && !chat.participants.includes(agentName)) {
      chat.participants.push(agentName);
      
      // Update persistence with new participant
      const agentStates = result.agentStates || {};
      if (!agentStates[agentName]) {
        agentStates[agentName] = {
          lastSeenMessageId: null,
          participationState: 'new',
          lastActiveAt: new Date()
        };
      }
      
      await this.persistence.saveChat(chat, agentStates);
    }

    return chat;
  }

  /**
   * Add message to chat with string ID
   */
  async addMessageV2(
    chatId: string,
    agentName: string,
    content: string,
    processorFn?: (message: string) => Promise<void>
  ): Promise<ChatOperationResult> {
    await this.initialize();

    // Validation
    if (!content || content.trim().length === 0) {
      throw new Error(ERROR_MESSAGES.INVALID_MESSAGE_CONTENT);
    }
    if (content.length > CHAT_CONSTANTS.MAX_MESSAGE_LENGTH) {
      throw new Error('Message exceeds maximum size limit');
    }
    if (!agentName || agentName.trim().length === 0) {
      throw new Error('Agent name cannot be empty');
    }

    const result = await this.persistence.loadChat(chatId);
    if (!result) {
      throw new Error(ERROR_MESSAGES.CHAT_NOT_FOUND.replace('{chatId}', chatId));
    }

    const { chat, agentStates = {} } = result;

    // Add agent as participant if not already present
    if (!chat.participants.includes(agentName)) {
      chat.participants.push(agentName);
    }

    // Create message
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      chatId,
      agent: agentName,
      message: content.trim(),
      timestamp: new Date(),
      sanitized: true
    };

    // Add message to chat
    chat.messages.push(message);
    chat.lastActivity = new Date();

    // Update agent states
    const updatedStates = { ...agentStates };
    if (!updatedStates[agentName]) {
      updatedStates[agentName] = {
        lastSeenMessageId: null,
        participationState: 'new',
        lastActiveAt: new Date()
      };
    }
    updatedStates[agentName].lastActiveAt = new Date();
    updatedStates[agentName].participationState = 'active';

    // Truncate history if needed
    await this.truncateHistoryIfNeeded(chat);

    // Save updated chat
    await this.persistence.saveChat(chat, updatedStates);

    // Execute processor function if provided
    if (processorFn) {
      try {
        await processorFn(content);
      } catch (error) {
        Logger.error('Processor function failed:', error);
        throw error;
      }
    }

    Logger.info(`Message added to chat ${chatId} by ${agentName}`);
    
    return {
      success: true,
      message: SUCCESS_MESSAGES.MESSAGE_SENT,
      chatId
    };
  }

  // ============================================================================
  // COMMON API METHODS
  // ============================================================================

  /**
   * List all chats
   */
  async listChats(options?: ListChatOptions): Promise<ChatSummary[]> {
    await this.initialize();
    return this.persistence.listChats(options);
  }

  /**
   * Delete a chat
   */
  async deleteChat(chatId: number | string): Promise<boolean> {
    await this.initialize();
    const stringId = ChatIdManager.normalize(chatId);
    return this.persistence.deleteChat(stringId);
  }

  /**
   * Format chat history for Gemini CLI
   */
  formatHistoryForGemini(chat: Chat): string {
    if (chat.messages.length === 0) {
      return '';
    }

    const historyLines = [`=== CHAT HISTORY - "${chat.title}" ===`];
    
    for (const msg of chat.messages) {
      historyLines.push(`[${msg.agent}]: ${msg.message}`);
    }
    
    historyLines.push('=== END CHAT HISTORY ===');
    
    return historyLines.join('\n');
  }

  /**
   * Generate chat history file
   */
  async generateChatHistoryFile(
    chatId: number | string,
    currentPrompt: string,
    agentName?: string,
    debugKeepFile: boolean = false
  ): Promise<ChatFileResult> {
    try {
      const stringId = ChatIdManager.normalize(chatId);
      const chat = await this.getChatV2(stringId, agentName);
      
      if (!chat) {
        return {
          success: false,
          error: `Chat ${chatId} not found`
        };
      }

      // Use the existing ChatHistoryFileManager for file generation
      const { ChatHistoryFileManager } = await import('../utils/chatHistoryFileManager.js');
      const result = await ChatHistoryFileManager.createChatHistoryFile(
        chat,
        currentPrompt,
        debugKeepFile
      );

      if (result.success && result.filePath) {
        return {
          success: true,
          filePath: result.filePath,
          fileReference: ChatHistoryFileManager.generateFileReference(chat.id)
        };
      }

      return {
        success: false,
        error: result.error || 'Unknown file creation error'
      };
    } catch (error) {
      Logger.error(`Failed to generate chat history file for ${chatId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Cleanup expired chats
   */
  async cleanupExpiredChats(): Promise<CleanupResult | null> {
    await this.initialize();
    
    if (this.persistence.cleanupExpiredFiles) {
      return this.persistence.cleanupExpiredFiles();
    }
    
    return null;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async truncateHistoryIfNeeded(chat: Chat): Promise<void> {
    let totalChars = chat.messages.reduce((sum, msg) => sum + msg.message.length, 0);
    
    while (totalChars > CHAT_CONSTANTS.HISTORY_LIMIT && chat.messages.length > 1) {
      const removedMessage = chat.messages.shift();
      if (removedMessage) {
        totalChars -= removedMessage.message.length;
        Logger.info(`Chat history truncated for chat ${chat.id}: removed message from ${removedMessage.agent}`);
      }
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get storage paths for debugging
   */
  getStoragePaths(): { base?: string; storage?: string; gemini?: string } {
    if (this.persistence.getStoragePaths) {
      return this.persistence.getStoragePaths();
    }
    return {};
  }

  /**
   * Get configuration
   */
  getConfig(): Required<UnifiedChatConfig> {
    return { ...this.config };
  }

  /**
   * Check if legacy compatibility is enabled
   */
  isLegacyCompatible(): boolean {
    return this.config.enableLegacyCompatibility;
  }
}