import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChatManager } from '../src/managers/chatManager.js';
import { TestFileManager } from '../src/utils/testFileManager.js';

describe('Bug Reproduction: Chat ID Type Inconsistency', () => {
  let chatManager: ChatManager;

  beforeEach(async () => {
    chatManager = ChatManager.getInstance();
    chatManager.reset();
    await TestFileManager.resetTestDirectory();
  });

  afterEach(async () => {
    await TestFileManager.cleanupTestFiles();
  });

  it('should expose Chat ID type inconsistency causing downstream failures', async () => {
    // BUG: ChatManager.createChat() returns Promise<number>
    const chatId = await chatManager.createChat('Test Chat', 'test-agent');
    
    // Verify the return type is number (this should pass)
    expect(typeof chatId).toBe('number');
    expect(chatId).toBeTypeOf('number');
    
    // BUG: But getChat() expects the Chat object to have id as string
    // This exposes the type inconsistency
    const chat = await chatManager.getChat(chatId);
    
    // CRITICAL BUG: This should fail because Chat.id is expected to be string
    // but the implementation does id: chatId.toString() which can fail
    expect(chat).toBeDefined();
    expect(chat!.id).toBeDefined();
    
    // The bug manifests when downstream operations expect string ID
    // but get undefined due to type conversion failures
    const chatIdAsString = chat!.id!.toString();
    
    // This should work but often fails due to type inconsistency
    expect(typeof chatIdAsString).toBe('string');
    
    // BUG REPRODUCTION: Attempt to generate chat history file using TestFileManager
    // This is where the cascade failure typically occurs
    try {
      const fileResult = await TestFileManager.createAndVerifyFile(
        chatManager,
        chatId,
        'Test prompt',
        'test-agent',
        false
      );
      
      // If we get here, the bug might be intermittent
      if (!fileResult.success) {
        throw new Error(`Chat history file generation failed: ${fileResult.error}`);
      }
    } catch (error) {
      // EXPECTED FAILURE: This is the cascade effect of the type inconsistency
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // The bug should manifest as undefined property access
      expect(errorMessage).toMatch(/(undefined|toString|Cannot read properties)/i);
      
      // This proves the bug exists - rethrow to fail the test
      throw new Error(`BUG CONFIRMED: Chat ID type inconsistency causes: ${errorMessage}`);
    }
  });

  it('should demonstrate the exact type mismatch pattern', () => {
    // REPRODUCE THE EXACT BUG PATTERN
    
    // Step 1: createChat returns number
    const mockCreateChatResult = 1; // This is what createChat returns
    expect(typeof mockCreateChatResult).toBe('number');
    
    // Step 2: Chat interface expects string ID
    interface ExpectedChatStructure {
      id: string;  // <- BUG: Interface expects string
      title: string;
      // ... other properties
    }
    
    // Step 3: Implementation tries to convert but can fail
    const mockChat = {
      id: mockCreateChatResult.toString(), // This works
      title: 'Test'
    };
    
    // Step 4: But when chat is undefined, toString() fails
    const undefinedChat: any = undefined;
    
    expect(() => {
      // This is the exact pattern causing failures
      const failingId = undefinedChat?.id?.toString();
      return failingId;
    }).not.toThrow(); // Won't throw due to optional chaining
    
    // But this pattern WILL throw:
    expect(() => {
      const failingId = undefinedChat.id.toString();
      return failingId;
    }).toThrow(/Cannot read properties of undefined/);
  });

  it('should show ChatManager interface inconsistency', async () => {
    // INTERFACE ANALYSIS
    
    // createChat signature returns Promise<number>
    const chatId = await chatManager.createChat('Interface Test', 'test-agent');
    expect(typeof chatId).toBe('number');
    
    // But getChat should return Chat with string id
    const chat = await chatManager.getChat(chatId);
    expect(chat).toBeDefined();
    
    // THE BUG: Chat.id should be string but implementation varies
    if (chat) {
      // This might be string or number depending on implementation
      const actualIdType = typeof chat.id;
      
      // Document the inconsistency
      console.log(`INCONSISTENCY DETECTED:`);
      console.log(`  createChat() returns: ${typeof chatId}`);
      console.log(`  Chat.id actual type: ${actualIdType}`);
      console.log(`  Chat.id value: ${chat.id}`);
      
      // The test should expose this mismatch
      if (actualIdType !== 'string') {
        throw new Error(`TYPE MISMATCH: Chat.id should be string but is ${actualIdType}`);
      }
    }
  });
});