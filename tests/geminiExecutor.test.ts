import { describe, it, afterEach, expect, vi } from 'vitest';
import { spawn } from 'child_process';
import { executeGeminiCLI, processChangeModeOutput } from '../src/utils/geminiExecutor.js';
import { ERROR_MESSAGES } from '../src/constants.js';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

vi.mock('os', () => ({
  tmpdir: vi.fn(() => '/tmp'),
}));

describe('executeGeminiCLI', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('quotes prompt on win32 to avoid shell parsing issues', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const mockStdoutOn = vi.fn();
    const mockStderrOn = vi.fn();
    let closeCallback: (code: number) => void = () => {};
    const mockOn = vi.fn((event: string, cb: (code: number) => void) => {
      if (event === 'close') {
        closeCallback = cb;
      }
    });
    (spawn as unknown as vi.Mock).mockReturnValue({
      stdout: { on: mockStdoutOn },
      stderr: { on: mockStderrOn },
      on: mockOn,
    });

    const prompt = "Perfect! I've implemented your recommendations: fixed bug";
    const promise = executeGeminiCLI(prompt);
    closeCallback(0);
    await promise;

    const args = (spawn as unknown as vi.Mock).mock.calls[0][1] as string[];
    const promptArgIndex = args.indexOf('-p') + 1;
    expect(args[promptArgIndex]).toBe(`"${prompt.replace(/"/g, '\\"').replace(/'/g, "\\'")}"`);  
  });

  it('handles special characters and newlines in prompt on win32', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const mockStdoutOn = vi.fn();
    const mockStderrOn = vi.fn();
    let closeCallback: (code: number) => void = () => {};
    const mockOn = vi.fn((event: string, cb: (code: number) => void) => {
      if (event === 'close') {
        closeCallback = cb;
      }
    });
    (spawn as unknown as vi.Mock).mockReturnValue({
      stdout: { on: mockStdoutOn },
      stderr: { on: mockStderrOn },
      on: mockOn,
    });

    const prompt = `Fix the tests:\n- ensure success_rate() returns 100% (issue #42)\n- handle user's input correctly (don't crash)`;
    const promise = executeGeminiCLI(prompt);
    closeCallback(0);
    await promise;

    const args = (spawn as unknown as vi.Mock).mock.calls[0][1] as string[];
    const promptArgIndex = args.indexOf('-p') + 1;
    expect(args[promptArgIndex]).toBe(`"${prompt.replace(/"/g, '\\"').replace(/'/g, "\\'")}"`);  
  });

  it('handles embedded quotes in prompt on win32', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const mockStdoutOn = vi.fn();
    const mockStderrOn = vi.fn();
    let closeCallback: (code: number) => void = () => {};
    const mockOn = vi.fn((event: string, cb: (code: number) => void) => {
      if (event === 'close') {
        closeCallback = cb;
      }
    });
    (spawn as unknown as vi.Mock).mockReturnValue({
      stdout: { on: mockStdoutOn },
      stderr: { on: mockStderrOn },
      on: mockOn,
    });

    const prompt = 'He said "Hello World!"';
    const promise = executeGeminiCLI(prompt);
    closeCallback(0);
    await promise;

    const args = (spawn as unknown as vi.Mock).mock.calls[0][1] as string[];
    const promptArgIndex = args.indexOf('-p') + 1;
    expect(args[promptArgIndex]).toBe(`"${prompt.replace(/"/g, '\\"').replace(/'/g, "\\'")}"`);  
  });

  describe('Command line length handling', () => {
    it('should use temp file for very long prompts on Windows', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const mockStdoutOn = vi.fn();
      const mockStderrOn = vi.fn();
      let closeCallback: (code: number) => void = () => {};
      const mockOn = vi.fn((event: string, cb: (code: number) => void) => {
        if (event === 'close') {
          closeCallback = cb;
        }
      });
      (spawn as unknown as vi.Mock).mockReturnValue({
        stdout: { on: mockStdoutOn },
        stderr: { on: mockStderrOn },
        on: mockOn,
      });

      // Create a very long prompt that would exceed Windows command line limit
      const longPrompt = 'A'.repeat(9000); // Much longer than typical 8191 char limit
      const promise = executeGeminiCLI(longPrompt);
      closeCallback(0);
      await promise;

      // This test should FAIL initially because temp file logic doesn't exist yet
      const args = (spawn as unknown as vi.Mock).mock.calls[0][1] as string[];
      const promptArgIndex = args.indexOf('-p') + 1;
      expect(args[promptArgIndex]).toMatch(/^@.*\.txt$/); // Should be @filepath format
    });

    it('should clean up temp file after successful execution', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const mockStdoutOn = vi.fn();
      const mockStderrOn = vi.fn();
      let closeCallback: (code: number) => void = () => {};
      const mockOn = vi.fn((event: string, cb: (code: number) => void) => {
        if (event === 'close') {
          closeCallback = cb;
        }
      });
      (spawn as unknown as vi.Mock).mockReturnValue({
        stdout: { on: mockStdoutOn },
        stderr: { on: mockStderrOn },
        on: mockOn,
      });

      const longPrompt = 'A'.repeat(9000);
      const promise = executeGeminiCLI(longPrompt);
      closeCallback(0); // Successful execution
      await promise;

      // Verify temp file cleanup was called with random filename
      const { unlinkSync } = vi.mocked(await import('fs'));
      expect(unlinkSync).toHaveBeenCalledTimes(1);
      const unlinkCall = unlinkSync.mock.calls[0][0];
      expect(unlinkCall).toMatch(/\\tmp\\gemini-prompt-[a-f0-9]{16}\.txt$/);
    });
  });
});

// processChangeModeOutput function has been removed
