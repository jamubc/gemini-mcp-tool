import { describe, it, afterEach, expect, vi } from 'vitest';
import { spawn } from 'child_process';
import { executeGeminiCLI, processChangeModeOutput } from '../src/utils/geminiExecutor.js';
import { ERROR_MESSAGES } from '../src/constants.js';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
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
    expect(args[promptArgIndex]).toBe(`"${prompt.replace(/"/g, '""')}"`);
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
    expect(args[promptArgIndex]).toBe(`"${prompt.replace(/"/g, '""')}"`);
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
    expect(args[promptArgIndex]).toBe(`"${prompt.replace(/"/g, '""')}"`);
  });
});

describe('processChangeModeOutput', () => {
  it('returns raw result when no edits are found', async () => {
    const raw = 'unexpected output';
    const result = await processChangeModeOutput(raw);
    expect(result).toBe(
      `${ERROR_MESSAGES.CHANGE_MODE_NO_EDITS}\n\n${raw}`
    );
  });
});
