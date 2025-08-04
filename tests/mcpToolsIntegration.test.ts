import { describe, it, afterEach, expect, vi, beforeEach } from 'vitest';
import { UnifiedTool, toolRegistry, executeTool, getToolDefinitions } from '../src/tools/registry.js';
import { CreateChatTool } from '../src/tools/createChatTool.js';
import { ListChatsTool } from '../src/tools/listChatsTool.js';
import { AddMessageTool } from '../src/tools/addMessageTool.js';
import { GetHistoryTool } from '../src/tools/getHistoryTool.js';
import { ERROR_MESSAGES, PROTOCOL } from '../src/constants.js';

// Mock the ChatManager
vi.mock('../src/managers/chatManager.js', () => ({
  ChatManager: vi.fn().mockImplementation(() => ({
    createChat: vi.fn().mockResolvedValue('test-chat-id'),
    listChats: vi.fn().mockResolvedValue([
      { id: 'chat-1', name: 'Test Chat 1', createdAt: new Date() },
      { id: 'chat-2', name: 'Test Chat 2', createdAt: new Date() }
    ]),
    addMessage: vi.fn().mockResolvedValue(true),
    getHistory: vi.fn().mockResolvedValue([
      { id: 'msg-1', agentId: 'agent-1', content: 'Hello', timestamp: new Date() },
      { id: 'msg-2', agentId: 'agent-2', content: 'Hi there!', timestamp: new Date() }
    ]),
  })),
}));

describe('MCP Tools - UnifiedTool Interface Compliance', () => {
  const mcpTools = [
    new CreateChatTool(),
    new ListChatsTool(),
    new AddMessageTool(),
    new GetHistoryTool()
  ];

  describe('Interface Compliance', () => {
    it.each(mcpTools)(
      'should implement UnifiedTool interface: %s',
      (tool: UnifiedTool) => {
        // Required properties
        expect(typeof tool.name).toBe('string');
        expect(tool.name.length).toBeGreaterThan(0);
        
        expect(typeof tool.description).toBe('string');
        expect(tool.description.length).toBeGreaterThan(0);
        
        expect(tool.zodSchema).toBeDefined();
        expect(typeof tool.execute).toBe('function');
        
        // Optional properties
        if (tool.prompt) {
          expect(typeof tool.prompt.description).toBe('string');
          if (tool.prompt.arguments) {
            expect(Array.isArray(tool.prompt.arguments)).toBe(true);
          }
        }
        
        if (tool.category) {
          expect(['simple', 'gemini', 'utility']).toContain(tool.category);
        }
      }
    );

    it('should generate valid MCP tool definitions', () => {
      // Register our tools temporarily
      const originalRegistry = [...toolRegistry];
      toolRegistry.length = 0;
      toolRegistry.push(...mcpTools);
      
      const definitions = getToolDefinitions();
      
      expect(definitions).toHaveLength(mcpTools.length);
      
      definitions.forEach(def => {
        expect(typeof def.name).toBe('string');
        expect(typeof def.description).toBe('string');
        expect(def.inputSchema).toBeDefined();
        expect(def.inputSchema.type).toBe('object');
        expect(def.inputSchema.properties).toBeDefined();
        expect(Array.isArray(def.inputSchema.required)).toBe(true);
      });
      
      // Restore original registry
      toolRegistry.length = 0;
      toolRegistry.push(...originalRegistry);
    });
  });

  describe('Zod Schema Validation', () => {
    it('should validate create-chat tool arguments', async () => {
      const tool = new CreateChatTool();
      
      // Valid arguments
      const validArgs = {
        agentId: 'test-agent',
        chatName: 'Test Chat',
        isPrivate: false
      };
      
      const parsedArgs = tool.zodSchema.parse(validArgs);
      expect(parsedArgs).toEqual(validArgs);
      
      // Invalid arguments - missing required fields
      expect(() => {
        tool.zodSchema.parse({});
      }).toThrow();
      
      // Invalid arguments - wrong types
      expect(() => {
        tool.zodSchema.parse({
          agentId: 123, // should be string
          chatName: 'Test Chat'
        });
      }).toThrow();
    });

    it('should validate add-message tool arguments', async () => {
      const tool = new AddMessageTool();
      
      // Valid arguments
      const validArgs = {
        chatId: 'test-chat',
        agentId: 'test-agent',
        content: 'Hello, world!'
      };
      
      expect(() => tool.zodSchema.parse(validArgs)).not.toThrow();
      
      // Invalid - empty content
      expect(() => {
        tool.zodSchema.parse({
          chatId: 'test-chat',
          agentId: 'test-agent',
          content: ''
        });
      }).toThrow();
      
      // Invalid - content too long
      expect(() => {
        tool.zodSchema.parse({
          chatId: 'test-chat',
          agentId: 'test-agent',
          content: 'x'.repeat(10001) // Exceeds max length
        });
      }).toThrow();
    });

    it('should validate get-history tool arguments', async () => {
      const tool = new GetHistoryTool();
      
      // Valid arguments with optional parameters
      const validArgs = {
        chatId: 'test-chat',
        agentId: 'test-agent',
        limit: 50,
        offset: 0
      };
      
      expect(() => tool.zodSchema.parse(validArgs)).not.toThrow();
      
      // Valid - minimal arguments
      expect(() => {
        tool.zodSchema.parse({
          chatId: 'test-chat',
          agentId: 'test-agent'
        });
      }).not.toThrow();
      
      // Invalid - negative limit
      expect(() => {
        tool.zodSchema.parse({
          chatId: 'test-chat',
          agentId: 'test-agent',
          limit: -1
        });
      }).toThrow();
    });
  });
});

