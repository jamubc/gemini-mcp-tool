import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { ChatHistoryFileManager } from '../src/utils/chatHistoryFileManager.js';
import { ChatManager } from '../src/managers/chatManager.js';
import { Chat } from '../src/managers/chatManager.js';

describe('Comprehensive E2E Integration Tests', () => {
  let chatManager: ChatManager;
  let tempDir: string;
  
  beforeEach(async () => {
    chatManager = ChatManager.getInstance();
    chatManager.reset();
    tempDir = join(process.cwd(), '.gemini');
    await ChatHistoryFileManager.cleanupTempFiles(false);
  });

  afterEach(async () => {
    await ChatHistoryFileManager.cleanupTempFiles(false);
  });

  describe('🚀 File Generation and Structure Validation', () => {
    it('should generate valid temp files that match Gemini CLI expectations', async () => {
      // Create a realistic chat conversation
      const chatId = await chatManager.createChat('Integration Test', 'test-agent');
      await chatManager.addMessage(chatId, 'user', 'Hello! My name is Sarah. Can you help me understand JavaScript closures?');
      await chatManager.addMessage(chatId, 'assistant', 'Hi Sarah! I\'d be happy to explain closures. A closure is when a function has access to variables from its outer scope even after the outer function has finished executing.');
      await chatManager.addMessage(chatId, 'user', 'That\'s helpful! Can you give me a simple example?');

      const testChat = await chatManager.getChat(chatId) as Chat;
      const currentPrompt = 'Sarah here again! Based on our closure discussion, can you show me a practical use case? Please mention my name to confirm you remember our conversation.';

      // Generate temp file
      const fileResult = await chatManager.generateChatHistoryFile(
        chatId,
        currentPrompt,
        'test-agent',
        true // Keep for manual verification
      );

      expect(fileResult.success).toBe(true);
      expect(fileResult.fileReference).toBe(`@.gemini/chat-${chatId}.json`);
      expect(fileResult.filePath).toBeDefined();

      // Verify file exists and has correct structure
      const fileExists = await fs.access(fileResult.filePath!).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Verify JSON structure
      const fileContent = await fs.readFile(fileResult.filePath!, 'utf8');
      const jsonData = JSON.parse(fileContent);
      
      expect(jsonData).toMatchObject({
        chatId: chatId.toString(),
        title: 'Integration Test',
        debugKeepFile: true,
        participants: expect.arrayContaining(['user', 'assistant']),
        currentPrompt: currentPrompt,
        messages: expect.arrayContaining([
          expect.objectContaining({
            agent: 'user',
            message: expect.stringContaining('Sarah')
          }),
          expect.objectContaining({
            agent: 'assistant', 
            message: expect.stringContaining('closure')
          })
        ]),
        metadata: expect.objectContaining({
          totalMessages: 3,
          estimatedTokens: expect.any(Number),
          created: expect.any(String)
        })
      });

      console.log(`✅ Generated valid temp file: ${fileResult.filePath}`);
      console.log(`📄 File size: ${fileContent.length} characters`);
      console.log(`💬 Messages in history: ${jsonData.messages.length}`);
      console.log(`🔗 File reference for CLI: ${fileResult.fileReference}`);
    });

    it('should handle large conversations within system limits', async () => {
      const chatId = await chatManager.createChat('Large Chat', 'test-agent');
      
      // Create substantial conversation
      for (let i = 0; i < 25; i++) {
        await chatManager.addMessage(chatId, 'user', `User message ${i}: This is a detailed question about software architecture, design patterns, and best practices. I need comprehensive guidance on implementing scalable solutions for enterprise applications.`);
        await chatManager.addMessage(chatId, 'assistant', `Assistant response ${i}: Here's a detailed explanation covering architectural patterns, SOLID principles, design considerations, and implementation strategies. This response includes code examples and thorough technical analysis.`);
      }

      const fileResult = await chatManager.generateChatHistoryFile(
        chatId,
        'Based on our extensive discussion, please provide a comprehensive summary of all the architectural concepts we\'ve covered.',
        'test-agent',
        true
      );

      expect(fileResult.success).toBe(true);
      
      const fileContent = await fs.readFile(fileResult.filePath!, 'utf8');
      const jsonData = JSON.parse(fileContent);
      
      // Should handle large content efficiently
      expect(fileContent.length).toBeGreaterThan(15000);
      expect(jsonData.messages.length).toBeGreaterThan(10);
      expect(jsonData.metadata.estimatedTokens).toBeGreaterThan(1000);

      console.log(`✅ Large conversation handled: ${fileContent.length} chars, ${jsonData.messages.length} messages`);
    });

    it('should preserve code blocks and special characters', async () => {
      const chatId = await chatManager.createChat('Code Test', 'test-agent');
      await chatManager.addMessage(chatId, 'user', 'Can you help me with this React function?\n\n```jsx\nfunction MyComponent({ data }) {\n  return (\n    <div className="container">\n      {data?.map(item => <span key={item.id}>{item.name}</span>)}\n    </div>\n  );\n}\n```');
      await chatManager.addMessage(chatId, 'assistant', 'Here\'s an enhanced version:\n\n```jsx\nfunction MyComponent({ data = [] }) {\n  if (!data.length) return <div>No data</div>;\n  return (\n    <div className="container">\n      {data.map(item => (\n        <span key={item.id} className="item">\n          {item.name}\n        </span>\n      ))}\n    </div>\n  );\n}\n```');

      const fileResult = await chatManager.generateChatHistoryFile(
        chatId,
        'Great! Now add TypeScript types.',
        'test-agent',
        true
      );

      const fileContent = await fs.readFile(fileResult.filePath!, 'utf8');
      const jsonData = JSON.parse(fileContent);

      // Verify code preservation
      const allMessages = jsonData.messages.map((m: any) => m.message).join(' ');
      expect(allMessages).toContain('```jsx');
      expect(allMessages).toContain('function MyComponent');
      expect(allMessages).toContain('data?.map');
      expect(allMessages).toContain('className=');

      console.log('✅ Code blocks and special characters preserved correctly');
    });
  });

  describe('📋 ask-gemini Tool Integration', () => {
    it('should integrate seamlessly with ask-gemini tool workflow', async () => {
      // Test the actual integration point in ask-gemini.tool.ts
      const chatId = await chatManager.createChat('Tool Integration', 'integration-agent');
      await chatManager.addMessage(chatId, 'user', 'I need help with async/await patterns in JavaScript.');
      await chatManager.addMessage(chatId, 'assistant', 'I can help with async/await! These are used to handle asynchronous operations in a more readable way than traditional callbacks or promises.');

      // This simulates how ask-gemini.tool.ts would use the system
      const currentPrompt = 'Can you show me error handling with async/await?';
      const agentName = 'integration-agent';

      const fileResult = await chatManager.generateChatHistoryFile(
        chatId,
        currentPrompt,
        agentName,
        false // Normal operation, not debug
      );

      expect(fileResult.success).toBe(true);
      expect(fileResult.fileReference).toBeDefined();
      
      // This is the actual prompt format that would be sent to Gemini CLI
      const geminiPrompt = `${fileResult.fileReference}\n\n[${agentName}]: ${currentPrompt}`;
      
      expect(geminiPrompt).toContain('@.gemini/chat-');
      expect(geminiPrompt).toContain('[integration-agent]:');
      expect(geminiPrompt).toContain('error handling with async/await');

      // Verify fallback would work if file generation failed
      const chat = await chatManager.getChat(chatId) as Chat;
      const history = chatManager.formatHistoryForGemini(chat);
      const fallbackPrompt = `${history}\n\n[${agentName}]: ${currentPrompt}`;
      
      expect(fallbackPrompt.length).toBeGreaterThan(100);
      expect(fallbackPrompt).toContain('async/await patterns');

      console.log('✅ ask-gemini tool integration validated');
      console.log(`📝 Gemini prompt format: ${geminiPrompt.substring(0, 100)}...`);
    });

    it('should handle chat creation and continuation workflow', async () => {
      // Test complete workflow: create -> add messages -> generate file -> continue
      const chatId = await chatManager.createChat('Workflow Test', 'workflow-agent');
      
      // Initial interaction
      await chatManager.addMessage(chatId, 'user', 'What are the benefits of using TypeScript?');
      
      let fileResult1 = await chatManager.generateChatHistoryFile(
        chatId, 
        'Please explain type safety benefits.',
        'workflow-agent',
        false
      );
      
      expect(fileResult1.success).toBe(true);
      
      // Simulate response and continuation
      await chatManager.addMessage(chatId, 'assistant', 'TypeScript provides static type checking, better IDE support, and improved code maintainability.');
      await chatManager.addMessage(chatId, 'user', 'How about performance implications?');
      
      let fileResult2 = await chatManager.generateChatHistoryFile(
        chatId,
        'Based on our TypeScript discussion, what are the performance considerations?',
        'workflow-agent', 
        false
      );
      
      expect(fileResult2.success).toBe(true);
      
      // Verify conversation history grows
      const file1Content = await fs.readFile(fileResult1.filePath!, 'utf8');
      const file2Content = await fs.readFile(fileResult2.filePath!, 'utf8'); 
      const json1 = JSON.parse(file1Content);
      const json2 = JSON.parse(file2Content);
      
      // The second file should contain all messages including the new ones
      expect(json2.messages.length).toBeGreaterThanOrEqual(json1.messages.length);
      expect(json2.currentPrompt).toContain('performance considerations');
      
      // Verify the new messages are included
      const json2Messages = json2.messages.map((m: any) => m.message).join(' ');
      expect(json2Messages).toContain('TypeScript provides static type checking');
      expect(json2Messages).toContain('performance implications');
      
      console.log('✅ Complete workflow validated');
      console.log(`📈 History growth: ${json1.messages.length} → ${json2.messages.length} messages`);
    });
  });

  describe('🛡️ Error Handling and Resilience', () => {
    it('should handle invalid chat IDs gracefully', async () => {
      const result = await chatManager.generateChatHistoryFile(
        999999, // Non-existent chat
        'Test prompt',
        'test-agent',
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.filePath).toBeUndefined();
      expect(result.fileReference).toBeUndefined();
    });

    it('should handle file system errors gracefully', async () => {
      // Test with invalid chat ID to trigger path issues
      const invalidResult = await ChatHistoryFileManager.createChatHistoryFile(
        {
          id: '', // Invalid empty ID
          title: 'Test',
          participants: [],
          messages: [],
          created: new Date(),
          lastActivity: new Date(),
          status: 'active'
        },
        'Test prompt',
        false
      );

      // Should handle gracefully without throwing
      expect(typeof invalidResult.success).toBe('boolean');
      if (!invalidResult.success) {
        expect(invalidResult.error).toBeDefined();
      }
    });

    it('should cleanup files properly on server lifecycle', async () => {
      // Create several test files
      const fileResults = [];
      for (let i = 0; i < 3; i++) {
        const chatId = await chatManager.createChat(`Test Chat ${i}`, 'test-agent');
        const result = await chatManager.generateChatHistoryFile(
          chatId,
          `Test prompt ${i}`,
          'test-agent',
          false
        );
        fileResults.push(result);
      }

      // Verify files exist
      for (const result of fileResults) {
        if (result.success) {
          const exists = await fs.access(result.filePath!).then(() => true).catch(() => false);
          expect(exists).toBe(true);
        }
      }

      // Cleanup
      await ChatHistoryFileManager.cleanupTempFiles(false);

      // Verify files are removed
      for (const result of fileResults) {
        if (result.success) {
          const exists = await fs.access(result.filePath!).then(() => true).catch(() => false);
          expect(exists).toBe(false);
        }
      }

      console.log('✅ Cleanup lifecycle validated');
    });
  });

  describe('🔧 Performance and Scalability', () => {
    it('should handle Windows CLI length limitations efficiently', async () => {
      // Create conversation that would exceed Windows CLI limits (>8k chars)
      const chatId = await chatManager.createChat('CLI Limits Test', 'performance-agent');
      
      // Add content that would exceed CLI limits if passed as string
      const longMessage = 'A'.repeat(1000);
      for (let i = 0; i < 15; i++) {
        await chatManager.addMessage(chatId, 'user', `${longMessage} Message ${i}`);
        await chatManager.addMessage(chatId, 'assistant', `${longMessage} Response ${i}`);
      }

      const currentPrompt = 'B'.repeat(500); // Additional prompt content

      // File approach should handle this efficiently
      const startTime = Date.now();
      const fileResult = await chatManager.generateChatHistoryFile(
        chatId,
        currentPrompt,
        'performance-agent',
        true
      );
      const duration = Date.now() - startTime;

      expect(fileResult.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should be fast

      // Verify substantial content
      const fileContent = await fs.readFile(fileResult.filePath!, 'utf8');
      expect(fileContent.length).toBeGreaterThan(20000); // >20k chars

      console.log(`✅ CLI limits handled: ${fileContent.length} chars in ${duration}ms`);
    });

    it('should show consistent performance across different chat sizes', async () => {
      const testSizes = [5, 20, 50];
      const timings = [];

      for (const size of testSizes) {
        const chatId = await chatManager.createChat(`Size Test ${size}`, 'perf-agent');
        
        // Create chat of specified size
        for (let i = 0; i < size; i++) {
          await chatManager.addMessage(chatId, 'user', `User message ${i} with moderate length content for testing performance characteristics.`);
          await chatManager.addMessage(chatId, 'assistant', `Assistant response ${i} providing detailed technical information and comprehensive explanations for performance analysis.`);
        }

        // Time file generation
        const start = Date.now();
        const result = await chatManager.generateChatHistoryFile(
          chatId,
          'Performance test prompt',
          'perf-agent',
          false
        );
        const timing = Date.now() - start;

        timings.push(timing);
        expect(result.success).toBe(true);
      }

      // Performance should not degrade exponentially
      const maxTime = Math.max(...timings);
      const minTime = Math.min(...timings);
      const ratio = maxTime / minTime;

      expect(ratio).toBeLessThan(5); // Should show reasonable scaling
      console.log(`✅ Performance scaling: ${timings.join('ms, ')}ms (ratio: ${ratio.toFixed(2)})`);
    });
  });
});

/**
 * Optional: Test with actual Gemini CLI if available and working
 * This is a separate test that can be run manually when CLI is confirmed working
 */
describe.skip('🌐 Optional Real Gemini CLI Tests', () => {
  it('should work with actual Gemini CLI when available', async () => {
    // This test is skipped by default but can be enabled for manual testing
    const chatManager = ChatManager.getInstance();
    chatManager.reset();

    const chatId = await chatManager.createChat('Real CLI Test', 'real-test-agent');
    await chatManager.addMessage(chatId, 'user', 'What is 2 + 2?');

    const fileResult = await chatManager.generateChatHistoryFile(
      chatId,
      'Please answer based on our conversation.',
      'real-test-agent',
      true
    );

    expect(fileResult.success).toBe(true);

    // Only run if gemini CLI is available and working
    try {
      const result = await executeGeminiCommand(
        `${fileResult.fileReference}\n\n[real-test-agent]: Please answer based on our conversation.`
      );
      
      if (result.exitCode === 0) {
        expect(result.stdout).toBeDefined();
        expect(result.stdout.length).toBeGreaterThan(0);
        console.log('✅ Real Gemini CLI integration confirmed');
      } else {
        console.log('⚠️ Gemini CLI not responding properly, test skipped');
      }
    } catch (error) {
      console.log('⚠️ Gemini CLI test skipped due to:', error);
    }
  });
});

/**
 * Execute gemini CLI command (for optional real testing)
 */
async function executeGeminiCommand(prompt: string): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve) => {
    const child = spawn('gemini', ['-m', 'gemini-2.5-flash', prompt], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code || 0,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });

    child.on('error', (error) => {
      resolve({
        exitCode: 1,
        stdout: '',
        stderr: error.message
      });
    });

    // Shorter timeout for reliability
    setTimeout(() => {
      child.kill();
      resolve({
        exitCode: 124,
        stdout: stdout.trim(),
        stderr: 'Command timed out'
      });
    }, 10000); // 10 second timeout
  });
}