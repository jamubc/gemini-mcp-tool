import { describe, it, afterEach, expect, vi } from 'vitest';
import { spawn } from 'child_process';
import { executeGeminiCLI } from '../src/utils/geminiExecutor.js';

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
});
