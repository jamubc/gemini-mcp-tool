import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { ChatHistoryFileManager } from '../src/utils/chatHistoryFileManager.js';
import { Chat, ChatMessage } from '../src/managers/chatManager.js';

describe('E2E Gemini CLI Integration Tests', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    tempDir = join(process.cwd(), '.gemini');
    await ChatHistoryFileManager.cleanupTempFiles(false);
  });

  afterEach(async () => {
    await ChatHistoryFileManager.cleanupTempFiles(false);
  });

  describe('🚀 End-to-End Gemini CLI Integration', () => {
    it('should generate temp files that Gemini CLI can read via @ syntax', async () => {
      // Create realistic chat with conversation history
      const testChat: Chat = {
        id: 'e2e-test',
        title: 'E2E Integration Test',
        createdBy: 'test-agent',
        messages: [
          {
            id: '1',
            chatId: 'e2e-test',
            agent: 'user',
            message: 'Hi! My name is Alice. What is 2 + 2?',
            timestamp: new Date('2024-01-01T10:00:00Z'),
            sanitized: false
          },
          {
            id: '2', 
            chatId: 'e2e-test',
            agent: 'assistant',
            message: 'Hello Alice! 2 + 2 equals 4.',
            timestamp: new Date('2024-01-01T10:01:00Z'),
            sanitized: false
          }
        ],
        participants: new Set(['user', 'assistant']),
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:01:00Z')
      };

      // Generate temp file
      const newPrompt = 'Alice here again! Remember I asked about 2+2? Now what is 3+3? Please mention my name to show you remember our conversation.';
      
      const fileResult = await ChatHistoryFileManager.createChatHistoryFile(
        testChat,
        newPrompt,
        true // Keep for testing
      );

      expect(fileResult.success).toBe(true);
      expect(fileResult.filePath).toBeDefined();

      // Verify file exists and has correct content
      const fileContent = await fs.readFile(fileResult.filePath!, 'utf8');
      const jsonData = JSON.parse(fileContent);
      
      expect(jsonData.chatId).toBe('e2e-test');
      expect(jsonData.messages).toHaveLength(2);
      expect(jsonData.messages[0].message).toContain('Alice');
      expect(jsonData.messages[1].message).toContain('4');
      expect(jsonData.currentPrompt).toContain('Alice here again');

      // Test file reference format
      const fileReference = ChatHistoryFileManager.generateFileReference(testChat.id);
      expect(fileReference).toBe('@.gemini/chat-e2e-test.json');
    });

    it('should create temp files with correct JSON structure for Gemini consumption', async () => {
      const testChat: Chat = {
        id: 'json-structure-test',
        title: 'JSON Structure Test',
        createdBy: 'test-agent', 
        messages: [
          {
            id: '1',
            chatId: 'json-structure-test',
            agent: 'user',
            message: 'Hello, I need help with JavaScript promises.',
            timestamp: new Date('2024-01-01T10:00:00Z'),
            sanitized: false
          },
          {
            id: '2',
            chatId: 'json-structure-test', 
            agent: 'assistant',
            message: 'I can help with promises! Here\'s a basic example:\n\n```javascript\nconst promise = new Promise((resolve, reject) => {\n  setTimeout(() => resolve("Success!"), 1000);\n});\n```',
            timestamp: new Date('2024-01-01T10:01:00Z'),
            sanitized: false
          }
        ],
        participants: new Set(['user', 'assistant']),
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:01:00Z')
      };

      const newPrompt = 'Can you show me how to handle promise errors with .catch()?';
      
      const fileResult = await ChatHistoryFileManager.createChatHistoryFile(
        testChat,
        newPrompt,
        true
      );

      const fileContent = await fs.readFile(fileResult.filePath!, 'utf8');
      const jsonData = JSON.parse(fileContent);

      // Validate required JSON structure for Gemini
      expect(jsonData).toHaveProperty('chatId');
      expect(jsonData).toHaveProperty('title');
      expect(jsonData).toHaveProperty('participants');
      expect(jsonData).toHaveProperty('messages');
      expect(jsonData).toHaveProperty('currentPrompt');
      expect(jsonData).toHaveProperty('metadata');

      // Validate messages structure
      expect(Array.isArray(jsonData.messages)).toBe(true);
      expect(jsonData.messages[0]).toHaveProperty('agent');
      expect(jsonData.messages[0]).toHaveProperty('message');
      expect(jsonData.messages[0]).toHaveProperty('timestamp');

      // Verify code preservation
      expect(jsonData.messages[1].message).toContain('```javascript');
      expect(jsonData.messages[1].message).toContain('Promise');

      // Verify current prompt
      expect(jsonData.currentPrompt).toBe(newPrompt);
    });

    it('should preserve conversation continuity in temp files', async () => {
      // Test with multi-turn conversation
      const conversationChat: Chat = {
        id: 'continuity-test',
        title: 'Conversation Continuity Test',
        createdBy: 'test-agent',
        messages: [
          {
            id: '1',
            chatId: 'continuity-test',
            agent: 'user',
            message: 'My name is Bob and I\'m learning Python. What\'s a list comprehension?',
            timestamp: new Date('2024-01-01T10:00:00Z'),
            sanitized: false
          },
          {
            id: '2',
            chatId: 'continuity-test',
            agent: 'assistant', 
            message: 'Hi Bob! A list comprehension is a concise way to create lists. Example: [x*2 for x in range(5)] creates [0, 2, 4, 6, 8]',
            timestamp: new Date('2024-01-01T10:01:00Z'),
            sanitized: false
          },
          {
            id: '3',
            chatId: 'continuity-test',
            agent: 'user',
            message: 'That\'s helpful! Can you show me a more complex example?',
            timestamp: new Date('2024-01-01T10:02:00Z'),
            sanitized: false
          },
          {
            id: '4',
            chatId: 'continuity-test',
            agent: 'assistant',
            message: 'Sure Bob! Here\'s a complex one: [word.upper() for sentence in sentences for word in sentence.split() if len(word) > 3]',
            timestamp: new Date('2024-01-01T10:03:00Z'),
            sanitized: false
          }
        ],
        participants: new Set(['user', 'assistant']),
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:03:00Z')
      };

      const followUpPrompt = 'Bob again! Based on our discussion about list comprehensions, can you explain dictionary comprehensions? Please reference our previous examples.';

      const fileResult = await ChatHistoryFileManager.createChatHistoryFile(
        conversationChat,
        followUpPrompt,
        true
      );

      const fileContent = await fs.readFile(fileResult.filePath!, 'utf8');
      const jsonData = JSON.parse(fileContent);

      // Verify all conversation history is preserved
      expect(jsonData.messages).toHaveLength(4);
      
      // Check chronological order
      const timestamps = jsonData.messages.map((m: any) => new Date(m.timestamp).getTime());
      const sortedTimestamps = [...timestamps].sort();
      expect(timestamps).toEqual(sortedTimestamps);

      // Verify participant consistency  
      expect(jsonData.participants).toContain('user');
      expect(jsonData.participants).toContain('assistant');

      // Check conversation flow preservation
      const allMessages = jsonData.messages.map((m: any) => m.message).join(' ');
      expect(allMessages).toContain('Bob');
      expect(allMessages).toContain('list comprehension');
      expect(allMessages).toContain('[x*2 for x');
      expect(allMessages).toContain('complex example');

      // Verify current prompt includes context reference
      expect(jsonData.currentPrompt).toContain('Bob again');
      expect(jsonData.currentPrompt).toContain('previous examples');
    });

    it('should handle large conversations within Windows CLI limits', async () => {
      // Create a large conversation that would exceed Windows CLI limits via string concatenation
      const messages: ChatMessage[] = [];
      
      for (let i = 0; i < 50; i++) {
        messages.push({
          id: `${i * 2 + 1}`,
          chatId: 'large-chat-test',
          agent: 'user',
          message: `This is message ${i} from the user. It contains enough text to make the total conversation very long, simulating a real-world scenario where chat history becomes substantial. Here's some code: function test${i}() { return "example ${i}"; }`,
          timestamp: new Date(`2024-01-01T${10 + Math.floor(i/60)}:${(i % 60).toString().padStart(2, '0')}:00Z`),
          sanitized: false
        });

        messages.push({
          id: `${i * 2 + 2}`,
          chatId: 'large-chat-test',
          agent: 'assistant',
          message: `Thank you for message ${i}! Here's my response with detailed explanation and code examples. This response is intentionally verbose to increase the total conversation size for testing purposes. The function you showed: test${i}() is well-written. Consider this enhancement: function enhancedTest${i}(param) { console.log('Enhanced version'); return param + "_enhanced_${i}"; }`,
          timestamp: new Date(`2024-01-01T${10 + Math.floor(i/60)}:${(i % 60 + 1).toString().padStart(2, '0')}:00Z`),
          sanitized: false
        });
      }

      const largeChat: Chat = {
        id: 'large-chat-test',
        title: 'Large Conversation Test',
        createdBy: 'test-agent',
        messages: messages,
        participants: new Set(['user', 'assistant']),
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T11:00:00Z')
      };

      const newPrompt = 'Based on all our previous discussion with those many examples, please provide a summary of the key concepts we covered.';

      const fileResult = await ChatHistoryFileManager.createChatHistoryFile(
        largeChat,
        newPrompt,
        true
      );

      expect(fileResult.success).toBe(true);

      // Verify file was created and is substantial
      const fileContent = await fs.readFile(fileResult.filePath!, 'utf8');
      expect(fileContent.length).toBeGreaterThan(10000); // Substantial file size

      const jsonData = JSON.parse(fileContent);
      
      // Verify it contains substantial message history
      expect(jsonData.messages.length).toBeGreaterThan(0);
      expect(jsonData.metadata.totalMessages).toBeGreaterThan(50);
      
      // This file size would have exceeded Windows CLI limits if passed as string
      console.log(`Large chat temp file created: ${fileContent.length} characters`);
      console.log(`Messages in file: ${jsonData.messages.length}`);
      console.log(`Estimated tokens: ${jsonData.metadata.estimatedTokens}`);
    });

    it('should generate valid @ file references that can be tested with Gemini CLI', async () => {
      const simpleChat: Chat = {
        id: 'cli-reference-test',
        title: 'CLI Reference Test', 
        createdBy: 'test-agent',
        messages: [
          {
            id: '1',
            chatId: 'cli-reference-test',
            agent: 'user',
            message: 'What is the capital of France?',
            timestamp: new Date('2024-01-01T10:00:00Z'),
            sanitized: false
          },
          {
            id: '2',
            chatId: 'cli-reference-test',
            agent: 'assistant',
            message: 'The capital of France is Paris.',
            timestamp: new Date('2024-01-01T10:01:00Z'),
            sanitized: false
          }
        ],
        participants: new Set(['user', 'assistant']),
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:01:00Z')
      };

      const newPrompt = 'What about Italy?';
      
      const fileResult = await ChatHistoryFileManager.createChatHistoryFile(
        simpleChat,
        newPrompt,
        true
      );

      expect(fileResult.success).toBe(true);

      // Generate the command-line string that would be used with Gemini CLI
      const fileReference = ChatHistoryFileManager.generateFileReference(simpleChat.id);
      const fullPrompt = `${fileReference}\n\n[test-agent]: ${newPrompt}`;

      // Verify the format is correct for Gemini CLI
      expect(fileReference).toMatch(/^@\.gemini\/chat-[\w-]+\.json$/);
      expect(fullPrompt).toContain('@.gemini/');
      expect(fullPrompt).toContain('[test-agent]:');

      // Log the actual command for manual verification
      console.log('\n🧪 Manual Test Command:');
      console.log(`gemini -m gemini-2.5-flash "${fullPrompt}"`);
      
      // Verify file exists at the expected location
      const expectedPath = fileReference.replace('@', '');
      const fullPath = join(process.cwd(), expectedPath);
      await expect(fs.access(fullPath)).resolves.not.toThrow();
    });
  });

  describe('🔍 Content Validation for Gemini Processing', () => {
    it('should preserve code blocks and special characters for Gemini', async () => {
      const codeChat: Chat = {
        id: 'code-preservation-test',
        title: 'Code Preservation Test',
        createdBy: 'test-agent',
        messages: [
          {
            id: '1',
            chatId: 'code-preservation-test', 
            agent: 'user',
            message: 'Can you help me with this React component?\n\n```jsx\nfunction MyComponent({ data }) {\n  return (\n    <div className="container">\n      {data?.map(item => <span key={item.id}>{item.name}</span>)}\n    </div>\n  );\n}\n```',
            timestamp: new Date('2024-01-01T10:00:00Z'),
            sanitized: false
          },
          {
            id: '2',
            chatId: 'code-preservation-test',
            agent: 'assistant', 
            message: 'Your React component looks good! Here\'s an enhanced version:\n\n```jsx\nfunction MyComponent({ data = [] }) {\n  if (!data.length) return <div>No data available</div>;\n  \n  return (\n    <div className="container">\n      {data.map(item => (\n        <span key={item.id} className="item">\n          {item.name}\n        </span>\n      ))}\n    </div>\n  );\n}\n```',
            timestamp: new Date('2024-01-01T10:01:00Z'),
            sanitized: false
          }
        ],
        participants: new Set(['user', 'assistant']),
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:01:00Z')
      };

      const newPrompt = 'Great! Now can you add TypeScript types to this component?';
      
      const fileResult = await ChatHistoryFileManager.createChatHistoryFile(
        codeChat,
        newPrompt,
        true
      );

      const fileContent = await fs.readFile(fileResult.filePath!, 'utf8');
      const jsonData = JSON.parse(fileContent);

      // Verify code blocks are preserved
      const allContent = JSON.stringify(jsonData);
      expect(allContent).toContain('```jsx');
      expect(allContent).toContain('function MyComponent');
      expect(allContent).toContain('className=');
      expect(allContent).toContain('data?.map');
      expect(allContent).toContain('key={item.id}');

      // Verify special characters are preserved
      expect(allContent).toContain('?.');  // Optional chaining
      expect(allContent).toContain('=>');  // Arrow functions
      expect(allContent).toContain('{ data = [] }'); // Default parameters
    });

    it('should maintain message order and agent attribution for Gemini context', async () => {
      const multiAgentChat: Chat = {
        id: 'multi-agent-test',
        title: 'Multi-Agent Test',
        createdBy: 'test-agent',
        messages: [
          {
            id: '1',
            chatId: 'multi-agent-test',
            agent: 'user',
            message: 'I need help with database design.',
            timestamp: new Date('2024-01-01T10:00:00Z'),
            sanitized: false
          },
          {
            id: '2', 
            chatId: 'multi-agent-test',
            agent: 'database-expert',
            message: 'I can help with database design! What type of data are you working with?',
            timestamp: new Date('2024-01-01T10:01:00Z'),
            sanitized: false
          },
          {
            id: '3',
            chatId: 'multi-agent-test',
            agent: 'user',
            message: 'It\'s for an e-commerce platform with products, users, and orders.',
            timestamp: new Date('2024-01-01T10:02:00Z'),
            sanitized: false
          },
          {
            id: '4',
            chatId: 'multi-agent-test',
            agent: 'security-expert', 
            message: 'For e-commerce, you\'ll need to consider PCI compliance and data encryption for payment info.',
            timestamp: new Date('2024-01-01T10:03:00Z'),
            sanitized: false
          }
        ],
        participants: new Set(['user', 'database-expert', 'security-expert']),
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:03:00Z')
      };

      const newPrompt = 'Based on both the database and security advice, what would be the best schema design?';

      const fileResult = await ChatHistoryFileManager.createChatHistoryFile(
        multiAgentChat,
        newPrompt,
        true
      );

      const fileContent = await fs.readFile(fileResult.filePath!, 'utf8');
      const jsonData = JSON.parse(fileContent);

      // Verify all agents are represented
      expect(jsonData.participants).toContain('user');
      expect(jsonData.participants).toContain('database-expert');
      expect(jsonData.participants).toContain('security-expert');

      // Verify message order is maintained
      expect(jsonData.messages).toHaveLength(4);
      expect(jsonData.messages[0].agent).toBe('user');
      expect(jsonData.messages[1].agent).toBe('database-expert');
      expect(jsonData.messages[2].agent).toBe('user'); 
      expect(jsonData.messages[3].agent).toBe('security-expert');

      // Verify agent-specific expertise is preserved
      expect(jsonData.messages[1].message).toContain('database design');
      expect(jsonData.messages[3].message).toContain('PCI compliance');
    });
  });
});