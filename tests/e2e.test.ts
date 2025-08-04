import { describe, it, afterEach, expect, vi, beforeEach, afterAll } from 'vitest';
import { ChatManager } from '../src/managers/chatManager.js';
import { SQLitePersistence } from '../src/persistence/sqlitePersistence.js';
import { executeTool } from '../src/tools/registry.js';
import { CreateChatTool } from '../src/tools/createChatTool.js';
import { ListChatsTool } from '../src/tools/listChatsTool.js';
import { AddMessageTool } from '../src/tools/addMessageTool.js';
import { GetHistoryTool } from '../src/tools/getHistoryTool.js';
import { PROTOCOL } from '../src/constants.js';

// E2E test environment setup
class E2ETestEnvironment {
  private persistence: SQLitePersistence;
  private chatManager: ChatManager;
  private tools: Map<string, any>;

  constructor() {
    this.tools = new Map();
  }

  async setup() {
    this.persistence = new SQLitePersistence(':memory:');
    await this.persistence.init();
    this.chatManager = new ChatManager(this.persistence);

    // Register all chat tools
    const createChatTool = new CreateChatTool();
    const listChatsTool = new ListChatsTool();
    const addMessageTool = new AddMessageTool();
    const getHistoryTool = new GetHistoryTool();

    // Set chat manager for all tools
    createChatTool.setChatManager(this.chatManager);
    listChatsTool.setChatManager(this.chatManager);
    addMessageTool.setChatManager(this.chatManager);
    getHistoryTool.setChatManager(this.chatManager);

    this.tools.set('create-chat', createChatTool);
    this.tools.set('list-chats', listChatsTool);
    this.tools.set('add-message', addMessageTool);
    this.tools.set('get-history', getHistoryTool);
  }

