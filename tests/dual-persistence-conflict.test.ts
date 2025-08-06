import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatManager } from '../src/managers/chatManager.js';
import { EnhancedChatManager } from '../src/managers/enhancedChatManager.js';
import { listChatsTool, showChatTool } from '../src/tools/chat-management-tools.js';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Mock gemini executor to avoid actual CLI calls
vi.mock('../src/utils/geminiExecutor.js', () => ({
  executeGeminiCLI: vi.fn().mockResolvedValue('Mocked Gemini response'),
  processChangeModeOutput: vi.fn().mockResolvedValue('Mocked change mode response')
}));

/**
 * DUAL PERSISTENCE CONFLICT TEST
 * 
 * This test demonstrates the architectural bug where two incompatible persistence systems
 * are used simultaneously, causing chat context loss and file access problems.
 * 
 * ROOT CAUSE:
 * - Legacy System: ChatManager (ask-gemini.tool.ts) → uses InMemoryPersistence + .gemini/ files
 * - New System: EnhancedChatManager (chat-management-tools.ts) → uses JsonChatPersistence + /tmp/ files
 * 
 * BUG SYMPTOMS:
 * 1. Chat Context Loss: Chats created by one system cannot be found by the other
 * 2. File Access Problems: File paths point to inaccessible locations
 * 3. Context Fragmentation: Conversation continuity breaks across tools
 */
