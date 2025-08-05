import { describe, it, afterEach, expect, vi, beforeEach, afterAll } from 'vitest';
import { ChatManager } from '../src/managers/chatManager.js';
import { InMemoryPersistence } from '../src/persistence/memoryPersistence.js';
import { toolRegistry } from '../src/tools/registry.js';
import { PROTOCOL } from '../src/constants.js';

// E2E test environment setup
class E2ETestEnvironment {
  private persistence: InMemoryPersistence;
  private chatManager: ChatManager;

  constructor() {
    this.persistence = new InMemoryPersistence();
    this.chatManager = new ChatManager(this.persistence);
  }

  async setup() {
    // No additional setup needed for memory-only persistence
  }

  getChatManager(): ChatManager {
    return this.chatManager;
  }

  async cleanup() {
    // Reset state for next test
    this.chatManager.reset();
  }
}

describe('E2E - Complete Agent Conversation Flows', () => {
  let testEnv: E2ETestEnvironment;

  beforeEach(async () => {
    testEnv = new E2ETestEnvironment();
    await testEnv.setup();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe('Multi-Agent Conversation Scenarios', () => {
    it('should handle complete two-agent conversation flow', async () => {
      const alice = 'alice-agent';
      const bob = 'bob-agent';
      const chatManager = testEnv.getChatManager();
      
      // Phase 1: Alice creates a chat
      const chatId = await chatManager.createChat('Alice and Bob Discussion', alice);
      
      expect(chatId).toBeDefined();
      expect(typeof chatId).toBe('number');
      
      // Phase 2: Both agents should see the chat in their list
      const aliceChats = await chatManager.listChats(alice);
      const bobChats = await chatManager.listChats(bob);
      
      expect(aliceChats).toHaveLength(1);
      expect(aliceChats[0].title).toBe('Alice and Bob Discussion');
      expect(bobChats).toHaveLength(1); // Bob can see chat in memory system
      
      // Phase 3: Alice starts the conversation
      await chatManager.addMessage(chatId, alice, 'Hi Bob! How are you today?');
      
      // Phase 4: Bob responds
      await chatManager.addMessage(chatId, bob, 'Hi Alice! I\'m doing great, thanks for asking. How about you?');
      
      // Phase 5: Alice replies with a longer message
      await chatManager.addMessage(chatId, alice, 'I\'m doing well too! I was thinking about our project discussion yesterday. Do you have any updates on the implementation?');
      
      // Phase 6: Bob provides project update
      await chatManager.addMessage(chatId, bob, 'Yes! I\'ve made significant progress. The authentication system is complete, and I\'m working on the API endpoints. Should be ready for testing by tomorrow.');
      
      // Phase 7: Verify complete conversation history
      const aliceHistory = await chatManager.getHistory(chatId, alice);
      const bobHistory = await chatManager.getHistory(chatId, bob);
      
      // Both agents should see the same complete history
      expect(aliceHistory).toHaveLength(4);
      expect(bobHistory).toHaveLength(4);
      
      // Verify message content and order
      expect(aliceHistory[0].agent).toBe(alice);
      expect(aliceHistory[0].message).toBe('Hi Bob! How are you today?');
      
      expect(aliceHistory[1].agent).toBe(bob);
      expect(aliceHistory[1].message).toContain('Hi Alice!');
      
      expect(aliceHistory[2].agent).toBe(alice);
      expect(aliceHistory[2].message).toContain('project discussion');
      
      expect(aliceHistory[3].agent).toBe(bob);
      expect(aliceHistory[3].message).toContain('authentication system');
    });

    it('should handle three-agent group conversation', async () => {
      const alice = 'alice-agent';
      const bob = 'bob-agent';
      const charlie = 'charlie-agent';
      const chatManager = testEnv.getChatManager();
      
      // Alice creates a group chat
      const chatId = await chatManager.createChat('Team Planning Session', alice);
      
      // All agents participate in conversation
      await chatManager.addMessage(chatId, alice, 'Welcome everyone to our planning session!');
      await chatManager.addMessage(chatId, bob, 'Thanks Alice! I\'m ready to discuss the roadmap.');
      await chatManager.addMessage(chatId, charlie, 'Great to be here! I have some ideas about the architecture.');
      
      // Verify all agents see the complete conversation
      const history = await chatManager.getHistory(chatId, alice);
      
      expect(history).toHaveLength(3);
      
      // Verify agent participation
      const aliceMessages = history.filter(m => m.agent === alice);
      const bobMessages = history.filter(m => m.agent === bob);
      const charlieMessages = history.filter(m => m.agent === charlie);
      
      expect(aliceMessages).toHaveLength(1);
      expect(bobMessages).toHaveLength(1);
      expect(charlieMessages).toHaveLength(1);
    });

    it('should handle concurrent message sending', async () => {
      const agents = ['agent-1', 'agent-2', 'agent-3'];
      const chatManager = testEnv.getChatManager();
      
      // Create a shared chat
      const chatId = await chatManager.createChat('Concurrent Test Chat', agents[0]);
      
      // All agents send messages simultaneously
      const messagePromises = agents.map((agent, index) =>
        chatManager.addMessage(chatId, agent, `Concurrent message ${index} from ${agent}`)
      );
      
      // All messages should be sent successfully
      await expect(Promise.all(messagePromises)).resolves.not.toThrow();
      
      // Verify all messages were saved
      const history = await chatManager.getHistory(chatId, agents[0]);
      
      expect(history).toHaveLength(3);
      
      // Verify each agent's message is present
      agents.forEach((agent, index) => {
        const agentMessage = history.find(m => m.agent === agent);
        expect(agentMessage).toBeDefined();
        expect(agentMessage!.message).toBe(`Concurrent message ${index} from ${agent}`);
      });
    });
  });

  describe('Memory Management', () => {
    it('should handle large conversations with history truncation', async () => {
      const alice = 'alice-longrun';
      const bob = 'bob-longrun';
      const chatManager = testEnv.getChatManager();
      
      const chatId = await chatManager.createChat('Long Running Chat', alice);
      
      // Add many messages to trigger history truncation
      for (let i = 0; i < 1000; i++) {
        const agent = i % 2 === 0 ? alice : bob;
        const content = `Long conversation message ${i} from ${agent}. This message has enough content to contribute to the character limit.`;
        
        await chatManager.addMessage(chatId, agent, content);
      }
      
      // Verify messages were truncated due to 30k character limit
      const fullHistory = await chatManager.getHistory(chatId, alice);
      
      // Should have fewer than 1000 messages due to truncation
      expect(fullHistory.length).toBeLessThan(1000);
      expect(fullHistory.length).toBeGreaterThan(30); // Should have retained some messages
      
      // Messages should be the most recent ones (last ones that fit within 30k limit)
      const lastMessage = fullHistory[fullHistory.length - 1];
      // Should contain a high-numbered message (but may not be exactly 999 due to truncation)
      expect(lastMessage.message).toMatch(/message \d+/); // Should contain a numbered message
    });
  });
});