import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { executeGeminiCLI } from '../src/utils/geminiExecutor.js';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock('os', () => ({
  tmpdir: vi.fn(() => '/tmp'),
}));

describe('Gemini @ Syntax File Reference Bug Reproduction', () => {
  const mockSpawn = vi.mocked(spawn);
  
  let mockStdoutOn: ReturnType<typeof vi.fn>;
  let mockStderrOn: ReturnType<typeof vi.fn>;
  let closeCallback: (code: number) => void = () => {};
  let mockOn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();
    
    // Setup mock child process
    mockStdoutOn = vi.fn();
    mockStderrOn = vi.fn();
    mockOn = vi.fn((event: string, cb: (code: number) => void) => {
      if (event === 'close') {
        closeCallback = cb;
      }
    });
    
    mockSpawn.mockReturnValue({
      stdout: { on: mockStdoutOn },
      stderr: { on: mockStderrOn },
      on: mockOn,
    } as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('REPRODUCTION TEST: @ syntax file references are passed literally to Gemini CLI without preprocessing', async () => {
    // Create a test file content to simulate what should be read
    const testFilePath = 'src/test-file.ts';
    const testFileContent = 'export const TEST_CONSTANT = "Hello World";';
    
    // Mock fs.existsSync and fs.readFileSync to simulate file exists and has content
    const { existsSync, readFileSync } = vi.mocked(await import('fs'));
    existsSync.mockReturnValue(true);
    readFileSync.mockReturnValue(testFileContent);
    
    // Test prompt using @ syntax that should be preprocessed
    const promptWithAtSyntax = '@src/test-file.ts explain what this file does';
    
    // Execute the Gemini CLI call
    const promise = executeGeminiCLI(promptWithAtSyntax);
    
    // Simulate successful completion
    closeCallback(0);
    await promise;
    
    // Get the arguments passed to spawn to examine what was sent to Gemini CLI
    const spawnCall = mockSpawn.mock.calls[0];
    expect(spawnCall).toBeDefined();
    
    const [command, args] = spawnCall;
    expect(command).toBe('gemini');
    
    // Find the -p flag and get the prompt that was passed
    const promptFlagIndex = args.indexOf('-p');
    expect(promptFlagIndex).not.toBe(-1);
    
    const actualPromptSent = args[promptFlagIndex + 1];
    
    // BUG REPRODUCTION: This test expects the bug to exist
    // The @ syntax should NOT be preprocessed currently, so the literal string should be passed
    // This test should PASS when the bug exists, and FAIL when the bug is fixed
    
    // Extract the prompt from quotes if present (Windows quoting)
    const cleanPrompt = actualPromptSent.replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"').replace(/\\'/g, "'");
    
    console.log('🐛 BUG REPRODUCTION - Actual prompt sent to Gemini CLI:', cleanPrompt);
    console.log('🐛 BUG REPRODUCTION - Expected file content that should be substituted:', testFileContent);
    
    // THE BUG: @ syntax is passed literally without file content substitution
    expect(cleanPrompt).toContain('@src/test-file.ts');
    expect(cleanPrompt).not.toContain(testFileContent);
    
    // Additional validation: file reading should not have been attempted
    expect(existsSync).not.toHaveBeenCalledWith(testFilePath);
    expect(readFileSync).not.toHaveBeenCalledWith(testFilePath, 'utf8');
    
    console.log('✅ BUG SUCCESSFULLY REPRODUCED: @ syntax file references are not preprocessed');
    console.log('   - Literal @src/test-file.ts was passed to Gemini CLI');
    console.log('   - File content was NOT read and substituted');
    console.log('   - This test will FAIL once the bug is fixed');
  });

  it('EXPECTED BEHAVIOR TEST: @ syntax should be preprocessed to include file contents', async () => {
    // This test documents the expected behavior that should happen after the fix
    
    const testFilePath = 'src/test-file.ts';
    const testFileContent = 'export const TEST_CONSTANT = "Hello World";';
    
    // Mock file system
    const { existsSync, readFileSync } = vi.mocked(await import('fs'));
    existsSync.mockReturnValue(true);
    readFileSync.mockReturnValue(testFileContent);
    
    const promptWithAtSyntax = '@src/test-file.ts explain what this file does';
    
    const promise = executeGeminiCLI(promptWithAtSyntax);
    closeCallback(0);
    await promise;
    
    const spawnCall = mockSpawn.mock.calls[0];
    const [, args] = spawnCall;
    
    const promptFlagIndex = args.indexOf('-p');
    const actualPromptSent = args[promptFlagIndex + 1];
    const cleanPrompt = actualPromptSent.replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"').replace(/\\'/g, "'");
    
    console.log('🎯 EXPECTED BEHAVIOR - What should happen after fix:');
    console.log('   - File content should be read and substituted');
    console.log('   - @ syntax should be replaced with actual file contents');
    
    // THIS TEST WILL FAIL UNTIL THE BUG IS FIXED
    // When fixed, the prompt should contain the file content, not the @ reference
    
    // Skip this test for now since it's documenting future expected behavior
    expect.soft(cleanPrompt).toContain(testFileContent);
    expect.soft(cleanPrompt).not.toContain('@src/test-file.ts');
    expect.soft(existsSync).toHaveBeenCalledWith(testFilePath);
    expect.soft(readFileSync).toHaveBeenCalledWith(testFilePath, 'utf8');
  });

  it('EDGE CASE TEST: multiple @ references in single prompt', async () => {
    const testFile1 = 'src/file1.ts';
    const testFile2 = 'src/file2.ts';
    const testContent1 = 'export const A = 1;';
    const testContent2 = 'export const B = 2;';
    
    const { existsSync, readFileSync } = vi.mocked(await import('fs'));
    existsSync.mockReturnValue(true);
    readFileSync.mockImplementation((path: string) => {
      if (path === testFile1) return testContent1;
      if (path === testFile2) return testContent2;
      return '';
    });
    
    const promptWithMultipleRefs = 'Compare @src/file1.ts and @src/file2.ts for differences';
    
    const promise = executeGeminiCLI(promptWithMultipleRefs);
    closeCallback(0);
    await promise;
    
    const spawnCall = mockSpawn.mock.calls[0];
    const [, args] = spawnCall;
    
    const promptFlagIndex = args.indexOf('-p');
    const actualPromptSent = args[promptFlagIndex + 1];
    const cleanPrompt = actualPromptSent.replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"').replace(/\\'/g, "'");
    
    console.log('🐛 MULTIPLE @ REFERENCES BUG - Actual prompt:', cleanPrompt);
    
    // BUG: Both @ references should be passed literally (not preprocessed)
    expect(cleanPrompt).toContain('@src/file1.ts');
    expect(cleanPrompt).toContain('@src/file2.ts');
    expect(cleanPrompt).not.toContain(testContent1);
    expect(cleanPrompt).not.toContain(testContent2);
    
    console.log('✅ MULTIPLE @ REFERENCES BUG REPRODUCED');
  });

  it('EDGE CASE TEST: @ reference to non-existent file', async () => {
    const nonExistentFile = 'src/does-not-exist.ts';
    
    const { existsSync } = vi.mocked(await import('fs'));
    existsSync.mockReturnValue(false);
    
    const promptWithBadRef = '@src/does-not-exist.ts explain this file';
    
    const promise = executeGeminiCLI(promptWithBadRef);
    closeCallback(0);
    await promise;
    
    const spawnCall = mockSpawn.mock.calls[0];
    const [, args] = spawnCall;
    
    const promptFlagIndex = args.indexOf('-p');
    const actualPromptSent = args[promptFlagIndex + 1];
    const cleanPrompt = actualPromptSent.replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"').replace(/\\'/g, "'");
    
    console.log('🐛 NON-EXISTENT FILE BUG - Actual prompt:', cleanPrompt);
    
    // BUG: @ reference to non-existent file is passed literally
    expect(cleanPrompt).toContain('@src/does-not-exist.ts');
    
    // File existence should not have been checked (since no preprocessing happens)
    expect(existsSync).not.toHaveBeenCalled();
    
    console.log('✅ NON-EXISTENT FILE BUG REPRODUCED');
  });
});