import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnhancedChatManager } from '../src/managers/enhancedChatManager';
import { Logger } from '../src/utils/logger';

describe('Unified System Unit Tests', () => {
  const testChatId = '998';
  const testAgentName = 'unit-test-agent';

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

  it('should use unified EnhancedChatManager for all operations', async () => {
    const manager = EnhancedChatManager.getInstance();
    
    // Create chat
    const chatTitle = 'Unified System Test Chat';
    const newChatId = await manager.createChat(chatTitle, testAgentName);
    
    expect(newChatId).toBeGreaterThan(0);
    Logger.info(`Created chat with ID: ${newChatId}`);
    
    // Add message
    await manager.addMessage(newChatId.toString(), testAgentName, 'Test message 1');
    await manager.addMessage(newChatId.toString(), 'Gemini', 'Mock response 1');
    
    // Verify chat exists and has correct data
    const chat = await manager.getChat(newChatId.toString());
    expect(chat).toBeDefined();
    expect(chat?.title).toBe(chatTitle);
    expect(chat?.messages).toHaveLength(2);
    expect(chat?.participants).toContain(testAgentName);
    expect(chat?.participants).toContain('Gemini');
    
    // Verify it appears in list
    const allChats = await manager.listChats();
    const foundChat = allChats.find(c => c.chatId === newChatId.toString());
    expect(foundChat).toBeDefined();
    expect(foundChat?.title).toBe(chatTitle);
    
    Logger.info('✅ SUCCESS: Unified system working correctly');
  });

  it('should handle both string and numeric chat IDs consistently', async () => {
    const manager = EnhancedChatManager.getInstance();
    
    // Create chat and get numeric ID
    const numericChatId = await manager.createChat('ID Test Chat', testAgentName);
    const stringChatId = numericChatId.toString();
    
    // Add message using numeric ID
    await manager.addMessage(numericChatId, testAgentName, 'Message via numeric ID');
    
    // Retrieve using string ID  
    const chatViaString = await manager.getChat(stringChatId);
    expect(chatViaString).toBeDefined();
    expect(chatViaString?.messages).toHaveLength(1);
    expect(chatViaString?.messages[0].message).toBe('Message via numeric ID');
    
    // Add message using string ID
    await manager.addMessage(stringChatId, 'Gemini', 'Message via string ID');
    
    // Retrieve using numeric conversion
    const chatViaBoth = await manager.getChat(numericChatId.toString());
    expect(chatViaBoth).toBeDefined();
    expect(chatViaBoth?.messages).toHaveLength(2);
    
    Logger.info('✅ SUCCESS: ID consistency working correctly');
  });

  it('should generate unified file references', async () => {
    const manager = EnhancedChatManager.getInstance();
    
    // Create chat with conversation history
    const chatId = await manager.createChat('File Generation Test', testAgentName);
    await manager.addMessage(chatId.toString(), testAgentName, 'First message');
    await manager.addMessage(chatId.toString(), 'Gemini', 'First response');
    await manager.addMessage(chatId.toString(), testAgentName, 'Second message');
    
    // Generate file
    const fileResult = await manager.generateChatHistoryFile(
      chatId.toString(),
      'Current prompt',
      testAgentName
    );
    
    expect(fileResult.success).toBe(true);
    if (fileResult.success) {
      expect(fileResult.fileReference).toContain('@');
      expect(fileResult.fileReference).toContain('gemini-mcp');
      expect(fileResult.fileReference).toContain(`chat-${chatId}.json`);
      expect(fileResult.filePath).toContain('gemini-mcp');
      
      // Verify this is in the unified temp location (not .gemini/ directory)
      expect(fileResult.filePath).not.toContain('.gemini');
      expect(fileResult.filePath).toContain('Temp');
      
      Logger.info(`✅ SUCCESS: Unified file generation - ${fileResult.fileReference}`);
    }
  });

  it('should maintain persistent storage across manager instances', async () => {
    // Create data with first manager instance
    const manager1 = EnhancedChatManager.getInstance();
    const chatId = await manager1.createChat('Persistence Test', testAgentName);
    await manager1.addMessage(chatId.toString(), testAgentName, 'Persistent message');
    
    // Access with "new" manager instance (should be same singleton)
    const manager2 = EnhancedChatManager.getInstance();
    const retrievedChat = await manager2.getChat(chatId.toString());
    
    expect(retrievedChat).toBeDefined();
    expect(retrievedChat?.title).toBe('Persistence Test');
    expect(retrievedChat?.messages).toHaveLength(1);
    expect(retrievedChat?.messages[0].message).toBe('Persistent message');
    
    // Verify they are the same instance
    expect(manager1).toBe(manager2);
    
    Logger.info('✅ SUCCESS: Persistent storage working correctly');
  });
});