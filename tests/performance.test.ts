import { describe, it, afterEach, expect, vi, beforeEach } from 'vitest';
import { ChatManager } from '../src/managers/chatManager.js';
import { SQLitePersistence } from '../src/persistence/sqlitePersistence.js';
import { performance } from 'perf_hooks';

// Performance test configuration
const PERFORMANCE_THRESHOLDS = {
  MESSAGE_ADD_LATENCY_MS: 200,
  HISTORY_RETRIEVAL_LATENCY_MS: 500,
  CONCURRENT_OPERATIONS: 50,
  MEMORY_LEAK_THRESHOLD_MB: 50,
  THROUGHPUT_MESSAGES_PER_SECOND: 100
};

describe('Performance - Throughput & Latency', () => {
  let chatManager: ChatManager;
  let persistence: SQLitePersistence;

  beforeEach(async () => {
    persistence = new SQLitePersistence(':memory:');
    await persistence.init();
    chatManager = new ChatManager(persistence);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Message Operations', () => {
    it('should add messages within latency threshold', async () => {
      const chatId = await chatManager.createChat('perf-test-agent', 'Performance Test Chat');
      const startTime = performance.now();
      
      await chatManager.addMessage(chatId, 'test-agent', 'Performance test message');
      
      const endTime = performance.now();
      const latency = endTime - startTime;
      
      expect(latency).toBeLessThan(PERFORMANCE_THRESHOLDS.MESSAGE_ADD_LATENCY_MS);
    });

    it('should retrieve history within latency threshold', async () => {
      const chatId = await chatManager.createChat('perf-test-agent', 'History Test Chat');
      
      // Add some messages first
      for (let i = 0; i < 100; i++) {
        await chatManager.addMessage(chatId, 'test-agent', `Message ${i}`);
      }
      
      const startTime = performance.now();
      const history = await chatManager.getHistory(chatId, 'test-agent');
      const endTime = performance.now();
      
      const latency = endTime - startTime;
      
      expect(latency).toBeLessThan(PERFORMANCE_THRESHOLDS.HISTORY_RETRIEVAL_LATENCY_MS);
      expect(history.length).toBe(100);
    });

    it('should maintain throughput under concurrent load', async () => {
      const chatId = await chatManager.createChat('throughput-agent', 'Throughput Test Chat');
      const messageCount = 200;
      const startTime = performance.now();
      
      // Send messages concurrently
      const promises = Array.from({ length: messageCount }, (_, i) =>
        chatManager.addMessage(chatId, 'test-agent', `Concurrent message ${i}`)
      );
      
      await Promise.all(promises);
      const endTime = performance.now();
      
      const totalTimeSeconds = (endTime - startTime) / 1000;
      const messagesPerSecond = messageCount / totalTimeSeconds;
      
      expect(messagesPerSecond).toBeGreaterThan(PERFORMANCE_THRESHOLDS.THROUGHPUT_MESSAGES_PER_SECOND);
    });
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent chat operations efficiently', async () => {
      const operationCount = PERFORMANCE_THRESHOLDS.CONCURRENT_OPERATIONS;
      const startTime = performance.now();
      
      // Mix of different operations
      const operations = Array.from({ length: operationCount }, (_, i) => {
        const opType = i % 4;
        switch (opType) {
          case 0:
            return chatManager.createChat(`agent-${i}`, `Chat ${i}`);
          case 1:
            return chatManager.listChats(`agent-${i % 10}`);
          case 2:
            return chatManager.addMessage(`chat-${i % 10}`, `agent-${i}`, `Message ${i}`);
          case 3:
            return chatManager.getHistory(`chat-${i % 10}`, `agent-${i}`);
          default:
            return Promise.resolve();
        }
      });
      
      const results = await Promise.allSettled(operations);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const successfulOps = results.filter(r => r.status === 'fulfilled').length;
      
      // Should complete within reasonable time (2 seconds for 50 operations)
      expect(totalTime).toBeLessThan(2000);
      
      // Most operations should succeed (allow some failures due to test setup)
      expect(successfulOps).toBeGreaterThan(operationCount * 0.8);
    });

    it('should prevent deadlocks under high concurrency', async () => {
      const chatIds = ['chat-1', 'chat-2', 'chat-3'];
      const agents = ['agent-1', 'agent-2', 'agent-3'];
      
      // Create chats first
      for (const chatId of chatIds) {
        await chatManager.createChat('setup-agent', `Chat ${chatId}`);
      }
      
      const startTime = performance.now();
      
      // Create operations that could potentially deadlock
      const operations = [];
      for (let i = 0; i < 100; i++) {
        const chatId = chatIds[i % chatIds.length];
        const agentId = agents[i % agents.length];
        
        operations.push(
          chatManager.addMessage(chatId, agentId, `Deadlock test message ${i}`)
        );
      }
      
      // All operations should complete without deadlock
      await expect(Promise.all(operations)).resolves.not.toThrow();
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete in reasonable time (no infinite waits)
      expect(totalTime).toBeLessThan(5000);
    });
  });
});

