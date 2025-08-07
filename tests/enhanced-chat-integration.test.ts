import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnhancedChatManager } from '../src/managers/enhancedChatManager.js';
import { deleteChatTool, listChatsTool, getChatInfoTool } from '../src/tools/chat-management-tools.js';

describe('Enhanced Chat System Integration Tests', () => {
  let chatManager: EnhancedChatManager;

  beforeEach(async () => {
    chatManager = EnhancedChatManager.getInstance();
    chatManager.reset();
  });

  afterEach(async () => {
    // Cleanup handled by EnhancedChatManager persistence layer
  });

  describe('🚀 JSON Persistence Integration', () => {
    it('should create and persist chats across manager instances', async () => {
      // Create chat with first instance
      const chatId = await chatManager.createChat('Integration Test Chat', 'test-agent');
      expect(typeof chatId).toBe('string');
      expect(chatId).toMatch(/^[a-f0-9]{8}(-[a-z0-9]+)?$/);

      // Add a message
      await chatManager.addMessage(chatId, 'test-agent', 'Hello from integration test');

      // Verify chat persists by creating new manager instance
      const newManager = EnhancedChatManager.getInstance();
      const retrievedChat = await newManager.getChat(chatId);
      
      expect(retrievedChat).toBeDefined();
      expect(retrievedChat!.title).toBe('Integration Test Chat');
      expect(retrievedChat!.messages).toHaveLength(1);
      expect(retrievedChat!.messages[0].message).toBe('Hello from integration test');
    });

    it('should handle agent participation states correctly', async () => {
      const chatId = await chatManager.createChat('Agent State Test', 'agent1');
      
      // Agent1 adds first message (should be 'new' state)
      await chatManager.addMessage(chatId, 'agent1', 'First message from agent1');
      
      // Agent2 joins (should be 'new' state, gets full history)
      const agent2Messages = await chatManager.getMessagesForAgent(chatId, 'agent2');
      expect(agent2Messages).toHaveLength(1); // Full history
      
      // Agent2 adds message
      await chatManager.addMessage(chatId, 'agent2', 'Response from agent2');
      
      // Agent1 returns (should be 'returning' state, gets delta)
      const agent1ReturnMessages = await chatManager.getMessagesForAgent(chatId, 'agent1');
      expect(agent1ReturnMessages).toHaveLength(1); // Only new message since last seen
      expect(agent1ReturnMessages[0].message).toBe('Response from agent2');
      
      // Agent1 continues (should transition to 'continuous' state)
      await chatManager.addMessage(chatId, 'agent1', 'Follow-up from agent1');
      const agent1ContinuousMessages = await chatManager.getMessagesForAgent(chatId, 'agent1', 'Gemini response');
      expect(agent1ContinuousMessages).toHaveLength(1); // Only Gemini reply
    });

    it('should generate separate Gemini CLI files', async () => {
      const chatId = await chatManager.createChat('Gemini File Test', 'test-agent');
      await chatManager.addMessage(chatId, 'test-agent', 'Test message for Gemini');
      
      const result = await chatManager.generateChatHistoryFile(chatId, 'Current prompt', 'test-agent');
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.filePath).toBeDefined();
        expect(result.fileReference).toContain('@');
        
        // Verify file exists and has correct structure
        const fs = await import('fs');
        const fileExists = await fs.promises.access(result.filePath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);
      }
    });
  });

  describe('🛠️ MCP Tools Integration', () => {
    it('should list chats via MCP tool', async () => {
      // Create test chats
      await chatManager.createChat('Chat 1', 'agent1');
      await chatManager.createChat('Chat 2', 'agent2');
      
      const result = await listChatsTool.execute({ includeDetails: true });
      
      expect(result).toMatch(/Active Chats \(\d+\)/);
      expect(result).toContain('Chat 1');
      expect(result).toContain('Chat 2');
      expect(result).toContain('agent1');
      expect(result).toContain('agent2');
    });

    it('should get detailed chat info via MCP tool', async () => {
      const chatId = await chatManager.createChat('Detailed Info Test', 'info-agent');
      await chatManager.addMessage(chatId, 'info-agent', 'Test message');
      
      const result = await getChatInfoTool.execute({ chatId: chatId.toString() });
      
      expect(result).toContain(`Chat ${chatId} Information`);
      expect(result).toContain('Detailed Info Test');
      expect(result).toContain('info-agent');
      expect(result).toContain('💬 Total messages:** 1');
      expect(result).toContain('Agent Participation States');
    });

    it('should delete chats via MCP tool', async () => {
      const chatId = await chatManager.createChat('Delete Test Chat', 'delete-agent');
      
      // Verify chat exists
      const chatBefore = await chatManager.getChat(chatId);
      expect(chatBefore).toBeDefined();
      
      // Delete via MCP tool
      const deleteResult = await deleteChatTool.execute({ chatId: chatId.toString() });
      expect(deleteResult).toContain('✅');
      expect(deleteResult).toContain('deleted successfully');
      
      // Verify chat is gone
      const chatAfter = await chatManager.getChat(chatId);
      expect(chatAfter).toBeNull();
    });
  });

  describe('🔧 Storage Management', () => {
    it('should provide storage path information', async () => {
      await chatManager.initialize();
      
      const paths = chatManager.getStoragePaths();
      
      expect(paths.base).toBeDefined();
      expect(paths.storage).toBeDefined();
      expect(paths.gemini).toBeDefined();
      
      expect(paths.base).toContain('gemini-mcp-');
      expect(paths.storage).toContain('storage');
      expect(paths.gemini).toContain('gemini');
    });

    it('should handle cleanup operations', async () => {
      const persistence = await chatManager.getPersistence();
      
      // Create a chat to test cleanup
      await chatManager.createChat('Cleanup Test', 'cleanup-agent');
      
      const cleanupResult = await persistence.cleanupExpiredFiles();
      
      expect(cleanupResult).toHaveProperty('deletedCount');
      expect(cleanupResult).toHaveProperty('errors');
      expect(typeof cleanupResult.deletedCount).toBe('number');
      expect(typeof cleanupResult.errors).toBe('number');
    });
  });

  describe('🎭 Compatibility & Migration', () => {
    it('should maintain backwards compatibility with existing Chat interface', async () => {
      const chatId = await chatManager.createChat('Compatibility Test', 'compat-agent');
      const chat = await chatManager.getChat(chatId);
      
      expect(chat).toBeDefined();
      
      // Verify all expected properties exist
      expect(chat!.id).toBe(chatId.toString());
      expect(chat!.title).toBe('Compatibility Test');
      expect(chat!.participants).toContain('compat-agent');
      expect(chat!.messages).toBeDefined();
      expect(chat!.created).toBeInstanceOf(Date);
      expect(chat!.lastActivity).toBeInstanceOf(Date);
      expect(chat!.status).toBe('active');
      expect(chat!.agentsWithHistory).toBeInstanceOf(Set);
    });

    it('should handle quota management', async () => {
      const agentName = 'quota-test-agent';
      
      // Create chats up to quota limit (assuming max 10)
      const chatIds = [];
      for (let i = 0; i < 10; i++) {
        const chatId = await chatManager.createChat(`Chat ${i + 1}`, agentName);
        chatIds.push(chatId);
      }
      
      // Attempt to create one more (should fail)
      await expect(
        chatManager.createChat('Over Quota Chat', agentName)
      ).rejects.toThrow('Chat creation quota exceeded');
    });
  });

  describe('📊 Performance & Reliability', () => {
    it('should handle rapid chat operations', async () => {
      const startTime = Date.now();
      const operations = [];
      
      // Create multiple chats rapidly
      for (let i = 0; i < 5; i++) {
        operations.push(
          chatManager.createChat(`Rapid Chat ${i}`, `agent-${i}`)
        );
      }
      
      const chatIds = await Promise.all(operations);
      expect(chatIds).toHaveLength(5);
      
      // Add messages to all chats
      const messageOps = [];
      for (let i = 0; i < chatIds.length; i++) {
        messageOps.push(
          chatManager.addMessage(chatIds[i], `agent-${i}`, `Message ${i}`)
        );
      }
      
      await Promise.all(messageOps);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain data integrity across operations', async () => {
      const chatId = await chatManager.createChat('Integrity Test', 'integrity-agent');
      
      // Add multiple messages
      await chatManager.addMessage(chatId, 'integrity-agent', 'Message 1');
      await chatManager.addMessage(chatId, 'other-agent', 'Message 2');
      await chatManager.addMessage(chatId, 'integrity-agent', 'Message 3');
      
      // Retrieve and verify
      const chat = await chatManager.getChat(chatId);
      expect(chat!.messages).toHaveLength(3);
      expect(chat!.participants).toContain('integrity-agent');
      expect(chat!.participants).toContain('other-agent');
      
      // Verify agent participation summary
      const summary = await chatManager.getAgentParticipationSummary(chatId);
      expect(summary).toContain('integrity-agent');
      expect(summary).toContain('other-agent');
    });
  });
});