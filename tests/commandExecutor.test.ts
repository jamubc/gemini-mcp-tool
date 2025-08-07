import { describe, it, afterEach, expect, vi } from 'vitest';
import { spawn } from 'child_process';
import { executeCommand } from '../src/utils/commandExecutor.js';
import { performance } from 'perf_hooks';

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

  describe('Rolling Timeout Performance Analysis', () => {
    it('measures timer overhead for rolling timeout pattern', () => {
      const ITERATIONS = 1000;
      let timeoutId: NodeJS.Timeout | undefined;
      
      // Measure baseline setTimeout/clearTimeout performance
      const startTime = performance.now();
      
      for (let i = 0; i < ITERATIONS; i++) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {}, 30000);
      }
      
      clearTimeout(timeoutId);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const avgTimePerOperation = totalTime / ITERATIONS;
      
      console.log(`\n=== ROLLING TIMEOUT PERFORMANCE METRICS ===`);
      console.log(`Total time for ${ITERATIONS} timer operations: ${totalTime.toFixed(3)}ms`);
      console.log(`Average time per clearTimeout + setTimeout: ${avgTimePerOperation.toFixed(6)}ms`);
      console.log(`Projected overhead for 100 data chunks/sec: ${(avgTimePerOperation * 100).toFixed(3)}ms/sec`);
      console.log(`Projected overhead for 5 concurrent processes: ${(avgTimePerOperation * 500).toFixed(3)}ms/sec`);
      
      // Performance budget: each timer operation should be < 0.1ms
      expect(avgTimePerOperation).toBeLessThan(0.1);
    });

    it('measures memory usage patterns for frequent timer operations', async () => {
      const TIMER_COUNT = 100;
      const timers: NodeJS.Timeout[] = [];
      
      // Measure initial memory
      const initialMemory = process.memoryUsage();
      
      // Create many timers to simulate concurrent processes
      for (let i = 0; i < TIMER_COUNT; i++) {
        const timer = setTimeout(() => {}, 30000);
        timers.push(timer);
      }
      
      const peakMemory = process.memoryUsage();
      
      // Clear all timers
      timers.forEach(timer => clearTimeout(timer));
      
      // Allow GC to run
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      
      const memoryIncrease = peakMemory.heapUsed - initialMemory.heapUsed;
      const memoryPerTimer = memoryIncrease / TIMER_COUNT;
      
      console.log(`\n=== TIMER MEMORY USAGE ANALYSIS ===`);
      console.log(`Memory increase for ${TIMER_COUNT} timers: ${(memoryIncrease / 1024).toFixed(2)} KB`);
      console.log(`Average memory per timer: ${memoryPerTimer.toFixed(0)} bytes`);
      console.log(`Projected memory for 500 concurrent timers: ${(memoryPerTimer * 500 / 1024).toFixed(2)} KB`);
      
      // Memory budget: should not exceed 100KB for reasonable timer counts
      expect(memoryIncrease).toBeLessThan(100 * 1024);
    });

    it('compares throttled vs unthrottled timeout reset performance', () => {
      const DATA_CHUNKS = 500; // Simulate large response
      let unthrottledTimeoutId: NodeJS.Timeout | undefined;
      let throttledTimeoutId: NodeJS.Timeout | undefined;
      let lastThrottleTime = 0;
      const THROTTLE_MS = 100;
      
      // Unthrottled approach (reset on every data chunk)
      const startUnthrottled = performance.now();
      for (let i = 0; i < DATA_CHUNKS; i++) {
        clearTimeout(unthrottledTimeoutId);
        unthrottledTimeoutId = setTimeout(() => {}, 30000);
      }
      clearTimeout(unthrottledTimeoutId);
      const endUnthrottled = performance.now();
      
      // Throttled approach (reset max once per 100ms)
      const startThrottled = performance.now();
      for (let i = 0; i < DATA_CHUNKS; i++) {
        const now = Date.now();
        if (now - lastThrottleTime > THROTTLE_MS) {
          clearTimeout(throttledTimeoutId);
          throttledTimeoutId = setTimeout(() => {}, 30000);
          lastThrottleTime = now;
        }
      }
      clearTimeout(throttledTimeoutId);
      const endThrottled = performance.now();
      
      const unthrottledTime = endUnthrottled - startUnthrottled;
      const throttledTime = endThrottled - startThrottled;
      const performanceGain = ((unthrottledTime - throttledTime) / unthrottledTime) * 100;
      
      console.log(`\n=== THROTTLED VS UNTHROTTLED PERFORMANCE ===`);
      console.log(`Unthrottled (${DATA_CHUNKS} resets): ${unthrottledTime.toFixed(3)}ms`);
      console.log(`Throttled (100ms batching): ${throttledTime.toFixed(3)}ms`);
      console.log(`Performance improvement: ${performanceGain.toFixed(1)}%`);
      
      // Throttled approach should be significantly faster
      expect(throttledTime).toBeLessThan(unthrottledTime);
    });
  });
});