describe('MCP Tools - Integration with ChatManager', () => {
  let mockChatManager: any;

  beforeEach(() => {
    mockChatManager = {
      createChat: vi.fn().mockResolvedValue('new-chat-id'),
      listChats: vi.fn().mockResolvedValue([]),
      addMessage: vi.fn().mockResolvedValue(true),
      getHistory: vi.fn().mockResolvedValue([]),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CreateChatTool', () => {
    it('should create chat and return chat ID', async () => {
      const tool = new CreateChatTool();
      tool.setChatManager(mockChatManager);
      
      const result = await tool.execute({
        agentId: 'test-agent',
        chatName: 'New Chat'
      });
      
      expect(mockChatManager.createChat).toHaveBeenCalledWith(
        'test-agent',
        'New Chat',
        { isPrivate: false }
      );
      
      expect(result).toBe('new-chat-id');
    });

    it('should handle chat creation failures', async () => {
      const tool = new CreateChatTool();
      mockChatManager.createChat.mockRejectedValue(new Error('Database error'));
      tool.setChatManager(mockChatManager);
      
      await expect(
        tool.execute({
          agentId: 'test-agent',
          chatName: 'Failed Chat'
        })
      ).rejects.toThrow('Database error');
    });
  });

  describe('AddMessageTool', () => {
    it('should add message with progress notifications', async () => {
      const tool = new AddMessageTool();
      tool.setChatManager(mockChatManager);
      
      const onProgress = vi.fn();
      
      await tool.execute({
        chatId: 'test-chat',
        agentId: 'test-agent',
        content: 'Test message'
      }, onProgress);
      
      expect(mockChatManager.addMessage).toHaveBeenCalledWith(
        'test-chat',
        'test-agent',
        'Test message'
      );
      
      // Should send progress notifications
      expect(onProgress).toHaveBeenCalledWith(
        expect.stringContaining('Adding message to chat')
      );
    });

    it('should validate message length limits', async () => {
      const tool = new AddMessageTool();
      tool.setChatManager(mockChatManager);
      
      const longMessage = 'x'.repeat(10001); // Exceeds limit
      
      await expect(
        tool.execute({
          chatId: 'test-chat',
          agentId: 'test-agent',
          content: longMessage
        })
      ).rejects.toThrow();
    });
  });

  describe('GetHistoryTool', () => {
    it('should retrieve chat history with pagination', async () => {
      const mockHistory = [
        { id: 'msg-1', agentId: 'agent-1', content: 'Hello', timestamp: new Date() },
        { id: 'msg-2', agentId: 'agent-2', content: 'Hi!', timestamp: new Date() }
      ];
      
      mockChatManager.getHistory.mockResolvedValue(mockHistory);
      
      const tool = new GetHistoryTool();
      tool.setChatManager(mockChatManager);
      
      const result = await tool.execute({
        chatId: 'test-chat',
        agentId: 'test-agent',
        limit: 10,
        offset: 0
      });
      
      expect(mockChatManager.getHistory).toHaveBeenCalledWith(
        'test-chat',
        'test-agent',
        { limit: 10, offset: 0 }
      );
      
      expect(JSON.parse(result)).toEqual(mockHistory);
    });

    it('should handle large history with progress notifications', async () => {
      const largeHistory = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg-${i}`,
        agentId: 'agent-1',
        content: `Message ${i}`,
        timestamp: new Date()
      }));
      
      mockChatManager.getHistory.mockResolvedValue(largeHistory);
      
      const tool = new GetHistoryTool();
      tool.setChatManager(mockChatManager);
      
      const onProgress = vi.fn();
      
      await tool.execute({
        chatId: 'large-chat',
        agentId: 'test-agent',
        limit: 1000
      }, onProgress);
      
      // Should send progress notifications for large operations
      expect(onProgress).toHaveBeenCalledWith(
        expect.stringContaining('Retrieving chat history')
      );
    });
  });
});

describe('MCP Tools - Protocol Compliance', () => {
  beforeEach(() => {
    // Clear and register our tools
    toolRegistry.length = 0;
    toolRegistry.push(
      new CreateChatTool(),
      new ListChatsTool(),
      new AddMessageTool(),
      new GetHistoryTool()
    );
  });

  it('should execute tools through registry', async () => {
    const mockOnProgress = vi.fn();
    
    // Test create-chat tool
    const result = await executeTool('create-chat', {
      agentId: 'test-agent',
      chatName: 'Registry Test Chat'
    }, mockOnProgress);
    
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should handle invalid tool names', async () => {
    await expect(
      executeTool('nonexistent-tool', {})
    ).rejects.toThrow('Unknown tool: nonexistent-tool');
  });

  it('should validate arguments through registry', async () => {
    // Invalid arguments should be caught by Zod validation
    await expect(
      executeTool('create-chat', {
        // Missing required agentId
        chatName: 'Test Chat'
      })
    ).rejects.toThrow('Invalid arguments');
  });

  it('should support progress callbacks through registry', async () => {
    const onProgress = vi.fn();
    
    await executeTool('add-message', {
      chatId: 'test-chat',
      agentId: 'test-agent',
      content: 'Test message with progress'
    }, onProgress);
    
    expect(onProgress).toHaveBeenCalled();
  });
});

describe('MCP Tools - Error Handling', () => {
  it('should handle timeout scenarios gracefully', async () => {
    const tool = new GetHistoryTool();
    const mockChatManager = {
      getHistory: vi.fn().mockImplementation(() => 
        new Promise((resolve) => {
          // Simulate a slow operation that should timeout
          setTimeout(resolve, 60000); // 1 minute delay
        })
      )
    };
    
    tool.setChatManager(mockChatManager);
    
    // Should timeout and handle gracefully
    await expect(
      Promise.race([
        tool.execute({ chatId: 'slow-chat', agentId: 'test-agent' }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
      ])
    ).rejects.toThrow('Timeout');
  });

  it('should preserve error context in tool execution', async () => {
    const tool = new CreateChatTool();
    const mockChatManager = {
      createChat: vi.fn().mockRejectedValue(
        new Error('Database connection failed at line 42')
      )
    };
    
    tool.setChatManager(mockChatManager);
    
    try {
      await tool.execute({
        agentId: 'test-agent',
        chatName: 'Error Test Chat'
      });
    } catch (error) {
      expect(error.message).toContain('Database connection failed at line 42');
      expect(error.stack).toBeDefined();
    }
  });

  it('should handle malformed progress callbacks', async () => {
    const tool = new AddMessageTool();
    const mockChatManager = {
      addMessage: vi.fn().mockResolvedValue(true)
    };
    
    tool.setChatManager(mockChatManager);
    
    // Progress callback that throws should not break execution
    const badCallback = vi.fn().mockImplementation(() => {
      throw new Error('Progress callback failed');
    });
    
    await expect(
      tool.execute({
        chatId: 'test-chat',
        agentId: 'test-agent',
        content: 'Test message'
      }, badCallback)
    ).resolves.not.toThrow();
    
    expect(badCallback).toHaveBeenCalled();
  });
});