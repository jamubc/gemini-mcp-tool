import { describe, it, expect, beforeEach } from 'vitest';
import { toolRegistry, getToolDefinitions, toolExists, getPromptDefinitions } from '../tools/registry.js';

describe('Tool Registry', () => {
  describe('getToolDefinitions', () => {
    it('should return an array of tool definitions', () => {
      const tools = getToolDefinitions();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should include ask-gemini tool', () => {
      const tools = getToolDefinitions();
      const askGeminiTool = tools.find(t => t.name === 'ask-gemini');

      expect(askGeminiTool).toBeDefined();
      expect(askGeminiTool?.description).toBeTruthy();
      expect(askGeminiTool?.inputSchema).toBeDefined();
    });

    it('should include brainstorm tool', () => {
      const tools = getToolDefinitions();
      const brainstormTool = tools.find(t => t.name === 'brainstorm');

      expect(brainstormTool).toBeDefined();
      expect(brainstormTool?.description).toContain('brainstorm');
    });

    it('should include ping tool', () => {
      const tools = getToolDefinitions();
      const pingTool = tools.find(t => t.name === 'ping');

      expect(pingTool).toBeDefined();
    });

    it('should include Help tool', () => {
      const tools = getToolDefinitions();
      const helpTool = tools.find(t => t.name === 'Help');

      expect(helpTool).toBeDefined();
    });

    it('should include fetch-chunk tool', () => {
      const tools = getToolDefinitions();
      const fetchChunkTool = tools.find(t => t.name === 'fetch-chunk');

      expect(fetchChunkTool).toBeDefined();
    });

    it('should have valid input schemas', () => {
      const tools = getToolDefinitions();

      tools.forEach(tool => {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema).toHaveProperty('properties');
        expect(tool.inputSchema).toHaveProperty('required');
      });
    });
  });

  describe('toolExists', () => {
    it('should return true for existing tools', () => {
      expect(toolExists('ask-gemini')).toBe(true);
      expect(toolExists('brainstorm')).toBe(true);
      expect(toolExists('ping')).toBe(true);
      expect(toolExists('Help')).toBe(true);
      expect(toolExists('fetch-chunk')).toBe(true);
    });

    it('should return false for non-existent tools', () => {
      expect(toolExists('nonexistent-tool')).toBe(false);
      expect(toolExists('fake-tool')).toBe(false);
    });
  });

  describe('getPromptDefinitions', () => {
    it('should return an array of prompt definitions', () => {
      const prompts = getPromptDefinitions();
      expect(Array.isArray(prompts)).toBe(true);
      expect(prompts.length).toBeGreaterThan(0);
    });

    it('should only include tools with prompt property', () => {
      const prompts = getPromptDefinitions();

      prompts.forEach(prompt => {
        expect(prompt).toHaveProperty('name');
        expect(prompt).toHaveProperty('description');
        expect(prompt).toHaveProperty('arguments');
      });
    });

    it('should include ask-gemini prompt', () => {
      const prompts = getPromptDefinitions();
      const askGeminiPrompt = prompts.find(p => p.name === 'ask-gemini');

      expect(askGeminiPrompt).toBeDefined();
      expect(askGeminiPrompt?.description).toBeTruthy();
    });

    it('should include brainstorm prompt', () => {
      const prompts = getPromptDefinitions();
      const brainstormPrompt = prompts.find(p => p.name === 'brainstorm');

      expect(brainstormPrompt).toBeDefined();
    });
  });

  describe('Tool Schema Validation', () => {
    it('ask-gemini should have required prompt parameter', () => {
      const tools = getToolDefinitions();
      const askGeminiTool = tools.find(t => t.name === 'ask-gemini');

      expect(askGeminiTool?.inputSchema.properties).toHaveProperty('prompt');
      expect(askGeminiTool?.inputSchema.required).toContain('prompt');
    });

    it('ask-gemini should have optional parameters', () => {
      const tools = getToolDefinitions();
      const askGeminiTool = tools.find(t => t.name === 'ask-gemini');

      const properties = askGeminiTool?.inputSchema.properties;
      expect(properties).toHaveProperty('model');
      expect(properties).toHaveProperty('sandbox');
      expect(properties).toHaveProperty('changeMode');
      expect(properties).toHaveProperty('yolo');
      expect(properties).toHaveProperty('approvalMode');
    });

    it('brainstorm should have methodology parameter', () => {
      const tools = getToolDefinitions();
      const brainstormTool = tools.find(t => t.name === 'brainstorm');

      expect(brainstormTool?.inputSchema.properties).toHaveProperty('methodology');
    });

    it('fetch-chunk should have required cacheKey and chunkIndex', () => {
      const tools = getToolDefinitions();
      const fetchChunkTool = tools.find(t => t.name === 'fetch-chunk');

      expect(fetchChunkTool?.inputSchema.properties).toHaveProperty('cacheKey');
      expect(fetchChunkTool?.inputSchema.properties).toHaveProperty('chunkIndex');
      expect(fetchChunkTool?.inputSchema.required).toContain('cacheKey');
      expect(fetchChunkTool?.inputSchema.required).toContain('chunkIndex');
    });
  });

  describe('Tool Categories', () => {
    it('should categorize tools correctly', () => {
      const askGemini = toolRegistry.find(t => t.name === 'ask-gemini');
      const brainstorm = toolRegistry.find(t => t.name === 'brainstorm');
      const ping = toolRegistry.find(t => t.name === 'ping');
      const fetchChunk = toolRegistry.find(t => t.name === 'fetch-chunk');

      expect(askGemini?.category).toBe('gemini');
      expect(brainstorm?.category).toBe('gemini');
      expect(ping?.category).toBe('simple');
      expect(fetchChunk?.category).toBe('utility');
    });
  });
});
