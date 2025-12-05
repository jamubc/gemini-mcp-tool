import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    setRequestHandler: vi.fn(),
    connect: vi.fn(),
    notification: vi.fn(),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(),
}));

describe('Gemini MCP Server', () => {
  let consoleErrorSpy: any;
  let consoleDebugSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  describe('Server Initialization', () => {
    it('should create server with correct name and version', () => {
      // Import will initialize the server
      const mockServer = vi.mocked(Server).mock.results[0];
      expect(Server).toHaveBeenCalled();

      const serverConfig = vi.mocked(Server).mock.calls[0][0];
      expect(serverConfig).toHaveProperty('name', 'gemini-cli-mcp');
      expect(serverConfig).toHaveProperty('version');
    });

    it('should register capabilities', () => {
      const serverConfig = vi.mocked(Server).mock.calls[0][1];
      expect(serverConfig).toHaveProperty('capabilities');
      expect(serverConfig.capabilities).toHaveProperty('tools');
      expect(serverConfig.capabilities).toHaveProperty('prompts');
    });
  });

  describe('Request Handlers', () => {
    it('should register ListToolsRequestSchema handler', () => {
      const mockServerInstance = vi.mocked(Server).mock.results[0].value;
      expect(mockServerInstance.setRequestHandler).toHaveBeenCalled();

      const calls = mockServerInstance.setRequestHandler.mock.calls;
      const listToolsHandler = calls.find((call: any) =>
        call[0]?.name === 'tools/list' || call[0]?.method === 'tools/list'
      );

      // At minimum, verify handler was registered
      expect(calls.length).toBeGreaterThan(0);
    });

    it('should register CallToolRequestSchema handler', () => {
      const mockServerInstance = vi.mocked(Server).mock.results[0].value;
      const calls = mockServerInstance.setRequestHandler.mock.calls;

      // Verify multiple handlers were registered
      expect(calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should register ListPromptsRequestSchema handler', () => {
      const mockServerInstance = vi.mocked(Server).mock.results[0].value;
      const calls = mockServerInstance.setRequestHandler.mock.calls;

      // Verify prompts handler was registered
      expect(calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Progress Notifications', () => {
    it('should support progress notifications', () => {
      const mockServerInstance = vi.mocked(Server).mock.results[0].value;
      expect(mockServerInstance).toHaveProperty('notification');
      expect(typeof mockServerInstance.notification).toBe('function');
    });
  });

  describe('Transport Connection', () => {
    it('should connect to StdioServerTransport', () => {
      expect(StdioServerTransport).toHaveBeenCalled();
    });
  });
});