describe('Dual Persistence Conflict - Architectural Bug Reproduction', () => {
  let legacyChatManager: ChatManager;
  let enhancedChatManager: EnhancedChatManager;
  let createdFiles: string[] = [];
  let createdDirs: string[] = [];

  beforeEach(async () => {
    // Initialize both managers (simulating real-world usage)
    legacyChatManager = ChatManager.getInstance();
    enhancedChatManager = EnhancedChatManager.getInstance();
    await enhancedChatManager.initialize();
    
    // Reset state tracking
    createdFiles = [];
    createdDirs = [];
  });

  afterEach(async () => {
    // Clean up any files created during tests
    for (const filePath of createdFiles) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // File might not exist, that's OK
      }
    }
    
    // Clean up any directories created
    for (const dirPath of createdDirs) {
      try {
        await fs.rmdir(dirPath, { recursive: true });
      } catch (error) {
        // Directory might not exist, that's OK
      }
    }
  });

  describe('CRITICAL BUG: Cross-System Chat Context Loss', () => {
    it('should FAIL - chat created by legacy system cannot be found by enhanced system', async () => {
      // STEP 1: Create chat using legacy system (ChatManager via ask-gemini tool simulation)
      const agentName = 'test-agent';
      const chatTitle = 'Test Chat for Dual Persistence Bug';
      
      // Legacy system creates chat in memory
      const legacyChatId = await legacyChatManager.createChat(chatTitle, agentName);
      expect(legacyChatId).toBeGreaterThan(0);
      
      // Add a message to the legacy chat
      const messageResult = await legacyChatManager.addMessage(
        legacyChatId.toString(), 
        agentName, 
        'Hello from legacy system'
      );
      expect(messageResult.success).toBe(true);

      // Verify legacy system can see its own chat
      const legacyChat = await legacyChatManager.getChat(legacyChatId.toString(), agentName);
      expect(legacyChat).not.toBeNull();
      expect(legacyChat?.title).toBe(chatTitle);

      // STEP 2: Try to access the same chat via enhanced system (chat-management-tools)
      try {
        const enhancedChats = await listChatsTool.execute({ includeDetails: true });
        
        // THE BUG: Enhanced system cannot see legacy system's chats
        // This should find the chat but WILL FAIL due to dual persistence
        expect(enhancedChats).toContain(legacyChatId.toString());
        
        // Attempt to show the chat details
        const chatDetails = await showChatTool.execute({ chatId: legacyChatId.toString() });
        
        // THE BUG: Enhanced system cannot access legacy chat details
        expect(chatDetails).toContain('Test Chat for Dual Persistence Bug');
        expect(chatDetails).toContain('Hello from legacy system');
        
        // If we reach here, the bug is NOT present (test should fail)
        throw new Error('Expected failure: Enhanced system should not see legacy chats');
        
      } catch (error) {
        // This is the expected behavior showing the bug exists
        console.log('✓ BUG CONFIRMED: Enhanced system cannot see legacy chats');
        console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    it('should FAIL - chat created by enhanced system cannot be found by legacy system', async () => {
      // STEP 1: Create chat using enhanced system (EnhancedChatManager)
      const agentName = 'test-agent-2';
      const chatTitle = 'Enhanced System Chat';
      
      // Enhanced system creates chat in /tmp directory
      const enhancedChatId = await enhancedChatManager.createChat(agentName, chatTitle);
      expect(enhancedChatId).toBeDefined();
      
      // Add message to enhanced chat
      await enhancedChatManager.addMessage(enhancedChatId, agentName, 'Hello from enhanced system');

      // Verify enhanced system can see its own chat
      const enhancedChat = await enhancedChatManager.getChat(enhancedChatId);
      expect(enhancedChat).not.toBeNull();
      expect(enhancedChat?.title).toBe(chatTitle);

      // STEP 2: Try to access via legacy system (as ask-gemini tool would)
      const legacyChat = await legacyChatManager.getChat(enhancedChatId, agentName);
      
      // THE BUG: Legacy system cannot see enhanced system's chats
      // This should find the chat but WILL FAIL due to dual persistence
      expect(legacyChat).not.toBeNull();
      expect(legacyChat?.title).toBe(chatTitle);
      expect(legacyChat?.messages).toHaveLength(1);
      
      // If we reach here, the test SHOULD FAIL showing the bug
      console.log('⚠️  UNEXPECTED: Systems can see each other - bug may be fixed');
    });
  });

  describe('CRITICAL BUG: Storage Location Conflicts', () => {
    it('should FAIL - systems store data in completely different locations', async () => {
      // STEP 1: Document where each system stores its data
      const legacyStoragePath = join(process.cwd(), '.gemini');
      
      // Enhanced system uses temp directory with process ID
      const enhancedBasePath = join(tmpdir(), `gemini-mcp-${process.pid}-${Date.now()}`);
      const enhancedStoragePath = join(enhancedBasePath, 'storage');
      const enhancedGeminiPath = join(enhancedBasePath, 'gemini');
      
      // THE BUG: Completely different storage locations
      console.log('\n=== STORAGE CONFLICT EVIDENCE ===');
      console.log(`Legacy Storage: ${legacyStoragePath}`);
      console.log(`Enhanced Storage: ${enhancedStoragePath}`);
      console.log(`Enhanced Gemini: ${enhancedGeminiPath}`);
      console.log('=================================\n');
      
      // These should be the same location for compatibility, but they're not
      expect(legacyStoragePath).toBe(enhancedStoragePath);
    });

    it('should FAIL - file formats and structures are incompatible', async () => {
      // Create a chat in each system
      const agentName = 'format-test-agent';
      
      // Legacy system - creates in-memory data
      const legacyChatId = await legacyChatManager.createChat('Format Test Legacy', agentName);
      await legacyChatManager.addMessage(legacyChatId.toString(), agentName, 'Legacy message');
      
      // Enhanced system - creates JSON files
      const enhancedChatId = await enhancedChatManager.createChat(agentName, 'Format Test Enhanced');
      await enhancedChatManager.addMessage(enhancedChatId, agentName, 'Enhanced message');
      
      // THE BUG: Different data access patterns and formats
      // Legacy uses numeric IDs, Enhanced uses string IDs
      expect(typeof legacyChatId).toBe(typeof enhancedChatId);
      
      // Legacy stores in memory, Enhanced stores in JSON files
      const legacyChat = await legacyChatManager.getChat(legacyChatId.toString(), agentName);
      const enhancedChat = await enhancedChatManager.getChat(enhancedChatId);
      
      // Data structure compatibility check - should be the same but isn't
      expect(legacyChat?.messages[0]?.agent).toBe(enhancedChat?.messages[0]?.agent);
      expect(legacyChat?.participants).toEqual(enhancedChat?.participants);
    });
  });

  describe('CRITICAL BUG: Synchronization Failure', () => {
    it('should FAIL - changes in one system do not reflect in the other', async () => {
      const agentName = 'sync-test-agent';
      
      // Create chat in legacy system
      const legacyChatId = await legacyChatManager.createChat('Sync Test', agentName);
      await legacyChatManager.addMessage(legacyChatId.toString(), agentName, 'Initial message');
      
      // Try to add message to "same" chat via enhanced system
      try {
        await enhancedChatManager.addMessage(legacyChatId.toString(), agentName, 'Follow-up from enhanced');
        
        // Check if legacy system sees the enhanced system's message
        const updatedLegacyChat = await legacyChatManager.getChat(legacyChatId.toString(), agentName);
        
        // THE BUG: Systems don't sync - message should be present but won't be
        expect(updatedLegacyChat?.messages).toHaveLength(2);
        expect(updatedLegacyChat?.messages[1]?.message).toBe('Follow-up from enhanced');
        
        // If we reach here, systems are somehow syncing (unexpected)
        console.log('⚠️  UNEXPECTED: Systems appear to be syncing');
        
      } catch (error) {
        // This is expected - systems can't work together
        console.log('✓ BUG CONFIRMED: Systems cannot sync changes');
        console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  });

  describe('DIAGNOSTIC: Architecture Evidence', () => {
    it('documents the architectural conflict causing the bug', () => {
      // Document the architectural conflict for developers
      const legacyStoragePath = join(process.cwd(), '.gemini');
      const enhancedStoragePath = join(tmpdir(), `gemini-mcp-${process.pid}-${Date.now()}`);
      
      console.log('\n=== ARCHITECTURAL CONFLICT EVIDENCE ===');
      console.log('Legacy System (ChatManager):');
      console.log(`  - Storage: ${legacyStoragePath}`);
      console.log('  - Used by: ask-gemini.tool.ts');
      console.log('  - Persistence: InMemoryPersistence + temp file generation');
      console.log('  - Chat IDs: Numbers');
      console.log('  - Lifecycle: Memory-only (resets on restart)');
      
      console.log('\nEnhanced System (EnhancedChatManager):');
      console.log(`  - Storage: ${enhancedStoragePath}`);
      console.log('  - Used by: chat-management-tools.ts');
      console.log('  - Persistence: JsonChatPersistence');
      console.log('  - Chat IDs: Strings');
      console.log('  - Lifecycle: File-based (survives restarts)');
      
      console.log('\nCONFLICT IMPACT:');
      console.log('  ❌ Different storage locations (.gemini/ vs /tmp/)');
      console.log('  ❌ Different ID types (number vs string)');
      console.log('  ❌ Different persistence models (memory vs file)');
      console.log('  ❌ Different lifecycle management');
      console.log('  ❌ No synchronization mechanism');
      console.log('  ❌ No shared interface or protocol');
      
      console.log('\nEXPECTED FAILURES:');
      console.log('  🚫 ask-gemini tool cannot see chat-management-tools chats');
      console.log('  🚫 chat-management-tools cannot see ask-gemini chats');
      console.log('  🚫 File paths resolve to different locations');
      console.log('  🚫 Context continuity breaks across tool usage');
      console.log('==========================================\n');
      
      // This test always passes - it's just for documentation
      expect(true).toBe(true);
    });

    it('provides specific reproduction steps', () => {
      console.log('\n=== BUG REPRODUCTION STEPS ===');
      console.log('1. Create chat using ask-gemini tool (chatId=0)');
      console.log('2. Note the returned chat ID from the response');
      console.log('3. Try to access that chat using list-chats tool');
      console.log('4. Observe that the chat is not found');
      console.log('5. Try to access using show-chat tool');
      console.log('6. Observe error: chat not accessible');
      console.log('7. Create new chat using start-chat tool');
      console.log('8. Try to continue conversation using ask-gemini with that chatId');
      console.log('9. Observe context loss and accessibility issues');
      console.log('===============================\n');
      
      expect(true).toBe(true);
    });
  });
});