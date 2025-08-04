import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { performance } from 'perf_hooks';

// Global test setup for the inter-agent chat system testing

// Performance monitoring
let testStartTime: number;
let memoryBefore: NodeJS.MemoryUsage;

beforeAll(() => {
  console.log('🚀 Starting Inter-Agent Chat System Test Suite');
  console.log('='.repeat(60));
  
  // Enable garbage collection if available for memory tests
  if (global.gc) {
    console.log('✅ Garbage collection available for memory testing');
  } else {
    console.log('⚠️  Garbage collection not available - run with --expose-gc for memory tests');
  }
  
  // Set process title for debugging
  process.title = 'gemini-mcp-test-suite';
  
  // Global error handlers for unhandled errors
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
    console.error('Promise:', promise);
  });
  
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
  });
});

beforeEach(() => {
  // Reset performance tracking
  testStartTime = performance.now();
  memoryBefore = process.memoryUsage();
  
  // Force garbage collection before each test for consistent memory measurements
  if (global.gc) {
    global.gc();
  }
});

afterEach(() => {
  // Performance and memory reporting after each test
  const testDuration = performance.now() - testStartTime;
  const memoryAfter = process.memoryUsage();
  
  // Log performance warnings for slow tests
  if (testDuration > 5000) { // 5 seconds
    console.warn(`⚠️  Slow test detected: ${testDuration.toFixed(2)}ms`);
  }
  
  // Log memory warnings for high memory usage tests
  const memoryIncrease = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024; // MB
  if (memoryIncrease > 10) { // 10MB increase
    console.warn(`⚠️  High memory usage test: +${memoryIncrease.toFixed(2)}MB`);
  }
  
  // Cleanup any remaining timers or intervals
  clearTimeout(0);
  clearInterval(0);
});

afterAll(() => {
  console.log('='.repeat(60));
  console.log('✅ Inter-Agent Chat System Test Suite Complete');
  
  // Final memory report
  const finalMemory = process.memoryUsage();
  console.log('📊 Final Memory Usage:');
  console.log(`   Heap Used: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Heap Total: ${(finalMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   External: ${(finalMemory.external / 1024 / 1024).toFixed(2)} MB`);
  
  // Final garbage collection
  if (global.gc) {
    global.gc();
  }
  
  // Remove global error handlers
  process.removeAllListeners('unhandledRejection');
  process.removeAllListeners('uncaughtException');
});

// Global test utilities
declare global {
  namespace globalThis {
    var testUtils: {
      waitFor: (condition: () => boolean | Promise<boolean>, timeout?: number) => Promise<void>;
      createMockAgent: (id: string) => { id: string; name: string };
      createMockMessage: (agentId: string, content: string) => { 
        id: string; 
        agentId: string; 
        content: string; 
        timestamp: Date 
      };
      simulateDelay: (ms: number) => Promise<void>;
    };
  }
}

// Global test utilities
globalThis.testUtils = {
  // Wait for a condition to be true with timeout
  async waitFor(condition: () => boolean | Promise<boolean>, timeout = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const result = await condition();
      if (result) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50)); // Check every 50ms
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  },
  
  // Create a mock agent for testing
  createMockAgent(id: string) {
    return {
      id,
      name: `Agent ${id}`,
    };
  },
  
  // Create a mock message for testing
  createMockMessage(agentId: string, content: string) {
    return {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2)}`,
      agentId,
      content,
      timestamp: new Date()
    };
  },
  
  // Simulate network or processing delay
  async simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Environment-specific configuration
if (process.env.NODE_ENV === 'test') {
  // Reduce timeouts for faster test execution
  process.env.TEST_TIMEOUT = '30000';
  process.env.CHAT_LOCK_TIMEOUT = '1000';
  process.env.DB_QUERY_TIMEOUT = '5000';
}

// Export commonly used test constants
export const TEST_CONSTANTS = {
  AGENTS: {
    ALICE: 'alice-test-agent',
    BOB: 'bob-test-agent',
    CHARLIE: 'charlie-test-agent',
    ADMIN: 'admin-test-agent'
  },
  
  CHAT_NAMES: {
    PUBLIC: 'Public Test Chat',
    PRIVATE: 'Private Test Chat',
    GROUP: 'Group Test Chat'
  },
  
  TIMEOUTS: {
    SHORT: 1000,    // 1 second
    MEDIUM: 5000,   // 5 seconds
    LONG: 30000     // 30 seconds
  },
  
  LIMITS: {
    MAX_MESSAGE_LENGTH: 10000,
    MAX_MESSAGES_PER_CHAT: 1000,
    MAX_CHATS_PER_AGENT: 100
  }
} as const;

// Mock data generators
export const createTestData = {
  agent: (overrides: Partial<{ id: string; name: string }> = {}) => ({
    id: `test-agent-${Date.now()}`,
    name: 'Test Agent',
    ...overrides
  }),
  
  chat: (overrides: Partial<{ 
    id: string; 
    name: string; 
    agentId: string; 
    isPrivate: boolean 
  }> = {}) => ({
    id: `test-chat-${Date.now()}`,
    name: 'Test Chat',
    agentId: 'test-agent',
    isPrivate: false,
    createdAt: new Date(),
    ...overrides
  }),
  
  message: (overrides: Partial<{
    id: string;
    chatId: string;
    agentId: string;
    content: string;
    timestamp: Date;
  }> = {}) => ({
    id: `test-message-${Date.now()}`,
    chatId: 'test-chat',
    agentId: 'test-agent',
    content: 'Test message',
    timestamp: new Date(),
    ...overrides
  })
};

// Test database utilities
export const testDb = {
  async createInMemoryDb() {
    // This would return a fresh in-memory SQLite instance
    // Implementation depends on your SQLitePersistence class
    return ':memory:';
  },
  
  async cleanupDb(db: any) {
    // Cleanup function for database instances
    if (db && typeof db.close === 'function') {
      await db.close();
    }
  }
};

console.log('✅ Test setup complete - utilities and constants loaded');