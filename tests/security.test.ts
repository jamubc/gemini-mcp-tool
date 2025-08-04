import { describe, it, afterEach, expect, vi, beforeEach } from 'vitest';
import { SQLitePersistence } from '../src/persistence/sqlitePersistence.js';
import { validateAgentInput } from '../src/utils/inputValidator.js';
import { ERROR_MESSAGES } from '../src/constants.js';

describe('Security - SQL Injection Prevention', () => {
  let persistence: SQLitePersistence;
  
  beforeEach(async () => {
    // Use in-memory SQLite for fast, isolated tests
    persistence = new SQLitePersistence(':memory:');
    await persistence.init();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const SQL_INJECTION_PAYLOADS = [
    "' OR '1'='1",
    "' OR 1=1; --",
    "' OR 1=1; /*",
    "' OR 1=1--",
    "' OR 'a'='a",
    "' OR 'a'='a'; --",
    "' OR 'a'='a'; /*",
    "' OR 'a'='a'--",
    "' OR 1=1#",
    "' OR 'a'='a'#",
    "'; DROP TABLE messages; --",
    "' UNION SELECT * FROM sqlite_master; --",
    "'; INSERT INTO messages VALUES ('injected'); --",
    "' AND (SELECT COUNT(*) FROM messages) > 0; --"
  ];

  describe('Message Storage', () => {
    it.each(SQL_INJECTION_PAYLOADS)(
      'should safely store SQL injection payload: %s',
      async (payload) => {
        const agentId = 'test-agent';
        const chatId = 'test-chat';
        
        // Store malicious payload - should not cause SQL injection
        await expect(
          persistence.saveMessage(chatId, agentId, payload)
        ).resolves.not.toThrow();
        
        // Retrieve messages - payload should be stored literally
        const messages = await persistence.getMessages(chatId);
        expect(messages).toHaveLength(1);
        expect(messages[0].content).toBe(payload);
        expect(messages[0].agentId).toBe(agentId);
      }
    );

    it('should prevent injection through chat ID parameter', async () => {
      const maliciousChatId = "test-chat'; DROP TABLE chats; --";
      const agentId = 'test-agent';
      const message = 'normal message';
      
      // Should handle malicious chat ID safely
      await expect(
        persistence.saveMessage(maliciousChatId, agentId, message)
      ).resolves.not.toThrow();
      
      // Verify no SQL injection occurred (tables should still exist)
      const messages = await persistence.getMessages(maliciousChatId);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe(message);
    });

    it('should prevent injection through agent ID parameter', async () => {
      const chatId = 'test-chat';
      const maliciousAgentId = "agent'; UPDATE messages SET content='hacked'; --";
      const message = 'test message';
      
      await expect(
        persistence.saveMessage(chatId, maliciousAgentId, message)
      ).resolves.not.toThrow();
      
      const messages = await persistence.getMessages(chatId);
      expect(messages).toHaveLength(1);
      expect(messages[0].agentId).toBe(maliciousAgentId);
      expect(messages[0].content).toBe(message);
    });
  });

  describe('Chat Management', () => {
    it('should prevent SQL injection in chat creation', async () => {
      const maliciousChatName = "Test Chat'; DROP TABLE chats; --";
      const agentId = 'test-agent';
      
      const chatId = await persistence.createChat(agentId, maliciousChatName);
      expect(chatId).toBeDefined();
      
      // Verify chat was created with literal name
      const chats = await persistence.listChats(agentId);
      expect(chats).toHaveLength(1);
      expect(chats[0].name).toBe(maliciousChatName);
    });

    it('should prevent injection in chat listing', async () => {
      const maliciousAgentId = "agent'; SELECT * FROM sensitive_data; --";
      
      // Should not throw error or return unexpected data
      const chats = await persistence.listChats(maliciousAgentId);
      expect(Array.isArray(chats)).toBe(true);
      // Should return empty array (no chats for this "agent")
      expect(chats).toHaveLength(0);
    });
  });

  describe('Query Parameter Validation', () => {
    it('should validate parameterized queries are used', async () => {
      // This test verifies our queries use bound parameters
      const chatId = 'test-chat';
      const agentId = 'test-agent';
      
      // Create a message with special characters that could break string concatenation
      const specialMessage = "Message with 'quotes' and \"double quotes\" and \\backslashes";
      
      await persistence.saveMessage(chatId, agentId, specialMessage);
      
      const messages = await persistence.getMessages(chatId);
      expect(messages[0].content).toBe(specialMessage);
    });
  });
});

describe('Security - Input Validation & Sanitization', () => {
  describe('Message Content Validation', () => {
    it('should reject messages exceeding maximum size', async () => {
      const maxMessageSize = 10000; // 10KB limit
      const oversizedMessage = 'x'.repeat(maxMessageSize + 1);
      
      await expect(
        validateAgentInput({
          content: oversizedMessage,
          type: 'message'
        })
      ).rejects.toThrow('Message exceeds maximum size limit');
    });

    it('should sanitize HTML and script content', async () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        '<iframe src="javascript:alert(1)"></iframe>',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>'
      ];

      for (const input of maliciousInputs) {
        const sanitized = await validateAgentInput({
          content: input,
          type: 'message'
        });
        
        // Should not contain executable code
        expect(sanitized.content).not.toContain('<script>');
        expect(sanitized.content).not.toContain('javascript:');
        expect(sanitized.content).not.toContain('onerror=');
      }
    });

    it('should validate agent ID format', async () => {
      const invalidAgentIds = [
        '', // empty
        'a', // too short
        'agent-with-spaces in-name', // spaces
        'agent/with/slashes', // slashes
        'agent\\with\\backslashes', // backslashes
        'agent\nwith\nnewlines', // newlines
        'agent\x00with\x00nulls' // null bytes
      ];

      for (const agentId of invalidAgentIds) {
        await expect(
          validateAgentInput({
            agentId,
            content: 'test message',
            type: 'message'
          })
        ).rejects.toThrow('Invalid agent ID format');
      }
    });
  });

  describe('Authorization Validation', () => {
    it('should prevent unauthorized agent impersonation', async () => {
      const chatId = 'secure-chat';
      const legitimateAgent = 'alice-agent';
      const impersonatorAgent = 'bob-agent';
      
      // Create chat with legitimate agent
      const persistence = new SQLitePersistence(':memory:');
      await persistence.init();
      await persistence.createChat(legitimateAgent, 'Secure Chat');
      
      // Attempt to add message as different agent should fail
      await expect(
        persistence.saveMessage(chatId, impersonatorAgent, 'impersonated message')
      ).rejects.toThrow('Agent not authorized for this chat');
    });

    it('should validate agent permissions for chat access', async () => {
      const chatId = 'private-chat';
      const owner = 'owner-agent';
      const unauthorized = 'unauthorized-agent';
      
      const persistence = new SQLitePersistence(':memory:');
      await persistence.init();
      
      // Create private chat
      await persistence.createChat(owner, 'Private Chat', { 
        isPrivate: true,
        authorizedAgents: [owner]
      });
      
      // Owner should be able to access
      await expect(
        persistence.getMessages(chatId, owner)
      ).resolves.not.toThrow();
      
      // Unauthorized agent should be blocked
      await expect(
        persistence.getMessages(chatId, unauthorized)
      ).rejects.toThrow('Access denied');
    });
  });
});

