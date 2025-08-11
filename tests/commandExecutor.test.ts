import { describe, it, afterEach, expect, vi } from 'vitest';
import { spawn } from 'child_process';
import { executeCommand } from '../src/utils/commandExecutor.js';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

describe('executeCommand', () => {
  const originalPlatform = process.platform;

  const setupSpawnMock = () => {
    const callbacks = {
      stdout: (data: Buffer) => {},
      stderr: (data: Buffer) => {},
      close: (code: number) => {},
    };

    const mockStdoutOn = vi.fn(
      (event: string, cb: (data: Buffer) => void) => {
        if (event === 'data') {
          callbacks.stdout = cb;
        }
      },
    );
    const mockStderrOn = vi.fn(
      (event: string, cb: (data: Buffer) => void) => {
        if (event === 'data') {
          callbacks.stderr = cb;
        }
      },
    );
    const mockOn = vi.fn(
      (event: string, cb: (code: number) => void) => {
        if (event === 'close') {
          callbacks.close = cb;
        }
      },
    );

    (spawn as unknown as vi.Mock).mockReturnValue({
      stdout: { on: mockStdoutOn },
      stderr: { on: mockStderrOn },
      on: mockOn,
    });

    return callbacks;
  };

  afterEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('sets shell true on win32', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const callbacks = setupSpawnMock();

    const promise = executeCommand('echo', ['test']);
    callbacks.close(0);
    await promise;

    expect(spawn).toHaveBeenCalledWith(
      'echo',
      ['test'],
      expect.objectContaining({ shell: true })
    );
  });

  it('streams stdout incrementally via onProgress', async () => {
    const callbacks = setupSpawnMock();

    const onProgress = vi.fn();
    const promise = executeCommand('echo', [], onProgress);
    callbacks.stdout(Buffer.from('hel'));
    callbacks.stdout(Buffer.from('lo'));
    callbacks.close(0);
    const result = await promise;

    expect(onProgress.mock.calls).toEqual([["hel"], ["lo"]]);
    expect(result).toBe('hello');
  });

  it('rejects when process exits with non-zero code', async () => {
    const callbacks = setupSpawnMock();

    const promise = executeCommand('echo', []);
    callbacks.stderr(Buffer.from('boom'));
    callbacks.close(1);

    await expect(promise).rejects.toThrow(
      'Command failed with exit code 1: boom'
    );
  });
});
