import { Chat, ChatMessage } from '../managers/chatManager.js';
import { ChatHistoryFile } from './chatHistoryFileManager.js';
import { Logger } from './logger.js';

export interface FormatterOptions {
  truncateMessages?: boolean;
  maxTokens?: number;
  includeMetadata?: boolean;
  optimizeForGemini?: boolean;
}

export class ChatHistoryFormatter {
  private static readonly DEFAULT_MAX_TOKENS = 10000;
  private static readonly MESSAGE_OVERHEAD_TOKENS = 50; // Estimated tokens for metadata per message

  constructor() {
    // Initialize formatter
  }

  /**
   * Formats chat data for JSON file optimized for Gemini consumption
   */
  formatChatForFile(
    chat: Chat,
    currentPrompt: string,
    debugKeepFile: boolean,
    options: FormatterOptions = {}
  ): ChatHistoryFile {
    const opts = {
      truncateMessages: false,
      maxTokens: ChatHistoryFormatter.DEFAULT_MAX_TOKENS,
      includeMetadata: true,
      optimizeForGemini: true,
      ...options
    };

    try {
      // 1. Process messages with optional truncation
      let messages = this.processMessages(chat.messages, opts);
      
      // 2. Handle token limits
      if (opts.truncateMessages && opts.maxTokens) {
        messages = this.truncateToTokenLimit(messages, currentPrompt, opts.maxTokens);
      }

      // 3. Generate metadata
      const metadata = this.generateMetadata(chat, messages, currentPrompt);

      // 4. Build optimized structure
      const chatHistoryFile: ChatHistoryFile = {
        chatId: chat.id,
        title: this.sanitizeTitle(chat.title),
        debugKeepFile,
        participants: [...chat.participants], // Shallow copy for safety
        messages: messages.map(msg => ({
          agent: msg.agent,
          message: this.sanitizeMessage(msg.message),
          timestamp: msg.timestamp.toISOString()
        })),
        currentPrompt: this.sanitizeMessage(currentPrompt),
        metadata
      };

      Logger.debug(`Formatted chat ${chat.id}: ${messages.length} messages, ~${metadata.estimatedTokens} tokens`);
      return chatHistoryFile;

    } catch (error) {
      Logger.error(`Failed to format chat ${chat.id}:`, error);
      // Return minimal safe structure
      return this.createFallbackStructure(chat, currentPrompt, debugKeepFile);
    }
  }

  /**
   * Process messages with validation and sanitization
   */
  private processMessages(
    messages: ChatMessage[],
    options: FormatterOptions
  ): ChatMessage[] {
    return messages
      .filter(msg => msg && msg.message && msg.agent) // Remove invalid messages
      .map(msg => ({
        ...msg,
        message: this.sanitizeMessage(msg.message),
        agent: this.sanitizeAgent(msg.agent)
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()); // Ensure chronological order
  }

  /**
   * Truncate messages to fit within token limits while preserving context
   */
  private truncateToTokenLimit(
    messages: ChatMessage[],
    currentPrompt: string,
    maxTokens: number
  ): ChatMessage[] {
    const promptTokens = this.estimateTokens(currentPrompt);
    const availableTokens = maxTokens - promptTokens - 500; // Reserve 500 for metadata
    
    if (availableTokens <= 0) {
      Logger.warn('Current prompt exceeds token limit, returning empty message history');
      return [];
    }

    let totalTokens = 0;
    const truncatedMessages: ChatMessage[] = [];

    // Process messages in reverse order (keep most recent)
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageTokens = this.estimateTokens(message.message) + 
                           ChatHistoryFormatter.MESSAGE_OVERHEAD_TOKENS;
      
      if (totalTokens + messageTokens <= availableTokens) {
        truncatedMessages.unshift(message); // Add to beginning to maintain order
        totalTokens += messageTokens;
      } else {
        Logger.debug(`Truncated ${i + 1} messages to fit token limit`);
        break;
      }
    }

    return truncatedMessages;
  }

  /**
   * Simple token estimation (4 characters ≈ 1 token for English text)
   */
  private estimateTokens(text: string): number {
    // Simple heuristic: ~4 characters per token for English text
    // This is a rough approximation - real implementation might use tiktoken-style estimation
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate comprehensive metadata for the chat file
   */
  private generateMetadata(
    chat: Chat,
    messages: ChatMessage[],
    currentPrompt: string
  ): ChatHistoryFile['metadata'] {
    const totalContent = messages.map(m => m.message).join(' ') + ' ' + currentPrompt;
    const estimatedTokens = this.estimateTokens(totalContent);

    return {
      created: new Date().toISOString(),
      totalMessages: messages.length,
      estimatedTokens
    };
  }

  /**
   * Sanitize title for safe file operations and JSON serialization
   */
  private sanitizeTitle(title: string): string {
    if (!title) return 'Untitled Chat';
    
    return title
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Remove invalid file path characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 100); // Limit length
  }

  /**
   * Sanitize message content for safe JSON serialization
   */
  private sanitizeMessage(message: string): string {
    if (!message) return '';
    
    return message
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n')
      .replace(/\x00/g, '') // Remove null bytes
      .replace(/\s+/g, ' ') // Normalize all whitespace to single spaces
      .trim();
  }

  /**
   * Sanitize agent names
   */
  private sanitizeAgent(agent: string): string {
    if (!agent) return 'unknown';
    
    return agent
      .replace(/[^\w\-_.]/g, '_') // Keep only safe characters
      .substring(0, 50); // Limit length
  }

  /**
   * Create fallback structure when formatting fails
   */
  private createFallbackStructure(
    chat: Chat,
    currentPrompt: string,
    debugKeepFile: boolean
  ): ChatHistoryFile {
    Logger.warn(`Creating fallback structure for chat ${chat.id}`);
    
    return {
      chatId: chat.id,
      title: chat.title || 'Untitled Chat',
      debugKeepFile,
      participants: chat.participants || [],
      messages: [],
      currentPrompt: currentPrompt || '',
      metadata: {
        created: new Date().toISOString(),
        totalMessages: 0,
        estimatedTokens: this.estimateTokens(currentPrompt || '')
      }
    };
  }
}