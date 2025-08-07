import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { executeGeminiCLI } from '../src/utils/geminiExecutor.js';

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

/**
 * CRITICAL BUG REPRODUCTION TEST
 * 
 * This test demonstrates that the ask-gemini tool does NOT preprocess @ syntax file references.
 * 
 * BUG: When users write "@filename.ts explain this", the literal string "@filename.ts" 
 * is passed to Gemini CLI instead of reading the file content and substituting it.
 * 
 * This test will PASS when the bug exists and FAIL when the bug is fixed.
 */
describe('GEMINI @ SYNTAX BUG - Critical Failing Test', () => {
  const mockSpawn = vi.mocked(spawn);
  
  let closeCallback: (code: number) => void = () => {};

  beforeEach(() => {
    vi.resetAllMocks();
    
    mockSpawn.mockReturnValue({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, cb: (code: number) => void) => {
        if (event === 'close') {
          closeCallback = cb;
        }
      }),
    } as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('CRITICAL BUG: @ syntax file references are NOT preprocessed - they are passed literally to Gemini CLI', async () => {
    // Set up test scenario
    const testPrompt = '@package.json explain this configuration';
    
    // Execute Gemini CLI call
    const promise = executeGeminiCLI(testPrompt);
    closeCallback(0); // Simulate successful completion
    await promise;
    
    // Extract the arguments passed to the spawned gemini command
    const spawnCall = mockSpawn.mock.calls[0];
    expect(spawnCall).toBeDefined();
    
    const [command, args] = spawnCall;
    expect(command).toBe('gemini');
    
    // Find the prompt argument
    const promptIndex = args.indexOf('-p') + 1;
    const actualPrompt = args[promptIndex];
    
    // Clean the prompt (remove Windows quoting if present)
    const cleanPrompt = actualPrompt.replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"').replace(/\\'/g, "'");
    
    // THE BUG: Literal @ syntax is passed to Gemini CLI without preprocessing
    console.log('🐛 ACTUAL PROMPT SENT TO GEMINI CLI:', cleanPrompt);
    console.log('🚨 BUG CONFIRMED: @ syntax was NOT preprocessed into file content');
    
    // This assertion proves the bug exists
    expect(cleanPrompt).toContain('@package.json');
    
    // Additional proof: No file system operations were attempted
    const { existsSync, readFileSync } = vi.mocked(await import('fs'));
    expect(existsSync).not.toHaveBeenCalled();
    expect(readFileSync).not.toHaveBeenCalled();
    
    console.log('✅ BUG REPRODUCTION SUCCESSFUL');
    console.log('   → @ syntax passed literally without file content substitution');
    console.log('   → No file reading operations were performed');
    console.log('   → This test will FAIL once the bug is fixed');
  });
});