describe('Security - DoS Protection', () => {
  describe('Resource Quotas', () => {
    it('should enforce message rate limiting per agent', async () => {
      const agentId = 'rate-limited-agent';
      const chatId = 'test-chat';
      const maxMessagesPerMinute = 60;
      
      const persistence = new SQLitePersistence(':memory:');
      await persistence.init();
      
      // Send messages up to the limit
      const promises = Array.from({ length: maxMessagesPerMinute }, (_, i) =>
        persistence.saveMessage(chatId, agentId, `Message ${i}`)
      );
      
      await Promise.all(promises);
      
      // Next message should be rate limited
      await expect(
        persistence.saveMessage(chatId, agentId, 'Rate limited message')
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should enforce chat creation quota per agent', async () => {
      const agentId = 'quota-test-agent';
      const maxChatsPerAgent = 100;
      
      const persistence = new SQLitePersistence(':memory:');
      await persistence.init();
      
      // Create chats up to the limit
      for (let i = 0; i < maxChatsPerAgent; i++) {
        await persistence.createChat(agentId, `Chat ${i}`);
      }
      
      // Next chat creation should fail
      await expect(
        persistence.createChat(agentId, 'Quota exceeded chat')
      ).rejects.toThrow('Chat creation quota exceeded');
    });

    it('should enforce memory usage limits', async () => {
      const chatId = 'memory-test-chat';
      const agentId = 'test-agent';
      const maxChatMemoryMB = 10; // 10MB limit per chat
      
      const persistence = new SQLitePersistence(':memory:');
      await persistence.init();
      await persistence.createChat(agentId, 'Memory Test Chat');
      
      // Add messages until memory limit is reached
      const largeMessage = 'x'.repeat(1024 * 100); // 100KB message
      
      let messageCount = 0;
      try {
        for (let i = 0; i < 200; i++) { // Try to exceed 10MB
          await persistence.saveMessage(chatId, agentId, `${largeMessage}-${i}`);
          messageCount++;
        }
      } catch (error) {
        expect(error.message).toContain('Memory limit exceeded');
      }
      
      // Should have stopped before reaching 200 messages
      expect(messageCount).toBeLessThan(150);
    });
  });

  describe('Connection Limits', () => {
    it('should limit concurrent connections per agent', async () => {
      const agentId = 'concurrent-agent';
      const maxConcurrentConnections = 5;
      
      // Simulate multiple concurrent operations
      const operations = Array.from({ length: maxConcurrentConnections + 2 }, () => {
        const persistence = new SQLitePersistence(':memory:');
        return persistence.init();
      });
      
      // Some operations should be rejected due to connection limits
      const results = await Promise.allSettled(operations);
      const rejected = results.filter(r => r.status === 'rejected');
      
      expect(rejected.length).toBeGreaterThan(0);
      expect(rejected[0].reason.message).toContain('Connection limit exceeded');
    });
  });
});