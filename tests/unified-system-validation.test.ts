import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnhancedChatManager } from '../src/managers/enhancedChatManager';
import { askGeminiTool } from '../src/tools/ask-gemini.tool';
import { Logger } from '../src/utils/logger';

describe('Unified Chat System Validation', () => {
  const testChatId = '999';
  const testAgentName = 'test-agent';

  beforeEach(async () => {
    // Clear any existing test data
    try {
      const manager = EnhancedChatManager.getInstance();
      await manager.deleteChat(testChatId);
      Logger.debug('Test setup: Cleared existing test data');
    } catch (error) {
      Logger.debug('Test setup: No existing data to clear', error);
    }
  });

  afterEach(async () => {
    // Cleanup after each test
    try {
      const manager = EnhancedChatManager.getInstance();
      await manager.deleteChat(testChatId);
    } catch (error) {
      Logger.debug('Test cleanup: Error during cleanup', error);
    }
  });

  it('should successfully create and use chat through ask-gemini tool', async () => {
    // Simulate ask-gemini tool usage - create new chat
    const result1 = await askGeminiTool.execute({
      prompt: 'Hello, this is a test message',
      agentName: testAgentName,
      chatId: '0' // Create new chat
    });

    expect(result1).toContain('New chat created');
    expect(result1).toContain('Hello, this is a test message');
    expect(result1).toContain('Chat ID');
    
    // Extract chat ID from the response
    const chatIdMatch = result1.match(/Chat ID (\d+)/);
    expect(chatIdMatch).toBeTruthy();
    const createdChatId = chatIdMatch![1];
    
    Logger.info(`Ask-gemini tool created chat ID: ${createdChatId}`);

    // Verify chat exists in EnhancedChatManager
    const manager = EnhancedChatManager.getInstance();
    const chat = await manager.getChat(createdChatId);
    
    expect(chat).toBeDefined();
    expect(chat?.messages).toHaveLength(2); // Agent message + Gemini response
    expect(chat?.participants).toContain(testAgentName);
    expect(chat?.participants).toContain('Gemini');
    
    Logger.info(`EnhancedChatManager confirmed chat exists with ${chat?.messages.length} messages`);
  });

  it('should maintain context across multiple ask-gemini calls', async () => {
    // Create initial chat
    const result1 = await askGeminiTool.execute({
      prompt: 'My name is Alice',
      agentName: testAgentName,
      chatId: '0'
    });

    // Extract chat ID
    const chatIdMatch = result1.match(/Chat ID (\d+)/);
    const chatId = chatIdMatch![1];

    // Continue conversation with same chat ID
    const result2 = await askGeminiTool.execute({
      prompt: 'What is my name?',
      agentName: testAgentName,
      chatId: chatId
    });

    expect(result2).toContain('Using existing chat');
    expect(result2).toContain(`Chat ID ${chatId}`);
    
    // Verify context continuity - chat should have multiple messages
    const manager = EnhancedChatManager.getInstance();
    const chat = await manager.getChat(chatId);
    
    expect(chat).toBeDefined();
    expect(chat?.messages.length).toBeGreaterThan(2);
    
    // Should have: Alice message, Gemini response, "What is my name?" message, Gemini response
    expect(chat?.messages.length).toBe(4);
    
    Logger.info(`Context maintained across calls - chat has ${chat?.messages.length} messages`);
  });

  it('should be accessible by both ask-gemini and chat-management tools', async () => {
    // Create chat using ask-gemini
    const result = await askGeminiTool.execute({
      prompt: 'Integration test message',
      agentName: testAgentName,
      chatId: '0'
    });

    const chatIdMatch = result.match(/Chat ID (\d+)/);
    const chatId = chatIdMatch![1];

    // Verify chat can be accessed directly via EnhancedChatManager
    const manager = EnhancedChatManager.getInstance();
    const chat = await manager.getChat(chatId);
    
    expect(chat).toBeDefined();
    expect(chat?.title).toContain('Integration test message');
    
    // Verify chat appears in list
    const allChats = await manager.listChats();
    const foundChat = allChats.find(c => c.chatId === chatId);
    
    expect(foundChat).toBeDefined();
    expect(foundChat?.title).toContain('Integration test message');
    
    Logger.info(`SUCCESS: Chat ${chatId} is accessible by both systems`);
  });

  it('should handle string and numeric chat IDs consistently', async () => {
    // Create chat with numeric chatId 0
    const result1 = await askGeminiTool.execute({
      prompt: 'Numeric ID test',
      agentName: testAgentName,
      chatId: 0 // Numeric zero
    });

    const chatIdMatch1 = result1.match(/Chat ID (\d+)/);
    const chatId1 = chatIdMatch1![1];

    // Create another chat with string chatId "0"
    const result2 = await askGeminiTool.execute({
      prompt: 'String ID test',
      agentName: testAgentName,
      chatId: '0' // String zero
    });

    const chatIdMatch2 = result2.match(/Chat ID (\d+)/);
    const chatId2 = chatIdMatch2![1];

    // Both should create new chats (different IDs)
    expect(chatId1).not.toBe(chatId2);
    
    // Continue with first chat using string ID
    const result3 = await askGeminiTool.execute({
      prompt: 'Continuation message',
      agentName: testAgentName,
      chatId: chatId1 // String version of first chat ID
    });

    expect(result3).toContain('Using existing chat');
    expect(result3).toContain(`Chat ID ${chatId1}`);

    Logger.info(`ID compatibility confirmed - numeric and string IDs work consistently`);
  });
});