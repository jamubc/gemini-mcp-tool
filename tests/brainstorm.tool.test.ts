import { describe, it, afterEach, expect, vi, beforeEach } from 'vitest';
import { brainstormTool } from '../src/tools/brainstorm.tool.js';
import { executeTool } from '../src/tools/registry.js';
import * as geminiExecutor from '../src/utils/geminiExecutor.js';

// Import tools index to ensure registry is populated
import '../src/tools/index.js';

// Mock the executeGeminiCLI function to control its behavior during tests
vi.mock('../src/utils/geminiExecutor.js', () => ({
  executeGeminiCLI: vi.fn(),
}));

// Mock the logger to avoid console noise during tests
vi.mock('../src/utils/logger.js', () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('brainstorm.tool - Comprehensive Functionality Tests', () => {
  let mockExecuteGeminiCLI: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    // Reset mocks and get fresh references
    vi.resetAllMocks();
    mockExecuteGeminiCLI = vi.mocked(geminiExecutor).executeGeminiCLI;
    
    // Default mock implementation
    mockExecuteGeminiCLI.mockResolvedValue('Generated brainstorming ideas...');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Schema Validation - Positive Tests', () => {
    it('should validate and trim prompt properly', () => {
      // Test that Zod schema now handles trimming and validation
      const validArgs = brainstormTool.zodSchema.parse({ prompt: '  valid prompt  ' });
      expect(validArgs.prompt).toBe('valid prompt'); // Trimmed by Zod
    });

    it('should reject empty or whitespace-only prompts', () => {
      // Zod schema with .trim().min(1) should reject these
      expect(() => brainstormTool.zodSchema.parse({ prompt: '' })).toThrow();
      expect(() => brainstormTool.zodSchema.parse({ prompt: '   ' })).toThrow();
      expect(() => brainstormTool.zodSchema.parse({ prompt: '\t\n' })).toThrow();
    });

    it('should apply default values correctly', () => {
      const validArgs = brainstormTool.zodSchema.parse({ prompt: 'test prompt' });
      expect(validArgs.methodology).toBe('auto');
      expect(validArgs.ideaCount).toBe(12);
      expect(validArgs.includeAnalysis).toBe(true);
    });

    it('should validate all methodology types', () => {
      const methodologies = ['divergent', 'convergent', 'scamper', 'design-thinking', 'lateral', 'auto'];
      methodologies.forEach(methodology => {
        expect(() => brainstormTool.zodSchema.parse({ 
          prompt: 'test', 
          methodology 
        })).not.toThrow();
      });
    });

    it('should enforce ideaCount boundaries', () => {
      // Should work within valid range
      expect(() => brainstormTool.zodSchema.parse({ 
        prompt: 'test', 
        ideaCount: 1 
      })).not.toThrow();
      
      expect(() => brainstormTool.zodSchema.parse({ 
        prompt: 'test', 
        ideaCount: 50 
      })).not.toThrow();
      
      // Should reject invalid values
      expect(() => brainstormTool.zodSchema.parse({ 
        prompt: 'test', 
        ideaCount: 0 
      })).toThrow();
      
      expect(() => brainstormTool.zodSchema.parse({ 
        prompt: 'test', 
        ideaCount: 51 
      })).toThrow();
    });
  });

  describe('Core Functionality Tests', () => {
    it('should execute successfully with minimal arguments', async () => {
      // Use Zod validation for consistent testing
      const validatedArgs = brainstormTool.zodSchema.parse({ prompt: 'solve customer retention' });
      const result = await brainstormTool.execute(validatedArgs);
      
      expect(mockExecuteGeminiCLI).toHaveBeenCalledOnce();
      expect(result).toBe('Generated brainstorming ideas...');
      
      const [promptUsed] = mockExecuteGeminiCLI.mock.calls[0];
      expect(promptUsed).toContain('solve customer retention');
      expect(promptUsed).toContain('# BRAINSTORMING SESSION');
    });

    it('should handle all methodology types correctly', async () => {
      const methodologies = ['divergent', 'convergent', 'scamper', 'design-thinking', 'lateral', 'auto'];
      
      for (const methodology of methodologies) {
        vi.resetAllMocks();
        mockExecuteGeminiCLI.mockResolvedValue(`Ideas for ${methodology}...`);
        
        const validatedArgs = brainstormTool.zodSchema.parse({ 
          prompt: 'test prompt', 
          methodology: methodology as any
        });
        const result = await brainstormTool.execute(validatedArgs);
        
        expect(result).toBe(`Ideas for ${methodology}...`);
        const [promptUsed] = mockExecuteGeminiCLI.mock.calls[0];
        // Check that the methodology framework is included (more specific than just methodology name)
        if (methodology === 'divergent') {
          expect(promptUsed).toContain('Divergent Thinking Approach');
        } else if (methodology === 'design-thinking') {
          expect(promptUsed).toContain('Human-Centered Design Thinking');
        }
      }
    });

    it('should include domain context when provided', async () => {
      const validatedArgs = brainstormTool.zodSchema.parse({ 
        prompt: 'improve user experience',
        domain: 'software'
      });
      await brainstormTool.execute(validatedArgs);
      
      const [promptUsed] = mockExecuteGeminiCLI.mock.calls[0];
      expect(promptUsed).toContain('**Domain Focus:** software');
      expect(promptUsed).toContain('domain-specific knowledge');
    });

    it('should include constraints when provided', async () => {
      const validatedArgs = brainstormTool.zodSchema.parse({ 
        prompt: 'reduce costs',
        constraints: 'Limited budget of $10,000'
      });
      await brainstormTool.execute(validatedArgs);
      
      const [promptUsed] = mockExecuteGeminiCLI.mock.calls[0];
      expect(promptUsed).toContain('**Constraints & Boundaries:** Limited budget of $10,000');
    });

    it('should include existing context when provided', async () => {
      const validatedArgs = brainstormTool.zodSchema.parse({ 
        prompt: 'improve sales',
        existingContext: 'Previous campaigns showed 15% conversion rate'
      });
      await brainstormTool.execute(validatedArgs);
      
      const [promptUsed] = mockExecuteGeminiCLI.mock.calls[0];
      expect(promptUsed).toContain('**Background Context:** Previous campaigns showed 15% conversion rate');
    });

    it('should respect ideaCount parameter', async () => {
      const validatedArgs = brainstormTool.zodSchema.parse({ 
        prompt: 'test',
        ideaCount: 25
      });
      await brainstormTool.execute(validatedArgs);
      
      const [promptUsed] = mockExecuteGeminiCLI.mock.calls[0];
      expect(promptUsed).toContain('Generate 25 distinct, creative ideas');
    });

    it('should include analysis framework when includeAnalysis is true', async () => {
      const validatedArgs = brainstormTool.zodSchema.parse({ 
        prompt: 'test',
        includeAnalysis: true
      });
      await brainstormTool.execute(validatedArgs);
      
      const [promptUsed] = mockExecuteGeminiCLI.mock.calls[0];
      expect(promptUsed).toContain('## Analysis Framework');
      expect(promptUsed).toContain('**Feasibility:** Implementation difficulty');
    });

    it('should exclude analysis framework when includeAnalysis is false', async () => {
      const validatedArgs = brainstormTool.zodSchema.parse({ 
        prompt: 'test',
        includeAnalysis: false
      });
      await brainstormTool.execute(validatedArgs);
      
      const [promptUsed] = mockExecuteGeminiCLI.mock.calls[0];
      expect(promptUsed).not.toContain('## Analysis Framework');
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle quota exceeded errors gracefully', async () => {
      mockExecuteGeminiCLI.mockRejectedValue(new Error('quota exceeded for Gemini'));
      
      const validatedArgs = brainstormTool.zodSchema.parse({ prompt: 'test' });
      const result = await brainstormTool.execute(validatedArgs);
      
      expect(result).toContain('❌');
      expect(result).toContain('quota exceeded');
      expect(result).toContain('gemini-2.5-flash');
    });

    it('should handle timeout errors gracefully', async () => {
      mockExecuteGeminiCLI.mockRejectedValue(new Error('timeout exceeded'));
      
      const validatedArgs = brainstormTool.zodSchema.parse({ 
        prompt: 'test',
        ideaCount: 30
      });
      const result = await brainstormTool.execute(validatedArgs);
      
      expect(result).toContain('❌');
      expect(result).toContain('timed out');
      expect(result).toContain('30'); // Shows current ideaCount for user reference
    });

    it('should handle generic errors gracefully', async () => {
      mockExecuteGeminiCLI.mockRejectedValue(new Error('network connection failed'));
      
      const validatedArgs = brainstormTool.zodSchema.parse({ prompt: 'test' });
      const result = await brainstormTool.execute(validatedArgs);
      
      expect(result).toContain('❌');
      expect(result).toContain('network connection failed');
    });

    it('should handle non-Error exceptions', async () => {
      mockExecuteGeminiCLI.mockRejectedValue('string error');
      
      const validatedArgs = brainstormTool.zodSchema.parse({ prompt: 'test' });
      const result = await brainstormTool.execute(validatedArgs);
      
      expect(result).toContain('❌');
      expect(result).toContain('unexpected error');
    });
  });

  describe('Progress Reporting Tests', () => {
    it('should call progress callback with methodology info', async () => {
      const mockProgress = vi.fn();
      
      const validatedArgs = brainstormTool.zodSchema.parse({ 
        prompt: 'test',
        methodology: 'design-thinking',
        ideaCount: 15
      });
      await brainstormTool.execute(validatedArgs, mockProgress);
      
      expect(mockProgress).toHaveBeenCalledWith('🧠 Generating 15 ideas via design-thinking methodology...');
    });

    it('should continue execution if progress callback fails', async () => {
      const mockProgress = vi.fn().mockImplementation(() => {
        throw new Error('Progress callback error');
      });
      
      // Should not throw despite progress callback failure
      const validatedArgs = brainstormTool.zodSchema.parse({ prompt: 'test' });
      const result = await brainstormTool.execute(validatedArgs, mockProgress);
      expect(result).toBe('Generated brainstorming ideas...');
    });

    it('should pass progress callback to executeGeminiCLI', async () => {
      const mockProgress = vi.fn();
      
      const validatedArgs = brainstormTool.zodSchema.parse({ prompt: 'test' });
      await brainstormTool.execute(validatedArgs, mockProgress);
      
      const [, , , progressCallback] = mockExecuteGeminiCLI.mock.calls[0];
      expect(typeof progressCallback).toBe('function');
      
      // Test the wrapped progress callback
      progressCallback('Test progress message');
      expect(mockProgress).toHaveBeenCalledWith('Test progress message');
    });
  });

  describe('Tool Registry Integration Tests', () => {
    it('should work correctly through unified tool registry', async () => {
      const result = await executeTool('brainstorm', { prompt: 'solve customer retention' });
      
      expect(mockExecuteGeminiCLI).toHaveBeenCalledOnce();
      expect(result).toBe('Generated brainstorming ideas...');
    });

    it('should validate arguments through registry', async () => {
      // Should reject invalid arguments through registry
      await expect(executeTool('brainstorm', { prompt: '' })).rejects.toThrow();
    });
  });

  describe('Model Selection Tests', () => {
    it('should pass model parameter to executeGeminiCLI', async () => {
      const validatedArgs = brainstormTool.zodSchema.parse({ 
        prompt: 'test',
        model: 'gemini-2.5-flash'
      });
      await brainstormTool.execute(validatedArgs);
      
      const [, model] = mockExecuteGeminiCLI.mock.calls[0];
      expect(model).toBe('gemini-2.5-flash');
    });

    it('should pass undefined model when not specified', async () => {
      const validatedArgs = brainstormTool.zodSchema.parse({ prompt: 'test' });
      await brainstormTool.execute(validatedArgs);
      
      const [, model] = mockExecuteGeminiCLI.mock.calls[0];
      expect(model).toBeUndefined();
    });
  });

  describe('Comprehensive Parameter Integration Tests', () => {
    it('should generate comprehensive prompt with all parameters', async () => {
      const args = {
        prompt: 'solve customer retention problems',
        methodology: 'design-thinking' as const,
        domain: 'business',
        constraints: 'Limited budget of $50,000',
        existingContext: 'Previous surveys show 70% churn due to price sensitivity',
        ideaCount: 20,
        includeAnalysis: true,
        model: 'gemini-2.5-flash'
      };
      
      const validatedArgs = brainstormTool.zodSchema.parse(args);
      await brainstormTool.execute(validatedArgs);
      
      const [promptUsed, model] = mockExecuteGeminiCLI.mock.calls[0];
      
      // Verify all components are included
      expect(promptUsed).toContain('solve customer retention problems');
      expect(promptUsed).toContain('Human-Centered Design Thinking');
      expect(promptUsed).toContain('**Domain Focus:** business');
      expect(promptUsed).toContain('**Constraints & Boundaries:** Limited budget of $50,000');
      expect(promptUsed).toContain('**Background Context:** Previous surveys show 70% churn');
      expect(promptUsed).toContain('Generate 20 distinct, creative ideas');
      expect(promptUsed).toContain('## Analysis Framework');
      expect(model).toBe('gemini-2.5-flash');
    });

    it('should work with minimal parameters', async () => {
      const validatedArgs = brainstormTool.zodSchema.parse({ prompt: 'simple test' });
      await brainstormTool.execute(validatedArgs);
      
      const [promptUsed] = mockExecuteGeminiCLI.mock.calls[0];
      expect(promptUsed).toContain('simple test');
      expect(promptUsed).toContain('Generate 12 distinct, creative ideas'); // default
      expect(promptUsed).toContain('AI-Optimized Approach'); // default methodology
    });
  });
});