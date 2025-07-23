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
});
