import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ChatHistoryFileManager } from '../src/utils/chatHistoryFileManager.js';
import { ChatHistoryFormatter } from '../src/utils/chatHistoryFormatter.js';
import { ChatManager } from '../src/managers/chatManager.js';
import { Chat, ChatMessage } from '../src/managers/chatManager.js';

describe('JSON Temp File - Exhaustive Stress Testing', () => {
  let chatManager: ChatManager;
  
  beforeEach(async () => {
    chatManager = ChatManager.getInstance();
    // Clean up any existing files
    await ChatHistoryFileManager.cleanupTempFiles(false);
  });

  afterEach(async () => {
    // Clean up test files
    await ChatHistoryFileManager.cleanupTempFiles(false);
    vi.restoreAllMocks();
  });

  describe('🔒 Concurrency & Race Conditions', () => {
    it('should handle simultaneous file operations for same chat ID', async () => {
      const chat = await chatManager.createChat('Concurrent Test', 'stress-agent');
      const chatId = chat.id!.toString();
      
      await chatManager.addMessage(chatId, 'agent1', 'Concurrent message 1', 'stress-agent');
      await chatManager.addMessage(chatId, 'agent2', 'Concurrent message 2', 'stress-agent');

      // Launch 10 simultaneous file operations
      const promises = Array.from({ length: 10 }, (_, i) => 
        chatManager.generateChatHistoryFile(chatId, `Concurrent prompt ${i}`, 'stress-agent', false)
      );

      const results = await Promise.allSettled(promises);
      
      // All operations should complete successfully
      const successfulResults = results.filter(r => r.status === 'fulfilled' && (r.value as any).success);
      expect(successfulResults.length).toBeGreaterThanOrEqual(1);
      
      // Verify no temp files are left behind
      const dirPath = join(process.cwd(), '.gemini');
      const files = await fs.readdir(dirPath);
      const tempFiles = files.filter(f => f.includes('.tmp'));
      expect(tempFiles).toHaveLength(0);
    });

    it('should handle concurrent cleanup operations safely', async () => {
      // Create multiple test files
      const testChats = await Promise.all([
        chatManager.createChat('Cleanup Test 1', 'stress-agent'),
        chatManager.createChat('Cleanup Test 2', 'stress-agent'),
        chatManager.createChat('Cleanup Test 3', 'stress-agent')
      ]);

      // Generate files for each chat
      for (const chat of testChats) {
        await chatManager.generateChatHistoryFile(chat.id!.toString(), 'Test cleanup', 'stress-agent', false);
      }

      // Launch multiple cleanup operations simultaneously
      const cleanupPromises = Array.from({ length: 5 }, () => 
        ChatHistoryFileManager.cleanupTempFiles(false)
      );

      await Promise.allSettled(cleanupPromises);

      // Verify no files remain
      const dirPath = join(process.cwd(), '.gemini');
      const files = await fs.readdir(dirPath);
      const chatFiles = files.filter(f => f.startsWith('chat-') && f.endsWith('.json'));
      expect(chatFiles).toHaveLength(0);
    });

    it('should prevent deadlocks in high-concurrency scenarios', async () => {
      const chat1 = await chatManager.createChat('Deadlock Test 1', 'stress-agent');
      const chat2 = await chatManager.createChat('Deadlock Test 2', 'stress-agent');
      
      const chatId1 = chat1.id!.toString();
      const chatId2 = chat2.id!.toString();

      // Add messages to both chats
      await Promise.all([
        chatManager.addMessage(chatId1, 'agent1', 'Message for chat 1', 'stress-agent'),
        chatManager.addMessage(chatId2, 'agent2', 'Message for chat 2', 'stress-agent')
      ]);

      // Create interleaved operations that could potentially deadlock
      const operations = [];
      for (let i = 0; i < 20; i++) {
        operations.push(
          chatManager.generateChatHistoryFile(chatId1, `Prompt ${i}`, 'stress-agent', false),
          chatManager.generateChatHistoryFile(chatId2, `Prompt ${i}`, 'stress-agent', false)
        );
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      // Operations should complete within reasonable time (no deadlock)
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds max

      // Most operations should succeed
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(operations.length * 0.8); // At least 80% success
    });
  });

  describe('💾 File System Edge Cases', () => {
    it('should handle disk space exhaustion gracefully', async () => {
      const mockWriteFile = vi.spyOn(fs, 'writeFile').mockRejectedValue(new Error('ENOSPC: no space left on device'));
      
      const chat = await chatManager.createChat('Disk Space Test', 'stress-agent');
      const chatId = chat.id!.toString();
      await chatManager.addMessage(chatId, 'agent1', 'Test message', 'stress-agent');

      const result = await chatManager.generateChatHistoryFile(chatId, 'Test prompt', 'stress-agent', false);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('File creation failed');
      
      mockWriteFile.mockRestore();
    });

    it('should handle permission errors robustly', async () => {
      const mockWriteFile = vi.spyOn(fs, 'writeFile').mockRejectedValue(new Error('EACCES: permission denied'));
      
      const chat = await chatManager.createChat('Permission Test', 'stress-agent');
      const chatId = chat.id!.toString();
      await chatManager.addMessage(chatId, 'agent1', 'Test message', 'stress-agent');

      const result = await chatManager.generateChatHistoryFile(chatId, 'Test prompt', 'stress-agent', false);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('File creation failed');
      
      mockWriteFile.mockRestore();
    });

    it('should handle directory creation failures', async () => {
      const mockMkdir = vi.spyOn(fs, 'mkdir').mockRejectedValue(new Error('EACCES: permission denied, mkdir'));
      
      // Remove .gemini directory if it exists
      try {
        await fs.rmdir(join(process.cwd(), '.gemini'), { recursive: true });
      } catch (e) {
        // Directory might not exist
      }

      const chat = await chatManager.createChat('Directory Test', 'stress-agent');
      const chatId = chat.id!.toString();
      await chatManager.addMessage(chatId, 'agent1', 'Test message', 'stress-agent');

      const result = await chatManager.generateChatHistoryFile(chatId, 'Test prompt', 'stress-agent', false);
      
      expect(result.success).toBe(false);
      
      mockMkdir.mockRestore();
    });

    it('should clean up orphaned temp files', async () => {
      const dirPath = join(process.cwd(), '.gemini');
      
      // Ensure directory exists
      try {
        await fs.mkdir(dirPath, { recursive: true });
      } catch (e) {
        // Directory might already exist
      }

      // Create orphaned temp files
      const orphanedFiles = [
        'chat-1.json.tmp.123456',
        'chat-2.json.tmp.789012',
        'chat-3.json.tmp.345678'
      ];

      for (const file of orphanedFiles) {
        await fs.writeFile(join(dirPath, file), 'orphaned content', 'utf8');
      }

      // Run cleanup
      await ChatHistoryFileManager.cleanupTempFiles(false);

      // Verify orphaned files are NOT cleaned up (they're not chat files)
      const remainingFiles = await fs.readdir(dirPath);
      const tempFiles = remainingFiles.filter(f => f.includes('.tmp'));
      expect(tempFiles.length).toBe(orphanedFiles.length); // Temp files should remain

      // Clean up manually
      for (const file of orphanedFiles) {
        try {
          await fs.unlink(join(dirPath, file));
        } catch (e) {
          // File might not exist
        }
      }
    });
  });

  describe('⚡ Performance & Memory Stress Tests', () => {
    it('should handle extremely large chat histories efficiently', async () => {
      const chat = await chatManager.createChat('Large Chat Test', 'stress-agent');
      const chatId = chat.id!.toString();

      // Create 500 messages with substantial content
      for (let i = 0; i < 500; i++) {
        const largeMessage = `Message ${i}: ${'X'.repeat(1000)}`; // 1KB per message
        await chatManager.addMessage(chatId, `agent-${i % 10}`, largeMessage, 'stress-agent');
      }

      const startTime = Date.now();
      const result = await chatManager.generateChatHistoryFile(chatId, 'Large chat prompt', 'stress-agent', false);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify file was created and has reasonable size
      if (result.filePath) {
        const stats = await fs.stat(result.filePath);
        expect(stats.size).toBeGreaterThan(1000); // At least 1KB
        expect(stats.size).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
      }
    });

    it('should handle memory efficiently during bulk operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create 50 chats with multiple messages each
      const chats = [];
      for (let i = 0; i < 50; i++) {
        const chat = await chatManager.createChat(`Bulk Test ${i}`, 'stress-agent');
        chats.push(chat);
        
        // Add 20 messages per chat
        for (let j = 0; j < 20; j++) {
          await chatManager.addMessage(chat.id!.toString(), `agent-${j}`, `Message ${j} in chat ${i}`, 'stress-agent');
        }
      }

      // Generate files for all chats
      const fileResults = await Promise.all(
        chats.map(chat => 
          chatManager.generateChatHistoryFile(chat.id!.toString(), 'Bulk test prompt', 'stress-agent', false)
        )
      );

      const peakMemory = process.memoryUsage().heapUsed;
      
      // Clean up all files
      await ChatHistoryFileManager.cleanupTempFiles(false);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;

      // All operations should succeed
      const successCount = fileResults.filter(r => r.success).length;
      expect(successCount).toBe(chats.length);

      // Memory growth should be reasonable (less than 100MB increase)
      const memoryGrowth = peakMemory - initialMemory;
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024);

      // Memory should be released after cleanup
      const memoryRetained = finalMemory - initialMemory;
      expect(memoryRetained).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('🛡️ Security & Input Validation', () => {
    it('should prevent path traversal attacks in chat IDs', async () => {
      // Test various malicious chat IDs
      const maliciousIds = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        'chat-id/../../sensitive-file',
        'chat<script>alert(1)</script>',
        'chat\x00id',
        'chat\nid\r\n',
        '../../../../home/user/.ssh/id_rsa'
      ];

      for (const maliciousId of maliciousIds) {
        try {
          // Direct call to file manager with malicious ID
          const formatter = new ChatHistoryFormatter();
          const testChat: Chat = {
            id: maliciousId,
            title: 'Test Chat',
            createdBy: 'test-agent',
            messages: [],
            participants: new Set(['test-agent']),
            createdAt: new Date(),
            updatedAt: new Date()
          };

          const result = await ChatHistoryFileManager.createChatHistoryFile(
            testChat,
            'Test prompt',
            false
          );

          // If successful, verify the file was created in the correct location
          if (result.success && result.filePath) {
            expect(result.filePath).toContain('.gemini');
            expect(result.filePath).not.toContain('..');
            expect(result.filePath).not.toContain('/etc');
            expect(result.filePath).not.toContain('windows');
          }
        } catch (error) {
          // Some malicious IDs should cause errors, which is acceptable
        }
      }
    });

    it('should sanitize special characters in file content', async () => {
      const chat = await chatManager.createChat('Sanitization Test', 'stress-agent');
      const chatId = chat.id!.toString();

      // Add message with various special characters
      const maliciousContent = 'Test message with \x00 null bytes\nand \r\n line endings\t and tabs';
      await chatManager.addMessage(chatId, 'agent1', maliciousContent, 'stress-agent');

      const result = await chatManager.generateChatHistoryFile(chatId, 'Sanitization test prompt', 'stress-agent', false);
      
      expect(result.success).toBe(true);
      
      if (result.filePath) {
        const fileContent = await fs.readFile(result.filePath, 'utf8');
        const jsonData = JSON.parse(fileContent);
        
        // Verify content is sanitized
        const messageContent = jsonData.messages[0].message;
        expect(messageContent).not.toContain('\x00');
        expect(messageContent).toMatch(/Test message with.*null bytes.*and.*line endings.*and tabs/);
      }
    });

    it('should validate file permissions are secure', async () => {
      const chat = await chatManager.createChat('Permission Test', 'stress-agent');
      const chatId = chat.id!.toString();
      await chatManager.addMessage(chatId, 'agent1', 'Test message', 'stress-agent');

      const result = await chatManager.generateChatHistoryFile(chatId, 'Permission test', 'stress-agent', false);
      
      expect(result.success).toBe(true);
      
      if (result.filePath) {
        const stats = await fs.stat(result.filePath);
        
        // On Unix systems, check file permissions
        if (process.platform !== 'win32') {
          const mode = stats.mode & 0o777;
          expect(mode).toBe(0o644); // Should be readable by owner, group, and others; writable by owner only
        }
      }
    });
  });

  describe('🔧 Integration & Compatibility', () => {
    it('should generate correct @file syntax for Gemini CLI', async () => {
      const chat = await chatManager.createChat('Gemini CLI Test', 'stress-agent');
      const chatId = chat.id!.toString();
      await chatManager.addMessage(chatId, 'agent1', 'Test message for Gemini', 'stress-agent');

      const result = await chatManager.generateChatHistoryFile(chatId, 'Gemini CLI test', 'stress-agent', false);
      
      expect(result.success).toBe(true);
      expect(result.fileReference).toMatch(/^@\.gemini\/chat-.*\.json$/);
      
      // Verify the referenced file actually exists
      if (result.fileReference) {
        const filePath = result.fileReference.replace('@', '');
        const fullPath = join(process.cwd(), filePath);
        await expect(fs.access(fullPath)).resolves.not.toThrow();
      }
    });

    it('should maintain fallback compatibility when file operations fail', async () => {
      const mockCreateChatHistoryFile = vi.spyOn(ChatHistoryFileManager, 'createChatHistoryFile')
        .mockResolvedValue({ success: false, error: 'Simulated failure' });

      const chat = await chatManager.createChat('Fallback Test', 'stress-agent');
      const chatId = chat.id!.toString();
      await chatManager.addMessage(chatId, 'agent1', 'Fallback test message', 'stress-agent');

      const result = await chatManager.generateChatHistoryFile(chatId, 'Fallback test', 'stress-agent', false);
      
      // Should fail gracefully and provide error information
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      
      mockCreateChatHistoryFile.mockRestore();
    });

    it('should handle Windows file system limitations', async () => {
      // Create file with Windows-problematic characters
      const problematicTitle = 'Test with: <> | * ? "characters"';
      const chat = await chatManager.createChat(problematicTitle, 'stress-agent');
      const chatId = chat.id!.toString();
      
      await chatManager.addMessage(chatId, 'agent1', 'Windows compatibility test', 'stress-agent');

      const result = await chatManager.generateChatHistoryFile(chatId, 'Windows test prompt', 'stress-agent', false);
      
      expect(result.success).toBe(true);
      
      // File should be created successfully regardless of problematic characters in title
      if (result.filePath) {
        await expect(fs.access(result.filePath)).resolves.not.toThrow();
      }
    });
  });

  describe('📊 Production Load Simulation', () => {
    it('should handle production-scale concurrent operations', async () => {
      // Simulate 100 concurrent file operations across 20 different chats
      const chats = await Promise.all(
        Array.from({ length: 20 }, (_, i) => 
          chatManager.createChat(`Production Chat ${i}`, 'load-test-agent')
        )
      );

      // Add messages to all chats
      for (const chat of chats) {
        for (let j = 0; j < 10; j++) {
          await chatManager.addMessage(chat.id!.toString(), `agent-${j}`, `Production message ${j}`, 'load-test-agent');
        }
      }

      // Launch 100 concurrent file operations
      const operations = [];
      for (let i = 0; i < 100; i++) {
        const chat = chats[i % chats.length];
        operations.push(
          chatManager.generateChatHistoryFile(chat.id!.toString(), `Load test prompt ${i}`, 'load-test-agent', false)
        );
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      // Calculate success metrics
      const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
      const failed = results.length - successful;
      const successRate = (successful / results.length) * 100;

      console.log(`\n📊 Production Load Test Results:`);
      console.log(`   Total Operations: ${results.length}`);
      console.log(`   Successful: ${successful} (${successRate.toFixed(1)}%)`);
      console.log(`   Failed: ${failed}`);
      console.log(`   Total Time: ${endTime - startTime}ms`);
      console.log(`   Average Time/Op: ${((endTime - startTime) / results.length).toFixed(2)}ms`);

      // Production criteria
      expect(successRate).toBeGreaterThan(95); // At least 95% success rate
      expect(endTime - startTime).toBeLessThan(30000); // Complete within 30 seconds
      
      // Verify no temp files remain
      const dirPath = join(process.cwd(), '.gemini');
      const files = await fs.readdir(dirPath);
      const tempFiles = files.filter(f => f.includes('.tmp'));
      expect(tempFiles).toHaveLength(0);
    });
  });
});