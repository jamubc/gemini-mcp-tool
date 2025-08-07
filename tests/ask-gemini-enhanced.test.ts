import { describe, it, expect, beforeEach, vi } from 'vitest';
import { askGeminiTool } from '../src/tools/ask-gemini.tool.js';

describe('Enhanced ask_gemini Tool - Parameter Validation', () => {
  describe('Schema Validation', () => {
    it('should require agentName parameter', async () => {
      const args = {
        prompt: 'Hello world'
        // Missing agentName
      };

      await expect(askGeminiTool.execute(args)).rejects.toThrow('Agent name is required');
    });

    it('should reject empty agentName', async () => {
      const args = {
        prompt: 'Hello world',
        agentName: ''
      };

      await expect(askGeminiTool.execute(args)).rejects.toThrow('Agent name is required');
    });

    it('should reject agentName with only whitespace', async () => {
      const args = {
        prompt: 'Hello world',
        agentName: '   '
      };

      await expect(askGeminiTool.execute(args)).rejects.toThrow('Agent name is required');
    });

    it('should validate chatId as number', () => {
      // Test the Zod schema validation
      const validArgs = {
        prompt: 'Test prompt',
        agentName: 'test-agent',
        chatId: 5
      };

      const validStringArgs = {
        prompt: 'Test prompt', 
        agentName: 'test-agent',
        chatId: '456' // Now accepts strings
      };

      expect(() => askGeminiTool.zodSchema.parse(validArgs)).not.toThrow();
      expect(() => askGeminiTool.zodSchema.parse(validStringArgs)).not.toThrow();
      
      // Both should be converted to strings
      const parsedNumeric = askGeminiTool.zodSchema.parse(validArgs);
      const parsedString = askGeminiTool.zodSchema.parse(validStringArgs);
      expect(parsedNumeric.chatId).toBe('5');
      expect(parsedString.chatId).toBe('456');
    });

    it('should default chatId to 0', () => {
      const args = {
        prompt: 'Test prompt',
        agentName: 'test-agent'
        // chatId not provided
      };

      const parsed = askGeminiTool.zodSchema.parse(args);
      expect(parsed.chatId).toBe('0');
    });

    it('should validate agentName length constraints', () => {
      const validArgs = {
        prompt: 'Test prompt',
        agentName: 'valid-agent-name',
        chatId: 0
      };

      const tooLongArgs = {
        prompt: 'Test prompt',
        agentName: 'a'.repeat(51), // Exceeds 50 char limit
        chatId: 0
      };

      expect(() => askGeminiTool.zodSchema.parse(validArgs)).not.toThrow();
      expect(() => askGeminiTool.zodSchema.parse(tooLongArgs)).toThrow();
    });

    it('should preserve existing parameters (model, sandbox)', () => {
      const args = {
        prompt: 'Test prompt',
        agentName: 'test-agent',
        chatId: 1,
        model: 'gemini-2.5-flash',
        sandbox: true
      };

      const parsed = askGeminiTool.zodSchema.parse(args);
      expect(parsed.model).toBe('gemini-2.5-flash');
      expect(parsed.sandbox).toBe(true);
    });
  });

  describe('Parameter Integration', () => {
    it('should handle all parameter combinations correctly', () => {
      const testCases = [
        // Minimum required parameters
        {
          prompt: 'Hello',
          agentName: 'agent1',
          expected: { chatId: '0', sandbox: false }
        },
        // With chatId
        {
          prompt: 'Hello',
          agentName: 'agent1', 
          chatId: 5,
          expected: { chatId: '5', sandbox: false }
        },
        // With all optional parameters
        {
          prompt: 'Hello',
          agentName: 'agent1',
          chatId: 3,
          model: 'gemini-2.5-flash',
          sandbox: true,
          expected: { 
            chatId: '3', 
            model: 'gemini-2.5-flash',
            sandbox: true
          }
        }
      ];

      testCases.forEach((testCase, i) => {
        const { expected, ...args } = testCase;
        const parsed = askGeminiTool.zodSchema.parse(args);
        
        Object.entries(expected).forEach(([key, value]) => {
          expect(parsed[key]).toBe(value, `Test case ${i + 1}, parameter ${key}`);
        });
      });
    });
  });

  describe('Tool Properties', () => {
    it('should have correct tool name and description', () => {
      expect(askGeminiTool.name).toBe('ask-gemini');
      expect(askGeminiTool.description).toBe('Ask Gemini with chat context - supports model selection, sandbox mode, and chat integration');
      expect(askGeminiTool.category).toBe('gemini');
    });

    it('should have updated prompt description', () => {
      expect(askGeminiTool.prompt?.description).toBe('Execute \'gemini -p <prompt>\' to get Gemini AI\'s response with chat context. Creates new chat if chatId is 0 or omitted.');
    });
  });
});