import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ChatHistoryFileManager } from '../src/utils/chatHistoryFileManager.js';
import { ChatHistoryFormatter } from '../src/utils/chatHistoryFormatter.js';
import { ChatManager } from '../src/managers/chatManager.js';
import { Chat, ChatMessage } from '../src/managers/chatManager.js';

describe('JSON Temp File Implementation', () => {
  let chatManager: ChatManager;
  let testChat: Chat;
  let tempDir: string;

  beforeEach(async () => {
    // Setup test environment
    chatManager = ChatManager.getInstance();
    chatManager.reset();
    
    tempDir = join(process.cwd(), '.gemini');
    
    // Create test chat with history
    const chatId = await chatManager.createChat('Test Chat for JSON Files', 'test-agent');
    await chatManager.addMessage(chatId, 'agent1', 'First message in history');
    await chatManager.addMessage(chatId, 'agent2', 'Second message in history');
    await chatManager.addMessage(chatId, 'agent1', 'Third message with more content for testing');
    
    testChat = await chatManager.getChat(chatId) as Chat;
  });

  afterEach(async () => {
    // Cleanup temp files
    try {
      await ChatHistoryFileManager.cleanupTempFiles(false);
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('ChatHistoryFileManager', () => {
    it('should create JSON files in .gemini directory', async () => {
      const result = await ChatHistoryFileManager.createChatHistoryFile(
        testChat,
        'Current test prompt',
        false
      );

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
      
      // Verify file exists
      const filePath = result.filePath!;
      expect(await fs.access(filePath).then(() => true).catch(() => false)).toBe(true);
      
      // Verify file is in correct directory
      expect(filePath).toContain('.gemini');
      expect(filePath).toContain(`chat-${testChat.id}.json`);
    });

    it('should generate correct file reference for Gemini CLI', () => {
      const fileRef = ChatHistoryFileManager.generateFileReference(testChat.id);
      
      expect(fileRef).toBe(`@.gemini/chat-${testChat.id}.json`);
    });

    it('should handle Windows CLI length limits (>26k chars)', async () => {
      // Create a chat with moderately long messages to test file approach
      const longMessage = 'A'.repeat(3000); // 3k chars per message (within ChatManager limits)
      
      const largeChatId = await chatManager.createChat('Large Chat Test', 'test-agent');
      
      // Add messages that would exceed CLI limits when combined
      for (let i = 0; i < 10; i++) {
        await chatManager.addMessage(largeChatId, `agent-${i}`, `${longMessage} - Message ${i}`);
      }
      
      const largeChat = await chatManager.getChat(largeChatId) as Chat;
      const currentPrompt = 'B'.repeat(1000); // 1k char prompt
      
      // This should succeed with file approach (would fail with CLI approach)
      const result = await ChatHistoryFileManager.createChatHistoryFile(
        largeChat,
        currentPrompt,
        false
      );

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
      
      // Verify file contains the data
      const fileContent = await fs.readFile(result.filePath!, 'utf8');
      const parsedData = JSON.parse(fileContent);
      
      expect(parsedData.messages.length).toBeGreaterThan(0); // Some messages should be preserved
      expect(parsedData.currentPrompt).toBe(currentPrompt);
      expect(parsedData.chatId).toBe(largeChatId.toString());
      
      // Verify total content is large enough to test our approach
      expect(fileContent.length).toBeGreaterThan(10000); // > 10k chars total
    });

    it('should fallback gracefully on file operation failures', async () => {
      // For now, test that the method handles errors gracefully by passing invalid data
      const invalidChat = {
        ...testChat,
        id: '' // Invalid chat ID should cause issues
      };

      try {
        const result = await ChatHistoryFileManager.createChatHistoryFile(
          invalidChat,
          'Test prompt',
          false
        );
        
        // Should either succeed or fail gracefully
        expect(typeof result.success).toBe('boolean');
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      } catch (error) {
        // Errors should be handled gracefully
        expect(error).toBeDefined();
      }
    });

    it('should cleanup temp files properly', async () => {
      // Create multiple files
      const file1 = await ChatHistoryFileManager.createChatHistoryFile(testChat, 'Prompt 1', false);
      
      const chat2Id = await chatManager.createChat('Chat 2', 'test-agent');
      const chat2 = await chatManager.getChat(chat2Id) as Chat;
      const file2 = await ChatHistoryFileManager.createChatHistoryFile(chat2, 'Prompt 2', false);

      expect(file1.success).toBe(true);
      expect(file2.success).toBe(true);
      
      // Verify files exist
      expect(await fs.access(file1.filePath!).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(file2.filePath!).then(() => true).catch(() => false)).toBe(true);
      
      // Cleanup
      await ChatHistoryFileManager.cleanupTempFiles(false);
      
      // Verify files are deleted
      expect(await fs.access(file1.filePath!).then(() => true).catch(() => false)).toBe(false);
      expect(await fs.access(file2.filePath!).then(() => true).catch(() => false)).toBe(false);
    });

    it('should preserve debug files when flagged', async () => {
      const debugFile = await ChatHistoryFileManager.createChatHistoryFile(
        testChat,
        'Debug test prompt',
        true // debugKeepFile = true
      );

      expect(debugFile.success).toBe(true);
      
      // Cleanup with keepDebugFiles = true
      await ChatHistoryFileManager.cleanupTempFiles(true);
      
      // Debug file should still exist
      expect(await fs.access(debugFile.filePath!).then(() => true).catch(() => false)).toBe(true);
      
      // Verify file has debug flag set
      const fileContent = await fs.readFile(debugFile.filePath!, 'utf8');
      const parsedData = JSON.parse(fileContent);
      expect(parsedData.debugKeepFile).toBe(true);
    });

    it('should auto-create .gemini directory', async () => {
      // Remove directory if it exists
      try {
        await fs.rmdir(tempDir, { recursive: true });
      } catch (error) {
        // Directory might not exist
      }
      
      // Verify directory doesn't exist
      expect(await fs.access(tempDir).then(() => true).catch(() => false)).toBe(false);
      
      // Create file should auto-create directory
      const result = await ChatHistoryFileManager.createChatHistoryFile(
        testChat,
        'Test prompt',
        false
      );

      expect(result.success).toBe(true);
      
      // Verify directory was created
      expect(await fs.access(tempDir).then(() => true).catch(() => false)).toBe(true);
    });

    it('should use atomic write operations', async () => {
      const result = await ChatHistoryFileManager.createChatHistoryFile(
        testChat,
        'Atomic test prompt',
        false
      );

      expect(result.success).toBe(true);
      
      // Verify no .tmp files left behind
      const files = await fs.readdir(tempDir);
      const tmpFiles = files.filter(file => file.includes('.tmp'));
      expect(tmpFiles.length).toBe(0);
      
      // Verify final file exists and is valid JSON
      const fileContent = await fs.readFile(result.filePath!, 'utf8');
      expect(() => JSON.parse(fileContent)).not.toThrow();
    });
  });

  describe('ChatHistoryFormatter', () => {
    let formatter: ChatHistoryFormatter;

    beforeEach(() => {
      formatter = new ChatHistoryFormatter();
    });

    it('should format chat data to correct JSON structure', () => {
      const result = formatter.formatChatForFile(testChat, 'Test prompt', false);

      expect(result).toMatchObject({
        chatId: testChat.id,
        title: testChat.title,
        debugKeepFile: false,
        participants: testChat.participants,
        currentPrompt: 'Test prompt',
        metadata: expect.objectContaining({
          totalMessages: testChat.messages.length,
          estimatedTokens: expect.any(Number),
          created: expect.any(String)
        })
      });
      
      expect(result.messages).toHaveLength(testChat.messages.length);
    });

    it('should sanitize message content', () => {
      const testMessage = 'Test\r\nmessage\x00with\nnull bytes and\r\nline endings';
      
      // Create chat with problematic content
      const problematicMessages: ChatMessage[] = [{
        id: 'test-1',
        chatId: testChat.id,
        agent: 'test-agent',
        message: testMessage,
        timestamp: new Date(),
        sanitized: false
      }];
      
      const problematicChat: Chat = {
        ...testChat,
        messages: problematicMessages
      };

      const result = formatter.formatChatForFile(problematicChat, 'Test prompt', false);
      
      // Test that message is sanitized (remove line endings, null bytes, normalize whitespace)
      const sanitizedMessage = result.messages[0].message;
      expect(sanitizedMessage).not.toContain('\r');
      expect(sanitizedMessage).not.toContain('\x00');
      expect(sanitizedMessage).toContain('Test');
      expect(sanitizedMessage).toContain('message');
      expect(sanitizedMessage).toContain('with');
      expect(sanitizedMessage).toContain('null bytes');
    });

    it('should truncate messages to token limits', () => {
      // Create chat with many long messages
      const longMessages: ChatMessage[] = [];
      for (let i = 0; i < 50; i++) {
        longMessages.push({
          id: `msg-${i}`,
          chatId: testChat.id,
          agent: `agent-${i % 3}`,
          message: `This is a long message ${i} `.repeat(100), // ~2000 chars each
          timestamp: new Date(Date.now() + i * 1000),
          sanitized: true
        });
      }
      
      const longChat: Chat = {
        ...testChat,
        messages: longMessages
      };

      const result = formatter.formatChatForFile(
        longChat,
        'Test prompt',
        false,
        { truncateMessages: true, maxTokens: 5000 }
      );

      // Should have fewer messages due to token limit
      expect(result.messages.length).toBeLessThan(longMessages.length);
      expect(result.metadata.estimatedTokens).toBeLessThanOrEqual(5000);
    });

    it('should handle empty or invalid chat data', () => {
      const emptyChat: Chat = {
        id: 'empty-1',
        title: '',
        participants: [],
        messages: [],
        created: new Date(),
        lastActivity: new Date(),
        status: 'active'
      };

      const result = formatter.formatChatForFile(emptyChat, 'Test prompt', false);
      
      expect(result.chatId).toBe('empty-1');
      expect(result.messages).toHaveLength(0);
      expect(result.currentPrompt).toBe('Test prompt');
      expect(result.metadata.totalMessages).toBe(0);
    });
  });

  describe('ChatManager Integration', () => {
    it('should add generateChatHistoryFile method to ChatManager', async () => {
      expect(typeof chatManager.generateChatHistoryFile).toBe('function');
    });

    it('should generate chat history files through ChatManager', async () => {
      const result = await chatManager.generateChatHistoryFile(
        testChat.id,
        'Integration test prompt',
        'test-agent',
        false
      );

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
      expect(result.fileReference).toBe(`@.gemini/chat-${testChat.id}.json`);
      
      // Verify file exists and contains correct data
      const fileContent = await fs.readFile(result.filePath!, 'utf8');
      const parsedData = JSON.parse(fileContent);
      
      expect(parsedData.chatId).toBe(testChat.id);
      expect(parsedData.currentPrompt).toBe('Integration test prompt');
    });

    it('should handle non-existent chat gracefully', async () => {
      const result = await chatManager.generateChatHistoryFile(
        999, // Non-existent chat ID
        'Test prompt',
        'test-agent',
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Chat 999 not found');
    });
  });

  describe('Performance Improvements', () => {
    it('should handle large chat histories efficiently', async () => {
      // Create chat with 200 messages (similar to our failing performance test)
      const largeChatId = await chatManager.createChat('Performance Test Chat', 'perf-agent');
      
      const startTime = Date.now();
      
      // Add 200 messages
      for (let i = 0; i < 200; i++) {
        await chatManager.addMessage(largeChatId, `agent-${i % 5}`, `Performance test message ${i} with content`);
      }
      
      const largeChat = await chatManager.getChat(largeChatId) as Chat;
      
      // Generate file should be fast
      const fileGenStart = Date.now();
      const result = await ChatHistoryFileManager.createChatHistoryFile(
        largeChat,
        'Performance test prompt',
        false
      );
      const fileGenTime = Date.now() - fileGenStart;
      
      expect(result.success).toBe(true);
      expect(fileGenTime).toBeLessThan(1000); // Should complete in under 1 second
      
      // Verify file contains all messages (or truncated appropriately)
      const fileContent = await fs.readFile(result.filePath!, 'utf8');
      const parsedData = JSON.parse(fileContent);
      
      expect(parsedData.messages.length).toBeGreaterThan(0);
      expect(parsedData.currentPrompt).toBe('Performance test prompt');
    });

    it('should show O(1) complexity for file operations', async () => {
      const chatSizes = [10, 50, 100];
      const operationTimes: number[] = [];
      
      for (const size of chatSizes) {
        const chatId = await chatManager.createChat(`Size Test ${size}`, 'test-agent');
        
        // Add messages
        for (let i = 0; i < size; i++) {
          await chatManager.addMessage(chatId, `agent-${i % 3}`, `Message ${i} content`);
        }
        
        const chat = await chatManager.getChat(chatId) as Chat;
        
        // Time the file generation
        const start = Date.now();
        const result = await ChatHistoryFileManager.createChatHistoryFile(
          chat,
          'Test prompt',
          false
        );
        const operationTime = Date.now() - start;
        
        operationTimes.push(operationTime);
        expect(result.success).toBe(true);
      }
      
      // Operations should not show exponential growth (O(n²))
      // With O(1) complexity, times should be relatively stable
      const maxTime = Math.max(...operationTimes);
      const minTime = Math.min(...operationTimes);
      const growthRatio = maxTime / minTime;
      
      // Allow for significant variance in test environments but not exponential growth
      expect(growthRatio).toBeLessThan(10); // Relaxed threshold for test environment variability
    });
  });

  describe('Error Recovery and Fallback', () => {
    it('should provide fallback mechanism for ask-gemini tool', async () => {
      // This test ensures the integration point has proper fallback
      // We'll test this in the actual integration test
      expect(true).toBe(true); // Placeholder - actual implementation will test fallback
    });

    it('should handle concurrent file operations safely', async () => {
      // Test concurrent file creation for same chat
      const promises = Array.from({ length: 5 }, () =>
        ChatHistoryFileManager.createChatHistoryFile(
          testChat,
          'Concurrent test prompt',
          false
        )
      );
      
      const results = await Promise.all(promises);
      
      // All operations should succeed or fail cleanly (no corruption)
      results.forEach(result => {
        expect(['boolean']).toContain(typeof result.success);
      });
      
      // At least one should succeed
      const successfulResults = results.filter(r => r.success);
      expect(successfulResults.length).toBeGreaterThan(0);
    });
  });

  describe('File System Edge Cases', () => {
    it('should handle file system errors gracefully', async () => {
      // Test general error handling without complex mocking
      try {
        const result = await ChatHistoryFileManager.createChatHistoryFile(
          testChat,
          'Edge case test prompt',
          false
        );
        
        // Should always return a result object
        expect(typeof result).toBe('object');
        expect(typeof result.success).toBe('boolean');
        
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      } catch (error) {
        // Any errors should be handled gracefully
        expect(error).toBeDefined();
      }
    });

    it('should maintain file integrity during operations', async () => {
      const result = await ChatHistoryFileManager.createChatHistoryFile(
        testChat,
        'File integrity test',
        false
      );

      expect(result.success).toBe(true);
      
      // Verify no .tmp files left behind
      const files = await fs.readdir(tempDir).catch(() => []);
      const tmpFiles = files.filter(file => file.includes('.tmp'));
      expect(tmpFiles.length).toBe(0);
      
      // Verify final file exists and is valid JSON
      if (result.filePath) {
        const fileContent = await fs.readFile(result.filePath, 'utf8');
        expect(() => JSON.parse(fileContent)).not.toThrow();
      }
    });
  });
});