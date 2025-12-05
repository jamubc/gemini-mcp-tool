import { vi } from 'vitest';
import { EventEmitter } from 'node:events';

/**
 * Creates a mock child process for testing command execution
 */
export function createMockProcess() {
  const mockProcess = new EventEmitter() as any;
  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();
  mockProcess.stdout.on = vi.fn((event, handler) => {
    if (event === 'data') mockProcess.stdout['data'] = handler;
  });
  mockProcess.stderr.on = vi.fn((event, handler) => {
    if (event === 'data') mockProcess.stderr['data'] = handler;
  });
  return mockProcess;
}

/**
 * Simulates successful process execution
 */
export function simulateProcessSuccess(mockProcess: any, output: string, delay = 10) {
  setTimeout(() => {
    if (mockProcess.stdout['data']) {
      mockProcess.stdout['data'](output);
    }
    mockProcess.emit('close', 0);
  }, delay);
}

/**
 * Simulates process failure
 */
export function simulateProcessFailure(mockProcess: any, errorOutput: string, exitCode = 1, delay = 10) {
  setTimeout(() => {
    if (mockProcess.stderr['data']) {
      mockProcess.stderr['data'](errorOutput);
    }
    mockProcess.emit('close', exitCode);
  }, delay);
}

/**
 * Simulates process error
 */
export function simulateProcessError(mockProcess: any, error: Error, delay = 10) {
  setTimeout(() => {
    mockProcess.emit('error', error);
  }, delay);
}