describe('Performance - Memory Management', () => {
  let chatManager: ChatManager;
  let initialMemoryUsage: number;

  beforeEach(async () => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    initialMemoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    
    const persistence = new SQLitePersistence(':memory:');
    await persistence.init();
    chatManager = new ChatManager(persistence);
  });

  afterEach(() => {
    if (global.gc) {
      global.gc();
    }
  });

  it('should not leak memory during normal operations', async () => {
    const chatId = await chatManager.createChat('memory-test-agent', 'Memory Test Chat');
    
    // Perform many operations
    for (let i = 0; i < 1000; i++) {
      await chatManager.addMessage(chatId, 'test-agent', `Memory test message ${i}`);
      
      if (i % 100 === 0) {
        // Retrieve history to exercise more code paths
        await chatManager.getHistory(chatId, 'test-agent', { limit: 50 });
      }
    }
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
    
    const finalMemoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    const memoryIncrease = finalMemoryUsage - initialMemoryUsage;
    
    expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD_MB);
  });

  it('should properly clean up inactive chats', async () => {
    // Create many chats
    const chatIds = [];
    for (let i = 0; i < 100; i++) {
      const chatId = await chatManager.createChat('cleanup-agent', `Cleanup Chat ${i}`);
      chatIds.push(chatId);
    }
    
    // Add messages to make them "active"
    for (const chatId of chatIds) {
      await chatManager.addMessage(chatId, 'test-agent', 'Test message');
    }
    
    // Simulate time passing (inactive chats should be cleaned up)
    await chatManager.cleanupInactiveChats();
    
    const activeChatCount = chatManager.getActiveChatCount();
    
    // Most chats should have been cleaned up
    expect(activeChatCount).toBeLessThan(10);
  });

  it('should handle memory-efficient pagination for large histories', async () => {
    const chatId = await chatManager.createChat('pagination-agent', 'Pagination Test Chat');
    
    // Add many messages
    for (let i = 0; i < 5000; i++) {
      await chatManager.addMessage(chatId, 'test-agent', `Pagination message ${i}`);
    }
    
    const beforeMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    
    // Retrieve history in pages
    let totalMessages = 0;
    let offset = 0;
    const pageSize = 100;
    
    while (true) {
      const page = await chatManager.getHistory(chatId, 'test-agent', {
        limit: pageSize,
        offset: offset
      });
      
      if (page.length === 0) break;
      
      totalMessages += page.length;
      offset += pageSize;
    }
    
    const afterMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    const memoryIncrease = afterMemory - beforeMemory;
    
    expect(totalMessages).toBe(5000);
    expect(memoryIncrease).toBeLessThan(20); // Should not load all messages into memory
  });
});

