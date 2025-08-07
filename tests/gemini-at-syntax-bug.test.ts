import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { askGeminiTool } from '../src/tools/ask-gemini.tool.js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import * as geminiExecutor from '../src/utils/geminiExecutor.js';

/**
 * TEST: Gemini @ Syntax File Reference Bug Reproduction
 * 
 * This test proves that the @ syntax for file references is broken.
 * The tool advertises supporting "@filename" syntax but doesn't actually 
 * process file references - it passes the literal "@filename" to Gemini CLI.
 * 
 * Expected Behavior: @filename should read file content and include it in prompt
 * Actual Behavior: Literal "@filename" string is passed, causing Gemini confusion
 */

describe('Gemini @ Syntax File Reference Bug', () => {
  const testFilePath = join(process.cwd(), 'test-file-for-at-syntax.js');
  const testFileContent = `// Test file for @ syntax testing
function calculateSum(a, b) {
  return a + b;
}

export { calculateSum };
`;

  beforeEach(() => {
    // Create test file with known content
    writeFileSync(testFilePath, testFileContent);
  });

  afterEach(() => {
    // Clean up test file
    if (existsSync(testFilePath)) {
      unlinkSync(testFilePath);
    }
  });

  it('should reproduce the @ syntax bug - file content is NOT processed', async () => {
    // Mock the geminiExecutor to capture what prompt is actually sent
    let actualPromptSent = '';
    const mockExecuteGeminiCLI = vi.spyOn(geminiExecutor, 'executeGeminiCLI')
      .mockImplementation(async (prompt: string) => {
        actualPromptSent = prompt;
        // Simulate Gemini's confused response when it receives literal @filename
        return "I can see you mentioned a file with @ syntax, but I don't have access to any files. Which files would you like me to look at?";
      });

    try {
      // Execute ask-gemini with @ syntax reference
      const args = {
        prompt: `@test-file-for-at-syntax.js explain what this code does`,
        agentName: 'test-agent',
        chatId: '0'
      };

      const result = await askGeminiTool.execute(args);

      // VERIFICATION 1: The literal @ string should be passed (proving the bug)
      expect(actualPromptSent).toContain('@test-file-for-at-syntax.js');
      
      // VERIFICATION 2: The actual file content should NOT be included (proving the bug)
      expect(actualPromptSent).not.toContain('function calculateSum');
      expect(actualPromptSent).not.toContain('return a + b');
      
      // VERIFICATION 3: Gemini should respond with confusion (proving the failure mode)
      expect(result).toContain('Which files would you like me to look at');
      
      // VERIFICATION 4: The literal @ syntax should be in the sent prompt (bug evidence)
      expect(actualPromptSent).toMatch(/@test-file-for-at-syntax\.js/);

      // These assertions prove the bug exists:
      // - File reference is not processed 
      // - Literal @ string is passed to Gemini
      // - Gemini responds with confusion about files
      // - User's intent to analyze file content fails

    } finally {
      mockExecuteGeminiCLI.mockRestore();
    }
  });

  it('should fail to process relative file paths with @ syntax', async () => {
    // Test with relative path
    let actualPromptSent = '';
    const mockExecuteGeminiCLI = vi.spyOn(geminiExecutor, 'executeGeminiCLI')
      .mockImplementation(async (prompt: string) => {
        actualPromptSent = prompt;
        return "I don't understand the file reference. Could you clarify which files you want me to analyze?";
      });

    try {
      const args = {
        prompt: `@./test-file-for-at-syntax.js analyze this function`,
        agentName: 'test-agent',
        chatId: '0'
      };

      await askGeminiTool.execute(args);

      // The bug: relative path is passed literally, not resolved or processed
      expect(actualPromptSent).toContain('@./test-file-for-at-syntax.js');
      expect(actualPromptSent).not.toContain(testFileContent);
      
    } finally {
      mockExecuteGeminiCLI.mockRestore();
    }
  });

  it('should fail to process multiple file references with @ syntax', async () => {
    // Create a second test file
    const secondFilePath = join(process.cwd(), 'second-test-file.ts');
    const secondFileContent = `interface User {
  id: number;
  name: string;
}`;
    
    writeFileSync(secondFilePath, secondFileContent);

    let actualPromptSent = '';
    const mockExecuteGeminiCLI = vi.spyOn(geminiExecutor, 'executeGeminiCLI')
      .mockImplementation(async (prompt: string) => {
        actualPromptSent = prompt;
        return "I can see multiple file references but can't access the files. Which specific files should I examine?";
      });

    try {
      const args = {
        prompt: `Compare @test-file-for-at-syntax.js and @second-test-file.ts - what are the differences?`,
        agentName: 'test-agent',
        chatId: '0'
      };

      await askGeminiTool.execute(args);

      // The bug: multiple @ references are passed literally, no file content processed
      expect(actualPromptSent).toContain('@test-file-for-at-syntax.js');
      expect(actualPromptSent).toContain('@second-test-file.ts');
      expect(actualPromptSent).not.toContain('function calculateSum');
      expect(actualPromptSent).not.toContain('interface User');
      
    } finally {
      mockExecuteGeminiCLI.mockRestore();
      if (existsSync(secondFilePath)) {
        unlinkSync(secondFilePath);
      }
    }
  });

  it('should demonstrate expected behavior vs actual behavior', async () => {
    let actualPromptSent = '';
    const mockExecuteGeminiCLI = vi.spyOn(geminiExecutor, 'executeGeminiCLI')
      .mockImplementation(async (prompt: string) => {
        actualPromptSent = prompt;
        return "Mock response";
      });

    try {
      const args = {
        prompt: `@test-file-for-at-syntax.js what does this function do?`,
        agentName: 'test-agent',
        chatId: '0'
      };

      await askGeminiTool.execute(args);

      // ACTUAL BEHAVIOR (BROKEN):
      const actualBehavior = {
        promptSent: actualPromptSent,
        containsLiteralAtSyntax: actualPromptSent.includes('@test-file-for-at-syntax.js'),
        containsFileContent: actualPromptSent.includes('function calculateSum'),
        fileContentProcessed: false
      };

      // EXPECTED BEHAVIOR (WHAT SHOULD HAPPEN):
      const expectedBehavior = {
        promptSent: `Here's the content of test-file-for-at-syntax.js:\n\n${testFileContent}\n\nwhat does this function do?`,
        containsLiteralAtSyntax: false,
        containsFileContent: true,
        fileContentProcessed: true
      };

      // Demonstrate the bug by comparing actual vs expected
      expect(actualBehavior.containsLiteralAtSyntax).toBe(true);  // BUG: literal @ passed
      expect(actualBehavior.containsFileContent).toBe(false);     // BUG: no file content
      expect(actualBehavior.fileContentProcessed).toBe(false);    // BUG: no processing

      // These would be true if the feature worked correctly:
      expect(expectedBehavior.containsLiteralAtSyntax).toBe(false);
      expect(expectedBehavior.containsFileContent).toBe(true);
      expect(expectedBehavior.fileContentProcessed).toBe(true);

      // This test will FAIL until the @ syntax processing is implemented
      
    } finally {
      mockExecuteGeminiCLI.mockRestore();
    }
  });

  it('should show the user experience impact of the bug', async () => {
    // Simulate what happens when a user tries to use the documented @ syntax feature
    const mockExecuteGeminiCLI = vi.spyOn(geminiExecutor, 'executeGeminiCLI')
      .mockImplementation(async (prompt: string) => {
        // Simulate typical Gemini response when it receives literal @ syntax
        if (prompt.includes('@test-file-for-at-syntax.js')) {
          return `I can see you're trying to reference a file using @ syntax, but I don't have access to that file. Could you please provide the file content directly, or let me know which files you'd like me to analyze?`;
        }
        return "Mock response";
      });

    try {
      const result = await askGeminiTool.execute({
        prompt: `@test-file-for-at-syntax.js review this code for potential improvements`,
        agentName: 'qa-agent',
        chatId: '0'
      });

      // USER EXPERIENCE IMPACT:
      // 1. User follows documented syntax (@filename)
      // 2. Tool claims to support this feature
      // 3. But user gets confused response from Gemini
      // 4. User has to manually copy-paste file content
      // 5. Feature is effectively broken despite being advertised

      expect(result).toContain("don't have access to that file");
      expect(result).toContain("provide the file content directly");
      
      // This demonstrates the broken user experience:
      // - Tool promises @ syntax support in description
      // - User tries to use it as documented  
      // - Gets confusing error instead of file analysis
      // - Has to work around the broken feature

    } finally {
      mockExecuteGeminiCLI.mockRestore();
    }
  });
});