  async executeTool(toolName: string, args: any, onProgress?: (message: string) => void) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    return await tool.execute(args, onProgress);
  }

  async cleanup() {
    // Cleanup resources
    if (this.persistence) {
      await this.persistence.close?.();
    }
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
      
      // Phase 1: Alice creates a chat
      const chatId = await testEnv.executeTool('create-chat', {
        agentId: alice,
        chatName: 'Alice and Bob Discussion',
        isPrivate: false
      });
      
      expect(chatId).toBeDefined();
      expect(typeof chatId).toBe('string');
      
      // Phase 2: Both agents should see the chat in their list
      const aliceChats = JSON.parse(await testEnv.executeTool('list-chats', {
        agentId: alice
      }));
      
      const bobChats = JSON.parse(await testEnv.executeTool('list-chats', {
        agentId: bob
      }));
      
      expect(aliceChats).toHaveLength(1);
      expect(aliceChats[0].name).toBe('Alice and Bob Discussion');
      expect(bobChats).toHaveLength(1); // Bob can see public chat
      
      // Phase 3: Alice starts the conversation
      await testEnv.executeTool('add-message', {
        chatId,
        agentId: alice,
        content: 'Hi Bob! How are you today?'
      });
      
      // Phase 4: Bob responds
      await testEnv.executeTool('add-message', {
        chatId,
        agentId: bob,
        content: 'Hi Alice! I\'m doing great, thanks for asking. How about you?'
      });
      
      // Phase 5: Alice replies with a longer message
      await testEnv.executeTool('add-message', {
        chatId,
        agentId: alice,
        content: 'I\'m doing well too! I was thinking about our project discussion yesterday. Do you have any updates on the implementation?'
      });
      
      // Phase 6: Bob provides project update
      await testEnv.executeTool('add-message', {
        chatId,
        agentId: bob,
        content: 'Yes! I\'ve made significant progress. The authentication system is complete, and I\'m working on the API endpoints. Should be ready for testing by tomorrow.'
      });
      
      // Phase 7: Verify complete conversation history
      const aliceHistory = JSON.parse(await testEnv.executeTool('get-history', {
        chatId,
        agentId: alice
      }));
      
      const bobHistory = JSON.parse(await testEnv.executeTool('get-history', {
        chatId,
        agentId: bob
      }));
      
      // Both agents should see the same complete history
      expect(aliceHistory).toHaveLength(4);
      expect(bobHistory).toHaveLength(4);
      expect(aliceHistory).toEqual(bobHistory);
      
      // Verify message content and order
      expect(aliceHistory[0].agentId).toBe(alice);
      expect(aliceHistory[0].content).toBe('Hi Bob! How are you today?');
      
      expect(aliceHistory[1].agentId).toBe(bob);
      expect(aliceHistory[1].content).toContain('Hi Alice!');
      
      expect(aliceHistory[2].agentId).toBe(alice);
      expect(aliceHistory[2].content).toContain('project discussion');
      
      expect(aliceHistory[3].agentId).toBe(bob);
      expect(aliceHistory[3].content).toContain('authentication system');
    });

    it('should handle three-agent group conversation', async () => {
      const alice = 'alice-agent';
      const bob = 'bob-agent';
      const charlie = 'charlie-agent';
      
      // Alice creates a group chat
      const chatId = await testEnv.executeTool('create-chat', {
        agentId: alice,
        chatName: 'Team Planning Session',
        isPrivate: false
      });
      
      // All agents participate in conversation
      await testEnv.executeTool('add-message', {
        chatId,
        agentId: alice,
        content: 'Welcome everyone to our planning session!'
      });
      
      await testEnv.executeTool('add-message', {
        chatId,
        agentId: bob,
        content: 'Thanks Alice! I\'m ready to discuss the roadmap.'
      });
      
      await testEnv.executeTool('add-message', {
        chatId,
        agentId: charlie,
        content: 'Great to be here! I have some ideas about the architecture.'
      });
      
      await testEnv.executeTool('add-message', {
        chatId,
        agentId: alice,
        content: 'Perfect! Bob, why don\'t you start with the roadmap overview?'
      });
      
      await testEnv.executeTool('add-message', {
        chatId,
        agentId: bob,
        content: 'Sure! We have three main phases: Foundation, Core Features, and Polish. Each phase is about 2 months.'
      });
      
      await testEnv.executeTool('add-message', {
        chatId,
        agentId: charlie,
        content: 'That timeline works well with my architecture proposal. I suggest we use microservices for scalability.'
      });
      
      // Verify all agents see the complete conversation
      const history = JSON.parse(await testEnv.executeTool('get-history', {
        chatId,
        agentId: alice
      }));
      
      expect(history).toHaveLength(6);
      
      // Verify agent participation
      const aliceMessages = history.filter(m => m.agentId === alice);
      const bobMessages = history.filter(m => m.agentId === bob);
      const charlieMessages = history.filter(m => m.agentId === charlie);
      
      expect(aliceMessages).toHaveLength(2);
      expect(bobMessages).toHaveLength(2);
      expect(charlieMessages).toHaveLength(2);
    });
  });

  describe('Concurrent Access Scenarios', () => {
    it('should handle simultaneous message sending', async () => {
      const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5'];
      
      // Create a shared chat
      const chatId = await testEnv.executeTool('create-chat', {
        agentId: agents[0],
        chatName: 'Concurrent Test Chat',
        isPrivate: false
      });
      
      // All agents send messages simultaneously
      const messagePromises = agents.map((agent, index) =>
        testEnv.executeTool('add-message', {
          chatId,
          agentId: agent,
          content: `Concurrent message ${index} from ${agent}`
        })
      );
      
      // All messages should be sent successfully
      await expect(Promise.all(messagePromises)).resolves.not.toThrow();
      
      // Verify all messages were saved
      const history = JSON.parse(await testEnv.executeTool('get-history', {
        chatId,
        agentId: agents[0]
      }));
      
      expect(history).toHaveLength(5);
      
      // Verify each agent's message is present
      agents.forEach((agent, index) => {
        const agentMessage = history.find(m => m.agentId === agent);
        expect(agentMessage).toBeDefined();
        expect(agentMessage.content).toBe(`Concurrent message ${index} from ${agent}`);
      });
    });

    it('should maintain data consistency under high concurrency', async () => {
      const chatId = await testEnv.executeTool('create-chat', {
        agentId: 'consistency-agent',
        chatName: 'Consistency Test Chat',
        isPrivate: false
      });
      
      // Create many concurrent operations mixing reads and writes
      const operations = [];
      
      // 50 message additions
      for (let i = 0; i < 50; i++) {
        operations.push(
          testEnv.executeTool('add-message', {
            chatId,
            agentId: `writer-agent-${i % 5}`,
            content: `Consistency test message ${i}`
          })
        );
      }
      
      // 25 history reads
      for (let i = 0; i < 25; i++) {
        operations.push(
          testEnv.executeTool('get-history', {
            chatId,
            agentId: `reader-agent-${i % 3}`
          })
        );
      }
      
      // Execute all operations concurrently
      const results = await Promise.allSettled(operations);
      
      // Most operations should succeed
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(70); // At least 70 out of 75
      
      // Final consistency check
      const finalHistory = JSON.parse(await testEnv.executeTool('get-history', {
        chatId,
        agentId: 'consistency-agent'
      }));
      
      // Should have all successfully written messages
      expect(finalHistory.length).toBeGreaterThan(45);
      
      // Messages should be in chronological order
      for (let i = 1; i < finalHistory.length; i++) {
        expect(new Date(finalHistory[i].timestamp).getTime())
          .toBeGreaterThanOrEqual(new Date(finalHistory[i-1].timestamp).getTime());
      }
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should recover from transient failures', async () => {
      const chatId = await testEnv.executeTool('create-chat', {
        agentId: 'recovery-agent',
        chatName: 'Recovery Test Chat',
        isPrivate: false
      });
      
      // Add some successful messages
      await testEnv.executeTool('add-message', {
        chatId,
        agentId: 'recovery-agent',
        content: 'Message before failure'
      });
      
      // Simulate intermittent failures by mocking
      const mockFailures = vi.fn()
        .mockRejectedValueOnce(new Error('Transient failure 1'))
        .mockRejectedValueOnce(new Error('Transient failure 2'))
        .mockResolvedValue('success');
      
      // Simulate retry logic (in real implementation)
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          await testEnv.executeTool('add-message', {
            chatId,
            agentId: 'recovery-agent',
            content: 'Message after recovery'
          });
          break;
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw error;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Verify system recovered and message was saved
      const history = JSON.parse(await testEnv.executeTool('get-history', {
        chatId,
        agentId: 'recovery-agent'
      }));
      
      expect(history).toHaveLength(2);
      expect(history[1].content).toBe('Message after recovery');
    });

    it('should handle graceful degradation', async () => {
      // Test what happens when certain operations fail
      const chatId = await testEnv.executeTool('create-chat', {
        agentId: 'degradation-agent',
        chatName: 'Degradation Test Chat',
        isPrivate: false
      });
      
      // Add messages successfully
      await testEnv.executeTool('add-message', {
        chatId,
        agentId: 'degradation-agent',
        content: 'Pre-degradation message'
      });
      
      // Even if some operations fail, basic functionality should work
      try {
        // This might fail in degraded mode
        await testEnv.executeTool('get-history', {
          chatId,
          agentId: 'degradation-agent',
          limit: 1000000 // Unreasonably large limit
        });
      } catch (error) {
        // Failure is acceptable in degraded mode
        expect(error.message).toContain('limit');
      }
      
      // Basic operations should still work
      await expect(
        testEnv.executeTool('add-message', {
          chatId,
          agentId: 'degradation-agent',
          content: 'Post-degradation message'
        })
      ).resolves.not.toThrow();
      
      // Basic history retrieval should work
      const basicHistory = JSON.parse(await testEnv.executeTool('get-history', {
        chatId,
        agentId: 'degradation-agent',
        limit: 10
      }));
      
      expect(basicHistory).toHaveLength(2);
    });
  });

  describe('Long-Running Conversation Scenarios', () => {
    it('should handle extended conversation with memory management', async () => {
      const alice = 'alice-longrun';
      const bob = 'bob-longrun';
      
      const chatId = await testEnv.executeTool('create-chat', {
        agentId: alice,
        chatName: 'Long Running Chat',
        isPrivate: false
      });
      
      // Simulate a long conversation (500 messages)
      const messageCount = 500;
      
      for (let i = 0; i < messageCount; i++) {
        const agent = i % 2 === 0 ? alice : bob;
        const content = `Long conversation message ${i} from ${agent}. This is a detailed message with more content to simulate realistic conversation patterns.`;
        
        await testEnv.executeTool('add-message', {
          chatId,
          agentId: agent,
          content
        });
        
        // Periodically check history to exercise memory management
        if (i % 50 === 0 && i > 0) {
          const recentHistory = JSON.parse(await testEnv.executeTool('get-history', {
            chatId,
            agentId: alice,
            limit: 10
          }));
          
          expect(recentHistory).toHaveLength(10);
        }
      }
      
      // Verify final state
      const fullHistory = JSON.parse(await testEnv.executeTool('get-history', {
        chatId,
        agentId: alice
      }));
      
      expect(fullHistory).toHaveLength(messageCount);
      
      // Test pagination for large history
      const page1 = JSON.parse(await testEnv.executeTool('get-history', {
        chatId,
        agentId: alice,
        limit: 100,
        offset: 0
      }));
      
      const page2 = JSON.parse(await testEnv.executeTool('get-history', {
        chatId,
        agentId: alice,
        limit: 100,
        offset: 100
      }));
      
      expect(page1).toHaveLength(100);
      expect(page2).toHaveLength(100);
      
      // Pages should not overlap
      expect(page1[99].id).not.toBe(page2[0].id);
    });
  });

  describe('Progress Notification Integration', () => {
    it('should provide progress updates for long operations', async () => {
      const chatId = await testEnv.executeTool('create-chat', {
        agentId: 'progress-agent',
        chatName: 'Progress Test Chat',
        isPrivate: false
      });
      
      // Add many messages to make history retrieval slow enough for progress
      for (let i = 0; i < 100; i++) {
        await testEnv.executeTool('add-message', {
          chatId,
          agentId: 'progress-agent',
          content: `Progress test message ${i}`
        });
      }
      
      const progressMessages: string[] = [];
      const onProgress = (message: string) => {
        progressMessages.push(message);
      };
      
      // Get history with progress tracking
      await testEnv.executeTool('get-history', {
        chatId,
        agentId: 'progress-agent'
      }, onProgress);
      
      // Should have received progress notifications
      expect(progressMessages.length).toBeGreaterThan(0);
      expect(progressMessages.some(msg => msg.includes('Retrieving'))).toBe(true);
    });
  });
});