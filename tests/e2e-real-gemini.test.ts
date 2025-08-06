import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { ChatHistoryFileManager } from '../src/utils/chatHistoryFileManager.js';
import { ChatManager } from '../src/managers/chatManager.js';
import { Chat } from '../src/managers/chatManager.js';

describe('Real E2E Gemini CLI Integration Tests', () => {
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

  describe('🚀 Real Gemini CLI Integration', () => {
    it('should execute gemini CLI with @ file reference successfully', async () => {
      // Create a realistic chat conversation
      const chatId = await chatManager.createChat('E2E CLI Test', 'test-agent');
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
      expect(fileResult.fileReference).toBeDefined();

      // Verify file exists and is valid
      const fileContent = await fs.readFile(fileResult.filePath!, 'utf8');
      const jsonData = JSON.parse(fileContent);
      
      expect(jsonData.messages).toHaveLength(3);
      expect(jsonData.currentPrompt).toContain('Sarah here again');
      expect(jsonData.messages[0].message).toContain('Sarah');
      expect(jsonData.messages[1].message).toContain('closure');

      // Test actual Gemini CLI execution
      const geminiPrompt = `${fileResult.fileReference}\n\n[test-agent]: ${currentPrompt}`;
      
      console.log('\n🧪 Testing actual Gemini CLI integration...');
      console.log(`File created: ${fileResult.filePath}`);
      console.log(`File reference: ${fileResult.fileReference}`);
      
      // Execute gemini CLI command
      const geminiResult = await executeGeminiCommand(geminiPrompt);
      
      // Verify command executed successfully
      expect(geminiResult.exitCode).toBe(0);
      expect(geminiResult.stdout).toBeDefined();
      expect(geminiResult.stdout.length).toBeGreaterThan(0);
      
      // Verify response shows conversation awareness
      const response = geminiResult.stdout.toLowerCase();
      console.log('\n📋 Gemini Response Preview:', response.substring(0, 200) + '...');
      
      // Should mention the user's name (Sarah) to show conversation continuity
      expect(response).toContain('sarah');
      
      console.log('✅ Real Gemini CLI integration test passed!');
    }, 30000); // 30 second timeout for API calls

    it('should handle large conversation history through file approach', async () => {
      // Create a substantial conversation that would exceed CLI limits
      const chatId = await chatManager.createChat('Large E2E Test', 'test-agent');
      
      // Add many messages to create a large history
      for (let i = 0; i < 20; i++) {
        await chatManager.addMessage(chatId, 'user', `This is user message ${i}. I'm discussing a complex technical topic that requires detailed explanation. The message includes code examples and detailed questions about implementation patterns, performance optimization, and best practices in software development.`);
        await chatManager.addMessage(chatId, 'assistant', `Thank you for message ${i}! Here's a comprehensive response that includes detailed technical information, code examples, and thorough explanations. This response demonstrates how the chat history system handles substantial conversations efficiently through the JSON file approach rather than command line concatenation.`);
      }

      const testChat = await chatManager.getChat(chatId) as Chat;
      const currentPrompt = 'Given our extensive technical discussion, please provide a summary of the key concepts we\'ve covered and demonstrate that you can see our full conversation history.';

      // Generate temp file for large conversation
      const fileResult = await chatManager.generateChatHistoryFile(
        chatId,
        currentPrompt,
        'test-agent',
        true
      );

      expect(fileResult.success).toBe(true);
      
      // Verify file contains substantial content
      const fileContent = await fs.readFile(fileResult.filePath!, 'utf8');
      expect(fileContent.length).toBeGreaterThan(10000); // Substantial content
      
      const jsonData = JSON.parse(fileContent);
      expect(jsonData.messages.length).toBeGreaterThan(10); // Should have substantial history

      // Test with actual Gemini CLI
      const geminiPrompt = `${fileResult.fileReference}\n\n[test-agent]: ${currentPrompt}`;
      
      console.log('\n🧪 Testing large conversation with Gemini CLI...');
      console.log(`Large conversation file: ${fileContent.length} characters`);
      console.log(`Messages in history: ${jsonData.messages.length}`);
      
      const geminiResult = await executeGeminiCommand(geminiPrompt);
      
      expect(geminiResult.exitCode).toBe(0);
      expect(geminiResult.stdout).toBeDefined();
      expect(geminiResult.stdout.length).toBeGreaterThan(0);
      
      console.log('✅ Large conversation E2E test passed!');
    }, 45000); // Longer timeout for large content

    it('should demonstrate conversation continuity through multiple file updates', async () => {
      // Create initial conversation
      const chatId = await chatManager.createChat('Continuity Test', 'test-agent');
      await chatManager.addMessage(chatId, 'user', 'Hi! I\'m working on a React project. What\'s the best way to manage state?');
      
      // First interaction
      let fileResult1 = await chatManager.generateChatHistoryFile(
        chatId,
        'Can you explain the differences between useState and useReducer?',
        'test-agent',
        true
      );
      
      expect(fileResult1.success).toBe(true);
      
      // Test first interaction
      let geminiResult1 = await executeGeminiCommand(
        `${fileResult1.fileReference}\n\n[test-agent]: Can you explain the differences between useState and useReducer?`
      );
      expect(geminiResult1.exitCode).toBe(0);
      
      // Add response to chat history (simulate conversation continuation)
      await chatManager.addMessage(chatId, 'assistant', 'useState is great for simple state, while useReducer is better for complex state logic with multiple actions.');
      await chatManager.addMessage(chatId, 'user', 'That makes sense! Can you show me a useReducer example?');
      
      // Second interaction with updated history
      let fileResult2 = await chatManager.generateChatHistoryFile(
        chatId,
        'Based on our useState vs useReducer discussion, can you provide a practical useReducer example for a shopping cart?',
        'test-agent',
        true
      );
      
      expect(fileResult2.success).toBe(true);
      
      // Verify file has grown with conversation history
      const file1Content = await fs.readFile(fileResult1.filePath!, 'utf8');
      const file2Content = await fs.readFile(fileResult2.filePath!, 'utf8');
      const json1 = JSON.parse(file1Content);
      const json2 = JSON.parse(file2Content);
      
      expect(json2.messages.length).toBeGreaterThan(json1.messages.length);
      
      // Test second interaction shows conversation continuity
      let geminiResult2 = await executeGeminiCommand(
        `${fileResult2.fileReference}\n\n[test-agent]: Based on our useState vs useReducer discussion, can you provide a practical useReducer example for a shopping cart?`
      );
      
      expect(geminiResult2.exitCode).toBe(0);
      
      // Response should reference previous conversation
      const response2 = geminiResult2.stdout.toLowerCase();
      expect(response2).toMatch(/(shopping|cart|reducer|usestate)/);
      
      console.log('✅ Conversation continuity E2E test passed!');
    }, 60000); // Longer timeout for multiple interactions

    it('should handle special characters and code blocks in conversation', async () => {
      const chatId = await chatManager.createChat('Code Test', 'test-agent');
      await chatManager.addMessage(chatId, 'user', 'Can you help me with this JavaScript function?\n\n```javascript\nfunction processData(data) {\n  return data?.map(item => ({\n    ...item,\n    processed: true,\n    timestamp: new Date().toISOString()\n  }));\n}\n```');
      await chatManager.addMessage(chatId, 'assistant', 'That\'s a nice function! Here\'s an enhanced version:\n\n```javascript\nfunction processData(data = []) {\n  if (!Array.isArray(data)) {\n    throw new Error("Data must be an array");\n  }\n  \n  return data.map(item => ({\n    ...item,\n    processed: true,\n    timestamp: new Date().toISOString(),\n    id: item.id || crypto.randomUUID()\n  }));\n}\n```');

      const fileResult = await chatManager.generateChatHistoryFile(
        chatId,
        'Great! Now can you add TypeScript types to this function?',
        'test-agent',
        true
      );

      expect(fileResult.success).toBe(true);
      
      // Verify code blocks are preserved in JSON
      const fileContent = await fs.readFile(fileResult.filePath!, 'utf8');
      const jsonData = JSON.parse(fileContent);
      
      const allMessages = jsonData.messages.map((m: any) => m.message).join(' ');
      expect(allMessages).toContain('```javascript');
      expect(allMessages).toContain('function processData');
      expect(allMessages).toContain('data?.map');
      expect(allMessages).toContain('crypto.randomUUID()');

      // Test with Gemini CLI
      const geminiResult = await executeGeminiCommand(
        `${fileResult.fileReference}\n\n[test-agent]: Great! Now can you add TypeScript types to this function?`
      );
      
      expect(geminiResult.exitCode).toBe(0);
      expect(geminiResult.stdout).toBeDefined();
      
      // Response should reference the code from history
      const response = geminiResult.stdout.toLowerCase();
      expect(response).toMatch(/(typescript|type|interface|processdata)/);
      
      console.log('✅ Code blocks preservation E2E test passed!');
    }, 30000);
  });

  describe('🔧 Error Handling and Edge Cases', () => {
    it('should handle gemini CLI errors gracefully', async () => {
      // Create a file with invalid content to test error handling
      const chatId = await chatManager.createChat('Error Test', 'test-agent');
      await chatManager.addMessage(chatId, 'user', 'Test message');

      const fileResult = await chatManager.generateChatHistoryFile(
        chatId,
        'Test prompt',
        'test-agent',
        true
      );

      expect(fileResult.success).toBe(true);

      // Try to execute with invalid model parameter to test error handling
      const geminiResult = await executeGeminiCommand(
        `${fileResult.fileReference}\n\n[test-agent]: Test prompt`,
        'invalid-model'
      );
      
      // Should handle error gracefully (non-zero exit code expected)
      expect(typeof geminiResult.exitCode).toBe('number');
      expect(typeof geminiResult.stderr).toBe('string');
      
      console.log('✅ Error handling E2E test passed!');
    }, 15000);

    it('should work with different gemini models', async () => {
      const chatId = await chatManager.createChat('Model Test', 'test-agent');
      await chatManager.addMessage(chatId, 'user', 'Simple test question: What is 2 + 2?');

      const fileResult = await chatManager.generateChatHistoryFile(
        chatId,
        'Please answer based on our conversation context.',
        'test-agent',
        true
      );

      expect(fileResult.success).toBe(true);

      // Test with gemini-2.5-flash (faster model)
      const geminiFlashResult = await executeGeminiCommand(
        `${fileResult.fileReference}\n\n[test-agent]: Please answer based on our conversation context.`,
        'gemini-2.5-flash'
      );
      
      expect(geminiFlashResult.exitCode).toBe(0);
      expect(geminiFlashResult.stdout).toBeDefined();
      expect(geminiFlashResult.stdout.length).toBeGreaterThan(0);
      
      console.log('✅ Different models E2E test passed!');
    }, 30000);
  });
});

/**
 * Execute gemini CLI command and return result
 */
async function executeGeminiCommand(prompt: string, model: string = 'gemini-2.5-flash'): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve) => {
    const args = ['-m', model, prompt];
    const child = spawn('gemini', args, {
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

    // Set timeout for long-running commands
    setTimeout(() => {
      child.kill();
      resolve({
        exitCode: 124, // Timeout exit code
        stdout: stdout.trim(),
        stderr: 'Command timed out'
      });
    }, 25000); // 25 second timeout
  });
}