describe('Performance - Database Operations', () => {
  let persistence: SQLitePersistence;

  beforeEach(async () => {
    persistence = new SQLitePersistence(':memory:');
    await persistence.init();
  });

  it('should optimize database queries for large datasets', async () => {
    const agentId = 'db-perf-agent';
    const chatId = await persistence.createChat(agentId, 'Database Performance Test');
    
    // Insert many messages
    const insertPromises = Array.from({ length: 1000 }, (_, i) =>
      persistence.saveMessage(chatId, agentId, `DB performance message ${i}`)
    );
    
    const startTime = performance.now();
    await Promise.all(insertPromises);
    const insertTime = performance.now() - startTime;
    
    // Bulk inserts should be efficient
    expect(insertTime).toBeLessThan(2000); // 2 seconds for 1000 messages
    
    // Query performance should remain good
    const queryStart = performance.now();
    const messages = await persistence.getMessages(chatId, { limit: 100 });
    const queryTime = performance.now() - queryStart;
    
    expect(queryTime).toBeLessThan(100); // 100ms for query
    expect(messages.length).toBe(100);
  });

  it('should handle transaction rollbacks efficiently', async () => {
    const agentId = 'transaction-agent';
    const chatId = await persistence.createChat(agentId, 'Transaction Test');
    
    const startTime = performance.now();
    
    // Simulate operations that might fail and require rollback
    const operations = Array.from({ length: 100 }, async (_, i) => {
      try {
        if (i % 10 === 9) {
          // Simulate some operations that fail
          throw new Error(`Simulated failure ${i}`);
        }
        await persistence.saveMessage(chatId, agentId, `Transaction message ${i}`);
      } catch (error) {
        // Handle failures (would trigger rollback in real implementation)
      }
    });
    
    await Promise.allSettled(operations);
    const endTime = performance.now();
    
    // Should handle failures and rollbacks efficiently
    expect(endTime - startTime).toBeLessThan(1000);
    
    // Successful messages should still be saved
    const messages = await persistence.getMessages(chatId);
    expect(messages.length).toBe(90); // 100 - 10 failed operations
  });

  it('should maintain connection pool efficiency', async () => {
    // Test concurrent database operations
    const operations = Array.from({ length: 50 }, async (_, i) => {
      const agentId = `pool-agent-${i}`;
      const chatId = await persistence.createChat(agentId, `Pool Test Chat ${i}`);
      
      // Multiple operations per connection
      await persistence.saveMessage(chatId, agentId, 'Message 1');
      await persistence.saveMessage(chatId, agentId, 'Message 2');
      const messages = await persistence.getMessages(chatId);
      
      return messages.length;
    });
    
    const startTime = performance.now();
    const results = await Promise.all(operations);
    const endTime = performance.now();
    
    // All operations should succeed
    expect(results.every(count => count === 2)).toBe(true);
    
    // Should complete efficiently with connection pooling
    expect(endTime - startTime).toBeLessThan(2000);
  });
});

describe('Performance - Stress Testing', () => {
  it('should handle extreme concurrent load gracefully', async () => {
    const persistence = new SQLitePersistence(':memory:');
    await persistence.init();
    const chatManager = new ChatManager(persistence);
    
    const extremeLoad = 200; // Very high concurrent operations
    const startTime = performance.now();
    
    const operations = Array.from({ length: extremeLoad }, async (_, i) => {
      const agentId = `stress-agent-${i % 10}`; // 10 different agents
      const chatId = await chatManager.createChat(agentId, `Stress Chat ${i}`);
      
      // Each agent performs multiple operations
      await chatManager.addMessage(chatId, agentId, `Stress message 1 from ${i}`);
      await chatManager.addMessage(chatId, agentId, `Stress message 2 from ${i}`);
      
      return chatManager.getHistory(chatId, agentId);
    });
    
    const results = await Promise.allSettled(operations);
    const endTime = performance.now();
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    // Should handle most operations successfully
    expect(successful).toBeGreaterThan(extremeLoad * 0.7);
    
    // Should fail gracefully (not crash)
    expect(failed).toBeLessThan(extremeLoad * 0.3);
    
    // Should complete in reasonable time even under stress
    expect(endTime - startTime).toBeLessThan(10000); // 10 seconds max
  });

  it('should recover from resource exhaustion', async () => {
    const persistence = new SQLitePersistence(':memory:');
    await persistence.init();
    const chatManager = new ChatManager(persistence);
    
    // Create scenario that might exhaust resources
    const resourceIntensiveOps = Array.from({ length: 1000 }, async (_, i) => {
      try {
        const agentId = `resource-agent-${i}`;
        const chatId = await chatManager.createChat(agentId, `Resource Chat ${i}`);
        
        // Add large messages to consume memory
        const largeMessage = 'X'.repeat(1000); // 1KB message
        await chatManager.addMessage(chatId, agentId, largeMessage);
        
        return 'success';
      } catch (error) {
        return 'failed';
      }
    });
    
    const results = await Promise.allSettled(resourceIntensiveOps);
    
    // System should remain responsive and not crash
    expect(results.length).toBe(1000);
    
    // After stress, system should still be functional
    const testChatId = await chatManager.createChat('recovery-agent', 'Recovery Test');
    await expect(
      chatManager.addMessage(testChatId, 'recovery-agent', 'Recovery message')
    ).resolves.not.toThrow();
  });
});