/**
 * Unified Chat Persistence Interface
 * Provides a common interface for all persistence strategies (memory, JSON, database, etc.)
 */

export interface CleanupResult {
  deletedCount: number;
  errors: number;
  details?: string[];
}

export interface ListChatOptions {
  status?: 'active' | 'archived' | 'all';
  limit?: number;
  offset?: number;
  agentFilter?: string;
}

export interface ChatData {
  chat: Chat;
  agentStates?: Record<string, AgentState>;
}

export interface AgentState {
  lastSeenMessageId: string | null;
  participationState: 'new' | 'active' | 'inactive';
  lastActiveAt: Date;
}

export interface Chat {
  id: string;
  title: string;
  participants: string[];
  messages: ChatMessage[];
  created: Date;
  lastActivity: Date;
  status: 'active' | 'archived';
  agentsWithHistory?: Set<string>;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  agent: string;
  message: string;
  timestamp: Date;
  sanitized: boolean;
  auditTrail?: AuditEntry[];
}

export interface AuditEntry {
  timestamp: Date;
  action: string;
  agentId: string;
  details: string;
}

export interface ChatSummary {
  chatId: string; // Unified to string (breaking change from legacy number)
  title: string;
  participantCount: number;
  messageCount: number;
  lastActivity: Date;
  status: 'active' | 'archived';
  createdAt?: Date; // Enhanced schema support
  lastAccessTime?: Date; // Enhanced schema support
}

/**
 * Unified Chat Persistence Interface
 * All chat persistence implementations must implement this interface
 */
export interface IChatPersistence {
  /**
   * Initialize the persistence layer
   */
  init(): Promise<void>;

  /**
   * Save a chat with optional agent states
   */
  saveChat(chat: Chat, agentStates?: Record<string, AgentState>): Promise<void>;

  /**
   * Load a chat by ID, returns null if not found
   */
  loadChat(chatId: string): Promise<ChatData | null>;

  /**
   * List all chats with optional filtering
   */
  listChats(options?: ListChatOptions): Promise<ChatSummary[]>;

  /**
   * Delete a chat by ID
   */
  deleteChat(chatId: string): Promise<boolean>;

  /**
   * Cleanup expired chats (optional implementation)
   */
  cleanupExpiredFiles?(): Promise<CleanupResult>;

  /**
   * Get storage paths for debugging (optional)
   */
  getStoragePaths?(): { base?: string; storage?: string; gemini?: string };
}

/**
 * Chat operation result for enhanced error handling
 */
export interface ChatOperationResult {
  success: boolean;
  message: string;
  chatId?: string;
  error?: string;
}

/**
 * Chat file generation result
 */
export interface ChatFileResult {
  success: boolean;
  filePath?: string;
  fileReference?: string;
  error?: string;
}