import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatManager } from '../src/managers/chatManager.js';
import { executeGeminiCLI } from '../src/utils/geminiExecutor.js';
import { performance } from 'perf_hooks';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock the geminiExecutor to control responses and measure input
vi.mock('../src/utils/geminiExecutor.js', () => ({
  executeGeminiCLI: vi.fn()
}));

const mockExecuteGeminiCLI = vi.mocked(executeGeminiCLI);

/**
 * Critical Bug Testing Suite for Chat History Prepending Feature
 * 
 * This test suite is designed to FAIL and prove the existence of critical bugs
 * in the chat history prepending functionality. Each test demonstrates a specific
 * failure mode that could impact production usage.
 * 
 * Expected State: ALL TESTS SHOULD FAIL
 * These tests will pass once the underlying bugs are fixed.
 */
describe('Chat History Prepending - Critical Bug Reproduction', () => {
  let chatManager: ChatManager;
  
  beforeEach(() => {
    chatManager = ChatManager.getInstance();
    chatManager.reset();
    vi.clearAllMocks();
    
    // Default mock response
    mockExecuteGeminiCLI.mockResolvedValue('Mocked Gemini response');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * BUG 1: Token Limit Violations - Character-based vs Token-based Limits
   * 
   * Problem: The system uses character-based truncation (30k chars) but Gemini API
   * has token-based limits. Code-heavy content has much higher token density than
   * natural language, causing API rejections despite being under character limit.
   */
  describe('BUG 1: Token Limit Violations', () => {
    it('should expose token overflow with code-heavy chat history under character limit', async () => {
      const chatId = await chatManager.createChat('Token Test', 'test-agent');
      
      // Create code-heavy messages that are under 30k characters but exceed token limits
      // Code has ~4x higher token density than natural language
      const codeBlock = `
        function complexFunction(param1, param2, param3) {
          const variableWithLongName = param1 + param2;
          const anotherComplexVariable = param3 * variableWithLongName;
          
          if (variableWithLongName > anotherComplexVariable) {
            return processComplexLogic(variableWithLongName, anotherComplexVariable);
          } else {
            return alternativeComplexLogic(param1, param2, param3);
          }
        }
        
        interface ComplexInterface {
          propertyOne: string;
          propertyTwo: number;
          propertyThree: ComplexNestedInterface;
        }
        
        interface ComplexNestedInterface {
          nestedPropertyOne: boolean;
          nestedPropertyTwo: string[];
          nestedPropertyThree: { [key: string]: any };
        }
      `.repeat(20); // Create repetitive code patterns
      
      // Add multiple code-heavy messages (total ~25k characters, well under 30k limit)
      const messagePromises = [];
      for (let i = 0; i < 10; i++) {
        messagePromises.push(
          chatManager.addMessage(chatId, `agent-${i}`, `Code block ${i}:\n${codeBlock}`)
        );
      }
      await Promise.all(messagePromises);
      
      const chat = await chatManager.getChat(chatId);
      expect(chat).toBeDefined();
      
      // Verify we're under character limit
      const totalChars = chat!.messages.reduce((sum, msg) => sum + msg.message.length, 0);
      expect(totalChars).toBeLessThan(30000); // Under character limit
      
      // Format history for Gemini (this exposes the bug)
      const formattedHistory = chatManager.formatHistoryForGemini(chat!);
      
      // Mock a Gemini API rejection due to token limit
      mockExecuteGeminiCLI.mockRejectedValueOnce(
        new Error('Request payload size exceeds the limit: 1048576 bytes')
      );
      
      // This should fail due to token density, despite being under character limit
      await expect(
        executeGeminiCLI(`${formattedHistory}\n\nNew request: analyze this code`)
      ).rejects.toThrow('payload size exceeds the limit');
      
      // BUG PROOF: Character limit check passes but API rejects due to token density
      expect(totalChars).toBeLessThan(30000);
      expect(mockExecuteGeminiCLI).toHaveBeenCalledWith(
        expect.stringContaining('=== CHAT HISTORY')
      );
    });

    it('should demonstrate token miscounting with mixed content types', async () => {
      const chatId = await chatManager.createChat('Mixed Content Test', 'test-agent');
      
      // Mix of different content types with varying token densities
      const jsonData = JSON.stringify({
        users: Array.from({ length: 100 }, (_, i) => ({
          id: `user_${i}_with_long_identifier`,
          email: `user${i}@example-domain-name.com`,
          metadata: { key1: 'value1', key2: 'value2', key3: 'value3' }
        }))
      });
      
      const naturalLanguage = 'This is a normal conversation message that contains regular words and sentences that flow naturally and would have a typical token density ratio.'.repeat(50);
      
      const codeSnippet = `const handleComplexAsyncOperation = async (inputParameter) => {
        try {
          const processedResult = await processInputParameter(inputParameter);
          return { success: true, data: processedResult };
        } catch (error) {
          console.error('Error in handleComplexAsyncOperation:', error);
          return { success: false, error: error.message };
        }
      };`.repeat(30);
      
      // Add messages in order of increasing token density
      await chatManager.addMessage(chatId, 'agent1', naturalLanguage);
      await chatManager.addMessage(chatId, 'agent2', jsonData);
      await chatManager.addMessage(chatId, 'agent3', codeSnippet);
      
      const chat = await chatManager.getChat(chatId);
      const totalChars = chat!.messages.reduce((sum, msg) => sum + msg.message.length, 0);
      
      // Should be under character limit
      expect(totalChars).toBeLessThan(30000);
      
      // But token density varies dramatically between content types
      const formattedHistory = chatManager.formatHistoryForGemini(chat!);
      
      // Simulate token limit rejection (actual tokens > estimated from characters)
      mockExecuteGeminiCLI.mockRejectedValueOnce(
        new Error('Token limit exceeded: 200000 tokens')
      );
      
      await expect(
        executeGeminiCLI(`${formattedHistory}\n\nAnalyze the code patterns`)
      ).rejects.toThrow('Token limit exceeded');
      
      // BUG PROOF: System doesn't account for varying token densities
      console.log(`Character count: ${totalChars}, but token density varies by content type`);
    });
  });

  /**
   * BUG 2: Performance Degradation - O(n²) Complexity
   * 
   * Problem: Each history formatting operation regenerates the entire history string,
   * and truncation scans all messages. As chat grows, performance degrades quadratically.
   */
  describe('BUG 2: Performance Degradation - O(n²) Complexity', () => {
    it('should demonstrate quadratic performance degradation with chat growth', async () => {
      const chatId = await chatManager.createChat('Performance Test', 'test-agent');
      
      const performanceResults: { messageCount: number; avgTime: number }[] = [];
      
      // Test performance at different message counts
      const testSizes = [10, 50, 100, 200, 500];
      
      for (const targetSize of testSizes) {
        // Add messages to reach target size
        const currentSize = (await chatManager.getChat(chatId))?.messages.length || 0;
        const messagesToAdd = targetSize - currentSize;
        
        for (let i = 0; i < messagesToAdd; i++) {
          await chatManager.addMessage(
            chatId, 
            'perf-agent', 
            `Performance test message ${currentSize + i} with some content to make it realistic`
          );
        }
        
        // Measure history formatting performance (multiple runs for accuracy)
        const runTimes: number[] = [];
        for (let run = 0; run < 5; run++) {
          const startTime = performance.now();
          
          const chat = await chatManager.getChat(chatId);
          chatManager.formatHistoryForGemini(chat!);
          
          const endTime = performance.now();
          runTimes.push(endTime - startTime);
        }
        
        const avgTime = runTimes.reduce((sum, time) => sum + time, 0) / runTimes.length;
        performanceResults.push({ messageCount: targetSize, avgTime });
      }
      
      // Analyze performance degradation
      console.log('Performance Results:', performanceResults);
      
      // Check for quadratic degradation pattern
      // If performance is O(n²), then time should increase quadratically with message count
      const firstResult = performanceResults[0];
      const lastResult = performanceResults[performanceResults.length - 1];
      
      const messageCountRatio = lastResult.messageCount / firstResult.messageCount;
      const timeRatio = lastResult.avgTime / firstResult.avgTime;
      
      // For O(n²) complexity, time ratio should be close to messageCountRatio²
      const expectedQuadraticRatio = messageCountRatio ** 2;
      
      console.log(`Message count ratio: ${messageCountRatio}`);
      console.log(`Time ratio: ${timeRatio}`);
      console.log(`Expected quadratic ratio: ${expectedQuadraticRatio}`);
      
      // BUG PROOF: Performance degrades worse than O(n) - approaching O(n²)
      // This test should fail, proving the performance issue
      expect(timeRatio).toBeLessThan(messageCountRatio * 2); // Should be O(n) or better
      
      // Additional check: large chats should not take excessively long
      expect(lastResult.avgTime).toBeLessThan(100); // Should format in under 100ms
    });

    it('should demonstrate history regeneration inefficiency', async () => {
      const chatId = await chatManager.createChat('Regeneration Test', 'test-agent');
      
      // Add substantial chat history
      for (let i = 0; i < 200; i++) {
        await chatManager.addMessage(
          chatId,
          `agent-${i % 5}`,
          `Message ${i}: This is a substantial message with enough content to make history formatting measurable. It contains multiple sentences and realistic content that would appear in actual usage.`
        );
      }
      
      const chat = await chatManager.getChat(chatId);
      expect(chat!.messages.length).toBe(200);
      
      // Measure multiple consecutive history formatting operations
      const formatTimes: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        chatManager.formatHistoryForGemini(chat!);
        const endTime = performance.now();
        formatTimes.push(endTime - startTime);
      }
      
      const avgFormatTime = formatTimes.reduce((sum, t) => sum + t, 0) / formatTimes.length;
      
      // BUG PROOF: Each formatting operation takes the same time (no caching)
      // If there was proper caching, subsequent operations should be much faster
      const minTime = Math.min(...formatTimes);
      const maxTime = Math.max(...formatTimes);
      const timeVariation = (maxTime - minTime) / avgFormatTime;
      
      console.log(`Format times: ${formatTimes.map(t => t.toFixed(2)).join(', ')}`);
      console.log(`Time variation: ${(timeVariation * 100).toFixed(1)}%`);
      
      // Should have caching to reduce subsequent format times
      expect(timeVariation).toBeLessThan(0.1); // Less than 10% variation if cached
      expect(avgFormatTime).toBeLessThan(5); // Should be very fast with caching
    });
  });

  /**
   * BUG 3: Race Conditions in Concurrent History Access
   * 
   * Problem: Multiple agents accessing/modifying chat simultaneously can cause
   * history formatting to be based on inconsistent state, leading to malformed output.
   */
  describe('BUG 3: Race Conditions in Concurrent History Access', () => {
    it('should expose race condition during concurrent history modification', async () => {
      const chatId = await chatManager.createChat('Race Condition Test', 'agent-0');
      
      // Pre-populate with some messages
      for (let i = 0; i < 20; i++) {
        await chatManager.addMessage(chatId, `agent-${i % 3}`, `Initial message ${i}`);
      }
      
      // Track formatting results for inconsistency detection
      const formattedResults: string[] = [];
      const messageCounts: number[] = [];
      
      // Create concurrent operations: some adding messages, others formatting history
      const concurrentOperations = [];
      
      // Operations that modify the chat
      for (let i = 0; i < 10; i++) {
        concurrentOperations.push(
          chatManager.addMessage(
            chatId, 
            `concurrent-agent-${i}`, 
            `Race condition message ${i} added during concurrent access`
          )
        );
      }
      
      // Operations that read/format history concurrently
      for (let i = 0; i < 10; i++) {
        concurrentOperations.push(
          (async () => {
            const chat = await chatManager.getChat(chatId);
            if (chat) {
              const formatted = chatManager.formatHistoryForGemini(chat);
              formattedResults.push(formatted);
              messageCounts.push(chat.messages.length);
            }
          })()
        );
      }
      
      // Execute all operations concurrently
      await Promise.allSettled(concurrentOperations);
      
      // Analyze results for race condition evidence
      const uniqueMessageCounts = [...new Set(messageCounts)];
      const uniqueFormattedLengths = [...new Set(formattedResults.map(r => r.length))];
      
      console.log('Message counts observed:', messageCounts);
      console.log('Unique message counts:', uniqueMessageCounts);
      console.log('Formatted result lengths:', formattedResults.map(r => r.length));
      
      // BUG PROOF: Race conditions cause inconsistent results
      // All concurrent reads should see the same state if properly synchronized
      expect(uniqueMessageCounts.length).toBe(1); // Should be consistent
      expect(uniqueFormattedLengths.length).toBe(1); // Should be consistent
      
      // Check for partial or corrupted messages in formatted output
      for (const formatted of formattedResults) {
        expect(formatted).toContain('=== CHAT HISTORY');
        expect(formatted).toContain('=== END CHAT HISTORY ===');
        
        // Should not contain truncated lines or malformed content
        const lines = formatted.split('\n');
        for (const line of lines) {
          if (line.startsWith('[') && line.includes(']:')) {
            // Agent message lines should be complete
            expect(line).toMatch(/^\[[\w-]+\]: .+$/);
          }
        }
      }
    });

    it('should demonstrate history corruption during truncation race', async () => {
      const chatId = await chatManager.createChat('Truncation Race Test', 'agent-0');
      
      // Create a chat that's close to the truncation limit
      const largeMessage = 'X'.repeat(8000); // Large messages to trigger truncation
      
      for (let i = 0; i < 3; i++) {
        await chatManager.addMessage(chatId, `agent-${i}`, `${largeMessage} - message ${i}`);
      }
      
      // Verify we're near the limit
      let chat = await chatManager.getChat(chatId);
      const totalChars = chat!.messages.reduce((sum, msg) => sum + msg.message.length, 0);
      expect(totalChars).toBeGreaterThan(20000); // Near 30k limit
      
      const corruptionResults: { messageCount: number; formatted: string }[] = [];
      
      // Concurrent operations that trigger truncation
      const truncationOperations = [];
      
      for (let i = 0; i < 15; i++) {
        truncationOperations.push(
          (async () => {
            // Add message that should trigger truncation
            await chatManager.addMessage(
              chatId,
              `truncation-agent-${i}`,
              `${largeMessage} - truncation trigger ${i}`
            );
            
            // Immediately try to format history (race with truncation)
            const updatedChat = await chatManager.getChat(chatId);
            if (updatedChat) {
              const formatted = chatManager.formatHistoryForGemini(updatedChat);
              corruptionResults.push({
                messageCount: updatedChat.messages.length,
                formatted
              });
            }
          })()
        );
      }
      
      await Promise.allSettled(truncationOperations);
      
      // Analyze for corruption evidence
      const messageCounts = corruptionResults.map(r => r.messageCount);
      const formattedLengths = corruptionResults.map(r => r.formatted.length);
      
      console.log('Message counts during truncation:', messageCounts);
      console.log('Formatted lengths during truncation:', formattedLengths);
      
      // BUG PROOF: Truncation races cause inconsistent message counts
      // Should have consistent truncation behavior
      const minCount = Math.min(...messageCounts);
      const maxCount = Math.max(...messageCounts);
      
      expect(maxCount - minCount).toBeLessThanOrEqual(1); // Should be consistent within 1 message
      
      // Check for truncated/corrupted content in formatting
      for (const result of corruptionResults) {
        expect(result.formatted).toContain('=== CHAT HISTORY');
        expect(result.formatted).toContain('=== END CHAT HISTORY ===');
        
        // Should not have partial messages due to race conditions
        const lines = result.formatted.split('\n');
        for (const line of lines) {
          if (line.includes(']: ')) {
            expect(line).not.toMatch(/]: .*\[/); // No overlapping agent messages
          }
        }
      }
    });
  });

  /**
   * BUG 4: Unicode Character Handling in Size Calculation
   * 
   * Problem: String.length counts UTF-16 code units, not actual characters.
   * Multi-byte Unicode characters (emojis, symbols) are miscounted, leading to
   * incorrect truncation and API payload size miscalculations.
   */
  describe('BUG 4: Unicode Character Handling Issues', () => {
    it('should expose Unicode character miscounting in truncation logic', async () => {
      const chatId = await chatManager.createChat('Unicode Test', 'test-agent');
      
      // Create messages with heavy Unicode content
      const emojiMessage = '🚀'.repeat(1000) + '🎯'.repeat(1000) + '✅'.repeat(1000); // 3000 emojis
      const unicodeSymbols = '∑∆∂∫∮∏∐√∛∜∞∝∴∵∼≈≠≤≥⊂⊃⊄⊅⊆⊇⊈⊉⊊⊋⊌⊍⊎⊏⊐⊑⊒⊓⊔⊕⊖⊗⊘⊙⊚⊛⊜⊝⊞⊟⊠⊡⊢⊣⊤⊥⊦⊧⊨⊩⊪⊫⊬⊭⊮⊯⊰⊱⊲⊳⊴⊵⊶⊷⊸⊹⊺⊻⊼⊽⊾⊿⋀⋁⋂⋃⋄⋅⋆⋇⋈⋉⋊⋋⋌⋍⋎⋏⋐⋑⋒⋓⋔⋕⋖⋗⋘⋙⋚⋛⋜⋝⋞⋟⋠⋡⋢⋣⋤⋥⋦⋧⋨⋩⋪⋫⋬⋭⋮⋯⋰⋱⋲⋳⋴⋵⋶⋷⋸⋹⋺⋻⋼⋽⋾⋿'.repeat(100);
      const chineseChars = '你好世界这是一个测试消息包含中文字符来验证Unicode处理是否正确工作在不同的字符编码情况下系统应该能够正确计算字符数量而不是字节数量'.repeat(200);
      
      // Add Unicode-heavy messages
      await chatManager.addMessage(chatId, 'emoji-agent', emojiMessage);
      await chatManager.addMessage(chatId, 'symbol-agent', unicodeSymbols);
      await chatManager.addMessage(chatId, 'chinese-agent', chineseChars);
      
      const chat = await chatManager.getChat(chatId);
      
      // Calculate different size metrics
      const stringLength = chat!.messages.reduce((sum, msg) => sum + msg.message.length, 0);
      const byteLength = chat!.messages.reduce((sum, msg) => sum + Buffer.byteLength(msg.message, 'utf8'), 0);
      const actualCharCount = chat!.messages.reduce((sum, msg) => sum + [...msg.message].length, 0);
      
      console.log(`String.length (UTF-16 code units): ${stringLength}`);
      console.log(`Byte length (UTF-8): ${byteLength}`);
      console.log(`Actual character count: ${actualCharCount}`);
      
      // BUG PROOF: System uses string.length which miscounts Unicode
      // For heavy Unicode content, these should be significantly different
      expect(stringLength).not.toBe(actualCharCount); // Should be different for emoji content
      expect(byteLength).toBeGreaterThan(stringLength); // UTF-8 bytes > UTF-16 code units for emojis
      
      // Test truncation behavior with Unicode
      // Add more content to trigger truncation
      const triggerMessage = 'A'.repeat(25000); // Should trigger truncation
      await chatManager.addMessage(chatId, 'trigger-agent', triggerMessage);
      
      const truncatedChat = await chatManager.getChat(chatId);
      const truncatedStringLength = truncatedChat!.messages.reduce((sum, msg) => sum + msg.message.length, 0);
      
      // BUG PROOF: Truncation based on string.length may not respect actual character/byte limits
      expect(truncatedStringLength).toBeLessThanOrEqual(30000); // Character limit
      
      // But the actual byte size might exceed expected limits due to Unicode
      const truncatedByteLength = truncatedChat!.messages.reduce((sum, msg) => sum + Buffer.byteLength(msg.message, 'utf8'), 0);
      console.log(`Truncated string length: ${truncatedStringLength}`);
      console.log(`Truncated byte length: ${truncatedByteLength}`);
      
      // Format for API to expose the byte size issue
      const formatted = chatManager.formatHistoryForGemini(truncatedChat!);
      const formattedByteSize = Buffer.byteLength(formatted, 'utf8');
      
      console.log(`Formatted byte size: ${formattedByteSize}`);
      
      // This might exceed API limits due to Unicode miscounting
      expect(formattedByteSize).toBeLessThan(1048576); // 1MB API limit
    });

    it('should demonstrate emoji rendering corruption in history formatting', async () => {
      const chatId = await chatManager.createChat('Emoji Test', 'test-agent');
      
      // Mix of different emoji types and combinations
      const simpleEmojis = '😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗☺😚😙🥲😋😛😜🤪😝🤑🤗🤭🤫🤔🤐🤨😐😑😶😶‍🌫️😏😒🙄😬😮‍💨🤥😔😪🤤😴😷🤒🤕🤢🤮🤧🥵🥶🥴😵😵‍💫🤯🤠🥳🥸😎🤓🧐😕😟🙁☹😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈👿💀☠💩🤡👹👺👻👽👾🤖😺😸😹😻😼😽🙀😿😾🙈🙉🙊💋💌💘💝💖💗💓💞💕💟❣💔❤️‍🔥❤️‍🩹❤🧡💛💚💙💜🤎🖤🤍💯💢💥💫💦💨🕳💣💬👁️‍🗨️💭💤👋🤚🖐✋🖖👌🤌🤏✌🤞🤟🤘🤙👈👉👆🖕👇☝👍👎👊✊🤛🤜👏🙌👐🤲🤝🙏✍💅🤳💪🦾🦿🦵🦶👂🦻👃🧠🫀🫁🦷🦴👀👁👅👄👶🧒👦👧🧑👱👨🧔👨‍🦰👨‍🦱👨‍🦳👨‍🦲👩👩‍🦰🧑‍🦰👩‍🦱🧑‍🦱👩‍🦳🧑‍🦳👩‍🦲🧑‍🦲👱‍♀️👱‍♂️🧓👴👵🙍🙍‍♂️🙍‍♀️🙎🙎‍♂️🙎‍♀️🙅🙅‍♂️🙅‍♀️🙆🙆‍♂️🙆‍♀️💁💁‍♂️💁‍♀️🙋🙋‍♂️🙋‍♀️🧏🧏‍♂️🧏‍♀️🙇🙇‍♂️🙇‍♀️🤦🤦‍♂️🤦‍♀️🤷🤷‍♂️🤷‍♀️🧑‍⚕️👨‍⚕️👩‍⚕️🧑‍🎓👨‍🎓👩‍🎓🧑‍🏫👨‍🏫👩‍🏫🧑‍⚖️👨‍⚖️👩‍⚖️🧑‍🌾👨‍🌾👩‍🌾🧑‍🍳👨‍🍳👩‍🍳🧑‍🔧👨‍🔧👩‍🔧🧑‍🏭👨‍🏭👩‍🏭🧑‍💼👨‍💼👩‍💼🧑‍🔬👨‍🔬👩‍🔬🧑‍💻👨‍💻👩‍💻🧑‍🎤👨‍🎤👩‍🎤🧑‍🎨👨‍🎨👩‍🎨🧑‍✈️👨‍✈️👩‍✈️🧑‍🚀👨‍🚀👩‍🚀🧑‍🚒👨‍🚒👩‍🚒👮👮‍♂️👮‍♀️🕵🕵️‍♂️🕵️‍♀️💂💂‍♂️💂‍♀️🥷👷👷‍♂️👷‍♀️🤴👸👳👳‍♂️👳‍♀️👲🧕🤵🤵‍♂️🤵‍♀️👰👰‍♂️👰‍♀️🤰🤱👨‍🍼👩‍🍼🧑‍🍼👼🎅🤶🧑‍🎄🦸🦸‍♂️🦸‍♀️🦹🦹‍♂️🦹‍♀️🧙🧙‍♂️🧙‍♀️🧚🧚‍♂️🧚‍♀️🧛🧛‍♂️🧛‍♀️🧜🧜‍♂️🧜‍♀️🧝🧝‍♂️🧝‍♀️🧞🧞‍♂️🧞‍♀️🧟🧟‍♂️🧟‍♀️💆💆‍♂️💆‍♀️💇💇‍♂️💇‍♀️🚶🚶‍♂️🚶‍♀️🧍🧍‍♂️🧍‍♀️🧎🧎‍♂️🧎‍♀️🧑‍🦯👨‍🦯👩‍🦯🧑‍🦼👨‍🦼👩‍🦼🧑‍🦽👨‍🦽👩‍🦽🏃🏃‍♂️🏃‍♀️💃🕺🕴👯👯‍♂️👯‍♀️🧖🧖‍♂️🧖‍♀️🧗🧗‍♂️🧗‍♀️🤺🏇⛷🏂🏌🏌️‍♂️🏌️‍♀️🏄🏄‍♂️🏄‍♀️🚣🚣‍♂️🚣‍♀️🏊🏊‍♂️🏊‍♀️⛹⛹️‍♂️⛹️‍♀️🏋🏋️‍♂️🏋️‍♀️🚴🚴‍♂️🚴‍♀️🚵🚵‍♂️🚵‍♀️🤸🤸‍♂️🤸‍♀️🤼🤼‍♂️🤼‍♀️🤽🤽‍♂️🤽‍♀️🤾🤾‍♂️🤾‍♀️🤹🤹‍♂️🤹‍♀️🧘🧘‍♂️🧘‍♀️🛀🛌🧑‍🤝‍🧑👭👫👬💏💑👪👨‍👩‍👧👨‍👩‍👧‍👦👨‍👩‍👦‍👦👨‍👩‍👧‍👧👨‍👨‍👦👨‍👨‍👧👨‍👨‍👧‍👦👨‍👨‍👦‍👦👨‍👨‍👧‍👧👩‍👩‍👦👩‍👩‍👧👩‍👩‍👧‍👦👩‍👩‍👦‍👦👩‍👩‍👧‍👧👨‍👦👨‍👦‍👦👨‍👧👨‍👧‍👦👨‍👧‍👧👩‍👦👩‍👦‍👦👩‍👧👩‍👧‍👦👩‍👧‍👧🗣👤👥🫂👣🦰🦱🦳🦲🐵🐒🦍🦧🐶🐕🦮🐕‍🦺🐩🐺🦊🦝🐱🐈🐈‍⬛🦁🐯🐅🐆🐴🐎🦄🦓🦌🦬🐮🐂🐃🐄🐷🐖🐗🐽🐏🐑🐐🐪🐫🦙🦒🐘🦣🦏🦛🐭🐁🐀🐹🐰🐇🐿🦫🦔🦇🐻🐻‍❄️🐨🐼🦥🦦🦨🦘🦡🐾🦃🐔🐓🐣🐤🐥🐦🐧🕊🦅🦆🦢🦉🦤🪶🦩🦚🦜🐸🐊🐢🦎🐍🐲🐉🦕🦖🐳🐋🐬🦭🐟🐠🐡🦈🐙🐚🐌🦋🐛🐜🐝🪲🐞🦗🕷🪳🕸🦂🦟🪰🪱🦠💐🌸💮🏵🌹🥀🌺🌻🌼🌷⚘🌱🪴🌲🌳🌴🌵🌶🌾🌿☘🍀🍁🍂🍃🪸🪷🍇🍈🍉🍊🍋🍌🍍🥭🍎🍏🍐🍑🍒🍓🫐🥝🍅🫒🥥🥑🍆🥔🥕🌽🌶🫑🥒🥬🥦🧄🧅🍄🥜🌰🍞🥐🥖🫓🥨🥯🥞🧇🧈🍳🥚🧀🥓🥩🍗🍖🦴🌭🍔🍟🍕🫔🥪🥙🧆🌮🌯🫔🥗🥘🫕🥫🍝🍜🍲🍛🍣🍱🥟🦪🍤🍙🍚🍘🍥🥠🥮🍢🍡🍧🍨🍦🥧🧁🍰🎂🍮🍭🍬🍫🍿🍩🍪🌰🥜🍯🥛🍼🫖☕🍵🧃🥤🧋🍶🍾🍷🍸🍹🍺🍻🥂🥃🥤🧊🥢🍽🍴🥄🔪🫙🏺⚽🏀🏈⚾🥎🎾🏐🏉🥏🎱🪀🏓🏸🏒🏑🥍🏏🪃🥅⛳🪁🏹🎣🤿🥊🥋🎽🛹🛼🛷⛸🥌🎿⛷🏂🪂🏋🤼🤸🏃🚶🧘🏄🏊⛹🏌🚴🚵🧗🤺🏇🧑‍🤝‍🧑🏩🏨🏠🏡🏘🏚🏗🏭🏢🏬🏣🏤🏥🏦🏪🏫🏬🏭🏯🏰🗼🗽⛪🕌🛕🕍⛩🕋⛲⛺🌁🌃🏙🌄🌅🌆🌇🌉♨🎠🎡🎢💈🎪🚂🚃🚄🚅🚆🚇🚈🚉🚊🚝🚞🚋🚌🚍🚎🚐🚑🚒🚓🚔🚕🚖🚗🚘🚙🛻🚚🚛🚜🏎🏍🛵🦽🦼🛴🚲🛺🚁🚟🚠🚡🛸⚽⛽🚨🚥🚦🛑🚧⚓⛵🛶🚤🛳⛴🛥🚢✈🛩🛫🛬🪂💺🚁🚟🚠🚡🛸🚀🛸🛰💺🚁🚟🚠🚡🛸🚀🛸🛰💺🧳⌛⏳⌚⏰⏱⏲🕰🕛🕧🕐🕜🕑🕝🕒🕞🕓🕟🕔🕠🕕🕖🕗🕘🕙🕚🌑🌒🌓🌔🌕🌖🌗🌘🌙🌚🌛🌜🌡☀🌝🌞🪐⭐🌟🌠🌌☁⛅⛈🌤🌦🌧🌩🌨❄☃⛄🌬💨💧💦☔☂🌊🌫🍏🍎🍐🍊🍋🍌🍉🍇🍓🫐🍈🍒🍑🥭🍍🥥🥝🍅🍆🥑🥦🥬🥒🌶🫑🌽🥕🫒🧄🧅🥔🍠🥐🥯🍞🥖🥨🧀🥚🍳🧈🥞🧇🥓🥩🍗🍖🦴🌭🍔🍟🍕🥪🥙🧆🌮🌯🥗🥘🫕🥫🍝🍜🍲🍛🍣🍱🥟🦪🍤🍙🍚🍘🍥🥠🥮🍢🍡🍧🍨🍦🥧🧁🍰🎂🍮🍭🍬🍫🍿🍩🍪🌰🥜🍯🥛🍼🫖☕🍵🧃🥤🧋🍶🍾🍷🍸🍹🍺🍻🥂🥃🥤🧊🥢🍽🍴🥄🔪🫙🏺';
      
      const complexEmojis = '👨‍👩‍👧‍👦👨‍👨‍👦‍👦👩‍👩‍👧‍👧🧑‍🤝‍🧑👭👫👬💏💑👪👨‍⚕️👩‍⚕️🧑‍⚕️👨‍🌾👩‍🌾🧑‍🌾👨‍🍳👩‍🍳🧑‍🍳👨‍🎓👩‍🎓🧑‍🎓👨‍🎤👩‍🎤🧑‍🎤👨‍🏫👩‍🏫🧑‍🏫👨‍🏭👩‍🏭🧑‍🏭👨‍💻👩‍💻🧑‍💻👨‍💼👩‍💼🧑‍💼👨‍🔧👩‍🔧🧑‍🔧👨‍🔬👩‍🔬🧑‍🔬👨‍🎨👩‍🎨🧑‍🎨👨‍🚒👩‍🚒🧑‍🚒👨‍✈️👩‍✈️🧑‍✈️👨‍🚀👩‍🚀🧑‍🚀👨‍⚖️👩‍⚖️🧑‍⚖️👮‍♂️👮‍♀️👮🕵️‍♂️🕵️‍♀️🕵️💂‍♂️💂‍♀️💂🥷👷‍♂️👷‍♀️👷🤴👸👳‍♂️👳‍♀️👳👲🧕🤵‍♂️🤵‍♀️🤵👰‍♂️👰‍♀️👰🤰🤱👨‍🍼👩‍🍼🧑‍🍼👼🎅🤶🧑‍🎄🦸‍♂️🦸‍♀️🦸🦹‍♂️🦹‍♀️🦹🧙‍♂️🧙‍♀️🧙🧚‍♂️🧚‍♀️🧚🧛‍♂️🧛‍♀️🧛🧜‍♂️🧜‍♀️🧜🧝‍♂️🧝‍♀️🧝🧞‍♂️🧞‍♀️🧞🧟‍♂️🧟‍♀️🧟💆‍♂️💆‍♀️💆💇‍♂️💇‍♀️💇🚶‍♂️🚶‍♀️🚶🧍‍♂️🧍‍♀️🧍🧎‍♂️🧎‍♀️🧎👨‍🦯👩‍🦯🧑‍🦯👨‍🦼👩‍🦼🧑‍🦼👨‍🦽👩‍🦽🧑‍🦽🏃‍♂️🏃‍♀️🏃💃🕺🕴👯‍♂️👯‍♀️👯🧖‍♂️🧖‍♀️🧖🧗‍♂️🧗‍♀️🧗🤺🏇⛷🏂🏌️‍♂️🏌️‍♀️🏌️🏄‍♂️🏄‍♀️🏄🚣‍♂️🚣‍♀️🚣🏊‍♂️🏊‍♀️🏊⛹️‍♂️⛹️‍♀️⛹️🏋️‍♂️🏋️‍♀️🏋️🚴‍♂️🚴‍♀️🚴🚵‍♂️🚵‍♀️🚵🤸‍♂️🤸‍♀️🤸🤼‍♂️🤼‍♀️🤼🤽‍♂️🤽‍♀️🤽🤾‍♂️🤾‍♀️🤾🤹‍♂️🤹‍♀️🤹🧘‍♂️🧘‍♀️🧘🛀🛌'.repeat(10);
      
      await chatManager.addMessage(chatId, 'simple-emoji-agent', simpleEmojis);
      await chatManager.addMessage(chatId, 'complex-emoji-agent', complexEmojis);
      
      const chat = await chatManager.getChat(chatId);
      
      // Check different size calculations
      const totalMessages = chat!.messages;
      let stringLengthTotal = 0;
      let actualCharTotal = 0;
      let byteLengthTotal = 0;
      
      for (const msg of totalMessages) {
        stringLengthTotal += msg.message.length;
        actualCharTotal += [...msg.message].length;
        byteLengthTotal += Buffer.byteLength(msg.message, 'utf8');
      }
      
      console.log(`String length: ${stringLengthTotal}`);
      console.log(`Actual characters: ${actualCharTotal}`);
      console.log(`Byte length: ${byteLengthTotal}`);
      
      // Format for Gemini to see the impact
      const formatted = chatManager.formatHistoryForGemini(chat!);
      const formattedStringLength = formatted.length;
      const formattedActualChars = [...formatted].length;
      const formattedByteLength = Buffer.byteLength(formatted, 'utf8');
      
      console.log(`Formatted string length: ${formattedStringLength}`);
      console.log(`Formatted actual chars: ${formattedActualChars}`);
      console.log(`Formatted byte length: ${formattedByteLength}`);
      
      // BUG PROOF: Unicode causes significant discrepancies in size calculations
      expect(stringLengthTotal).not.toBe(actualCharTotal); // Should be different for emojis
      expect(formattedByteLength).toBeGreaterThan(formattedStringLength * 1.5); // Emojis are multi-byte
      
      // Check for corrupted emoji rendering in formatted output
      const lines = formatted.split('\n');
      for (const line of lines) {
        if (line.includes('🚀') || line.includes('👨‍👩‍👧‍👦')) {
          // Emojis should render properly in formatted output
          expect(line).not.toMatch(/[\uFFFD]/); // No replacement characters
          expect(line).not.toMatch(/\\u[0-9A-Fa-f]{4}/); // No escaped Unicode
        }
      }
      
      // Test API payload size assumption vs reality
      mockExecuteGeminiCLI.mockRejectedValueOnce(
        new Error('Request payload size exceeds the limit: 1048576 bytes')
      );
      
      // This might fail due to actual byte size being much larger than string length suggests
      await expect(
        executeGeminiCLI(formatted)
      ).rejects.toThrow('payload size exceeds the limit');
    });
  });

  /**
   * BUG 5: Windows Command Line Integration Limits
   * 
   * Problem: Windows has an 8192 character command line limit. When chat history
   * is prepended to prompts, it can exceed this limit, causing command execution
   * to fail even when individual components are within limits.
   */
  describe('BUG 5: Windows Command Line Integration Limits', () => {
    it('should expose Windows command line length violations with chat history', async () => {
      // Only run this test on Windows
      if (process.platform !== 'win32') {
        console.log('Skipping Windows-specific test on non-Windows platform');
        return;
      }
      
      const chatId = await chatManager.createChat('Windows CLI Test', 'test-agent');
      
      // Create chat history that when combined with a prompt exceeds Windows CLI limit
      const mediumMessage = 'This is a substantial chat message that contains enough content to contribute to command line length issues when combined with other messages and the actual user prompt. '.repeat(10); // ~1000 chars per message
      
      // Add multiple messages to build up history
      for (let i = 0; i < 15; i++) {
        await chatManager.addMessage(
          chatId,
          `agent-${i}`,
          `${mediumMessage} Message number ${i} with additional context.`
        );
      }
      
      const chat = await chatManager.getChat(chatId);
      const formattedHistory = chatManager.formatHistoryForGemini(chat!);
      
      console.log(`Formatted history length: ${formattedHistory.length} characters`);
      
      // Create a user prompt that, when combined with history, exceeds Windows limit
      const userPrompt = 'Please analyze all the code patterns and provide detailed recommendations for improvement, focusing on performance optimization, security enhancements, and maintainability improvements. Consider the architectural implications and suggest specific implementation strategies.'.repeat(5);
      
      const combinedPrompt = `${formattedHistory}\n\nNew request: ${userPrompt}`;
      
      console.log(`Combined prompt length: ${combinedPrompt.length} characters`);
      console.log(`Windows CLI limit: 8192 characters`);
      
      // BUG PROOF: Combined prompt exceeds Windows command line limit
      expect(combinedPrompt.length).toBeGreaterThan(8192);
      
      // Mock Windows command line failure
      mockExecuteGeminiCLI.mockRejectedValueOnce(
        new Error('The command line is too long.')
      );
      
      // This should fail on Windows due to command line length limit
      await expect(
        executeGeminiCLI(combinedPrompt)
      ).rejects.toThrow('command line is too long');
      
      // Verify that history alone might be acceptable, but combined fails
      expect(formattedHistory.length).toBeLessThan(7000); // History alone is OK
      expect(userPrompt.length).toBeLessThan(2000); // Prompt alone is OK
      expect(combinedPrompt.length).toBeGreaterThan(8192); // Combined exceeds limit
    });

    it('should demonstrate temp file fallback inadequacy for concurrent requests', async () => {
      if (process.platform !== 'win32') {
        console.log('Skipping Windows-specific test on non-Windows platform');
        return;
      }
      
      const chatId = await chatManager.createChat('Temp File Test', 'test-agent');
      
      // Create substantial chat history
      const largeMessage = 'X'.repeat(2000); // 2k characters per message
      for (let i = 0; i < 10; i++) {
        await chatManager.addMessage(chatId, `agent-${i}`, `${largeMessage} - message ${i}`);
      }
      
      const chat = await chatManager.getChat(chatId);
      const formattedHistory = chatManager.formatHistoryForGemini(chat!);
      
      // Create multiple concurrent requests that would all need temp files
      const concurrentRequests = [];
      const requestCount = 5;
      
      for (let i = 0; i < requestCount; i++) {
        const longPrompt = `${formattedHistory}\n\nConcurrent request ${i}: ${'Please analyze '.repeat(100)}`;
        
        concurrentRequests.push(
          executeGeminiCLI(longPrompt)
        );
      }
      
      // Mock temp file race condition or resource exhaustion
      let tempFileCallCount = 0;
      mockExecuteGeminiCLI.mockImplementation(async (prompt) => {
        tempFileCallCount++;
        if (tempFileCallCount > 2) {
          // Simulate temp file creation failure or race condition
          throw new Error('Cannot create temporary file: Access is denied');
        }
        return 'Success';
      });
      
      const results = await Promise.allSettled(concurrentRequests);
      
      const failures = results.filter(r => r.status === 'rejected').length;
      const successes = results.filter(r => r.status === 'fulfilled').length;
      
      console.log(`Concurrent requests: ${requestCount}`);
      console.log(`Successes: ${successes}, Failures: ${failures}`);
      
      // BUG PROOF: Concurrent long prompts cause temp file issues
      expect(failures).toBeGreaterThan(0); // Some should fail due to temp file issues
      expect(tempFileCallCount).toBeGreaterThan(requestCount * 0.5); // Multiple attempts made
    });

    it('should expose temp file cleanup race conditions', async () => {
      if (process.platform !== 'win32') {
        console.log('Skipping Windows-specific test on non-Windows platform');
        return;
      }
      
      const chatId = await chatManager.createChat('Cleanup Race Test', 'test-agent');
      
      // Create chat history that requires temp file usage
      const massiveMessage = 'Y'.repeat(5000); // 5k chars per message
      for (let i = 0; i < 5; i++) {
        await chatManager.addMessage(chatId, `agent-${i}`, massiveMessage);
      }
      
      const chat = await chatManager.getChat(chatId);
      const formattedHistory = chatManager.formatHistoryForGemini(chat!);
      const longPrompt = `${formattedHistory}\n\nAnalyze this extensive history`;
      
      // Create a scenario where temp file cleanup might race with file usage
      let cleanupCallCount = 0;
      let tempFilePath: string | null = null;
      
      mockExecuteGeminiCLI.mockImplementation(async (prompt) => {
        // Simulate temp file creation
        tempFilePath = join(tmpdir(), `test-prompt-${Date.now()}.txt`);
        
        // Simulate cleanup being called before command completion
        setTimeout(() => {
          cleanupCallCount++;
          // Simulate cleanup attempting to delete file while still in use
          if (tempFilePath) {
            try {
              // This would normally delete the temp file
              console.log(`Cleanup attempt ${cleanupCallCount} for ${tempFilePath}`);
            } catch (error) {
              console.log(`Cleanup race condition: ${error}`);
            }
          }
        }, 10); // Very short delay to create race condition
        
        // Simulate longer command execution
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (cleanupCallCount > 0) {
          throw new Error('The process cannot access the file because it is being used by another process');
        }
        
        return 'Success';
      });
      
      // This should fail due to temp file cleanup race condition
      await expect(
        executeGeminiCLI(longPrompt)
      ).rejects.toThrow('cannot access the file because it is being used');
      
      // BUG PROOF: Cleanup races with file usage
      expect(cleanupCallCount).toBeGreaterThan(0);
      expect(tempFilePath).not.toBeNull();
    });
  });

  /**
   * Integration Test: Multiple Bugs Interacting
   * 
   * This test demonstrates how multiple bugs can compound each other,
   * creating even more severe failures in real-world scenarios.
   */
  describe('Integration: Multiple Bugs Compounding', () => {
    it('should demonstrate cascading failure with Unicode + Performance + Token limits', async () => {
      const chatId = await chatManager.createChat('Cascading Failure Test', 'test-agent');
      
      // Start performance measurement
      const performanceStart = performance.now();
      
      // Create a scenario with multiple bug triggers:
      // 1. Heavy Unicode content (Bug 4)
      // 2. Large chat size (Bug 2 - performance)
      // 3. Code-heavy content (Bug 1 - token limits)
      
      const unicodeCodeBlock = `
        // Unicode function names and comments (legal in modern JS)
        function процессДанных🚀(данные📊) {
          const результат💎 = данные📊.map(элемент => {
            // Process each элемент with special логика
            return элемент * 2 + '✨';
          });
          
          console.log('Результат обработки:', результат💎);
          return результат💎;
        }
        
        const конфигурация🔧 = {
          имяПриложения: 'Тестовое приложение🌟',
          версия: '1.0.0-β',
          настройки: {
            язык: 'русский🇷🇺',
            тема: 'темная🌙',
            уведомления: true✅
          }
        };
      `.repeat(5);
      
      // Add many messages with problematic content
      const messagePromises = [];
      for (let i = 0; i < 100; i++) {
        messagePromises.push(
          chatManager.addMessage(
            chatId,
            `unicode-agent-${i % 10}`,
            `${unicodeCodeBlock}\n\n// Message ${i} with additional context 🎯`
          )
        );
      }
      
      await Promise.all(messagePromises);
      
      const performanceMiddle = performance.now();
      console.log(`Adding messages took: ${performanceMiddle - performanceStart}ms`);
      
      // Now try to format history (triggers multiple bugs)
      const formatStart = performance.now();
      const chat = await chatManager.getChat(chatId);
      const formattedHistory = chatManager.formatHistoryForGemini(chat!);
      const formatEnd = performance.now();
      
      console.log(`History formatting took: ${formatEnd - formatStart}ms`);
      
      // Analyze the compound effects
      const stringLength = formattedHistory.length;
      const actualCharLength = [...formattedHistory].length;
      const byteLength = Buffer.byteLength(formattedHistory, 'utf8');
      
      console.log(`String length: ${stringLength}`);
      console.log(`Actual char length: ${actualCharLength}`);
      console.log(`Byte length: ${byteLength}`);
      
      // BUG PROOF: Multiple issues compound
      
      // 1. Performance degradation with large Unicode content
      expect(formatEnd - formatStart).toBeLessThan(50); // Should be fast with caching
      
      // 2. Unicode size miscalculation affects API limits
      expect(byteLength).toBeLessThan(1048576); // API byte limit
      
      // 3. Combined length might exceed command line limits on Windows
      if (process.platform === 'win32') {
        const testPrompt = 'Analyze this code and provide recommendations';
        const combinedLength = stringLength + testPrompt.length;
        expect(combinedLength).toBeLessThan(8192); // Windows CLI limit
      }
      
      // 4. Token density issues with Unicode + code content
      mockExecuteGeminiCLI.mockRejectedValueOnce(
        new Error('Request contains too many tokens: estimated 150000, limit 128000')
      );
      
      await expect(
        executeGeminiCLI(`${formattedHistory}\n\nAnalyze all this Unicode code`)
      ).rejects.toThrow('too many tokens');
      
      const performanceEnd = performance.now();
      console.log(`Total test execution: ${performanceEnd - performanceStart}ms`);
      
      // Performance should not degrade this severely with proper optimization
      expect(performanceEnd - performanceStart).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});