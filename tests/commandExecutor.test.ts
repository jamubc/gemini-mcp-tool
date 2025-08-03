import { describe, it, afterEach, expect, vi } from 'vitest';
import { spawn } from 'child_process';
import { executeCommand } from '../src/utils/commandExecutor.js';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

describe('executeCommand', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('sets shell true on win32', async () => {
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

    const promise = executeCommand('echo', ['test']);
    closeCallback(0);
    await promise;

    expect(spawn).toHaveBeenCalledWith(
      'echo',
      ['test'],
      expect.objectContaining({ shell: true })
    );
  });

  it('streams stdout incrementally via onProgress', async () => {
    const mockStdoutOn = vi.fn();
    const mockStderrOn = vi.fn();
    let stdoutCallback: (data: Buffer) => void = () => {};
    mockStdoutOn.mockImplementation((event: string, cb: (data: Buffer) => void) => {
      if (event === 'data') {
        stdoutCallback = cb;
      }
    });
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

    const onProgress = vi.fn();
    const promise = executeCommand('echo', [], onProgress);
    stdoutCallback(Buffer.from('hel'));
    stdoutCallback(Buffer.from('lo'));
    closeCallback(0);
    const result = await promise;

    expect(onProgress.mock.calls).toEqual([["hel"], ["lo"]]);
    expect(result).toBe('hello');
  });

  it('rejects when process exits with non-zero code', async () => {
    const mockStdoutOn = vi.fn();
    const mockStderrOn = vi.fn();
    let stderrCallback: (data: Buffer) => void = () => {};
    mockStderrOn.mockImplementation((event: string, cb: (data: Buffer) => void) => {
      if (event === 'data') {
        stderrCallback = cb;
      }
    });
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

    const promise = executeCommand('echo', []);
    stderrCallback(Buffer.from('boom'));
    closeCallback(1);

    await expect(promise).rejects.toThrow(
      'Command failed with exit code 1: boom'
    );
  });
});
