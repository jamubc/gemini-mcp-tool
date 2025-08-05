import { CHAT_CONSTANTS } from '../constants.js';
import { Logger } from './logger.js';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: string;
  riskScore?: number;
}

export interface AgentInput {
  agentName?: string;
  agentId?: string;
  content?: string;
  chatId?: string;
  title?: string;
  type?: 'message' | 'chat' | 'agent';
}

// Input validation and sanitization utilities
export class InputValidator {
  
  // Validate agent input for chat operations
  static validateAgentInput(input: AgentInput): ValidationResult {
    const errors: string[] = [];

    // Agent name/ID validation (if provided)
    const agentIdentifier = input.agentName || input.agentId;
    if (input.type !== 'message' && (!agentIdentifier || agentIdentifier.trim().length === 0)) {
      errors.push('Agent name cannot be empty');
    } else if (agentIdentifier && agentIdentifier.length > 50) {
      errors.push('Agent name cannot exceed 50 characters');
    }

    // Enhanced agent ID format validation for security tests
    if (input.agentId !== undefined) {
      if (input.agentId === '') {
        errors.push('Invalid agent ID format');
      } else if (input.agentId.length < 2) {
        errors.push('Invalid agent ID format');
      } else if (/\s/.test(input.agentId)) {
        errors.push('Invalid agent ID format');
      } else if (/[\/\\]/.test(input.agentId)) {
        errors.push('Invalid agent ID format');
      } else if (/[\n\r\x00]/.test(input.agentId)) {
        errors.push('Invalid agent ID format');
      }
    }

    // Content validation (for messages)
    if (input.content !== undefined) {
      if (input.content.trim().length === 0) {
        errors.push('Message content cannot be empty');
      } else if (input.content.length > CHAT_CONSTANTS.MAX_MESSAGE_LENGTH) {
        errors.push('Message exceeds maximum size limit');
      }
    }

    // Title validation (for chat creation)
    if (input.title !== undefined) {
      if (input.title.trim().length === 0) {
        errors.push('Chat title cannot be empty');
      } else if (input.title.length > CHAT_CONSTANTS.MAX_TITLE_LENGTH) {
        errors.push(`Chat title cannot exceed ${CHAT_CONSTANTS.MAX_TITLE_LENGTH} characters`);
      }
    }

    // Chat ID validation
    if (input.chatId !== undefined) {
      if (!input.chatId || input.chatId.trim().length === 0) {
        errors.push('Chat ID cannot be empty');
      }
    }

    const isValid = errors.length === 0;
    if (!isValid) {
      Logger.warn('Input validation failed:', errors.join(', '));
    }

    return {
      isValid,
      errors,
      sanitized: input.content ? this.sanitizeContent(input.content) : undefined,
      riskScore: input.content ? this.assessRiskScore(input.content) : 0
    };
  }

  // Basic content sanitization
  static sanitizeContent(content: string): string {
    // Basic HTML/script tag removal
    let sanitized = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+\s*=/gi, ''); // Remove event handlers

    // Normalize whitespace but preserve line breaks
    sanitized = sanitized
      .replace(/\s+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .trim();

    return sanitized;
  }

  // Basic risk assessment for injection attacks
  private static assessRiskScore(content: string): number {
    let riskScore = 0;
    const riskPatterns = [
      /script/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<[^>]*>/g,
      /eval\s*\(/gi,
      /exec\s*\(/gi,
      /system\s*\(/gi,
      /import\s+/gi,
      /require\s*\(/gi,
    ];

    for (const pattern of riskPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        riskScore += matches.length * 10;
      }
    }

    // Normalize to 0-100 scale
    return Math.min(riskScore, 100);
  }

  // Validate chat title specifically
  static validateChatTitle(title: string): ValidationResult {
    return this.validateAgentInput({ agentName: 'system', title });
  }

  // Validate message content specifically
  static validateMessageContent(content: string, agentName: string): ValidationResult {
    return this.validateAgentInput({ agentName, content });
  }

  // Validate chat ID format
  static validateChatId(chatId: string): ValidationResult {
    const errors: string[] = [];

    if (!chatId || chatId.trim().length === 0) {
      errors.push('Chat ID cannot be empty');
    } else if (!/^\d+$/.test(chatId)) {
      errors.push('Chat ID must be numeric');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Convenience function for basic agent input validation
export function validateAgentInput(input: AgentInput): Promise<{ content: string; agentId?: string }> {
  const result = InputValidator.validateAgentInput(input);
  
  if (!result.isValid) {
    return Promise.reject(new Error(result.errors.join(', ')));
  }
  
  // Always sanitize content if provided
  const sanitizedContent = input.content ? InputValidator.sanitizeContent(input.content) : '';
  
  return Promise.resolve({
    content: sanitizedContent,
    agentId: input.agentId || input.agentName
  });
}