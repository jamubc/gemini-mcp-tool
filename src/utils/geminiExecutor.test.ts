/**
 * Regression tests for the --no-fallback gate in executeGeminiCLI.
 *
 * These tests stub cliExecutor to avoid real gemini CLI invocations.
 * The gate must:
 *   1. propagate QUOTA_EXCEEDED unchanged when noFallback=true
 *   2. attempt the flash fallback when noFallback=false (default behaviour)
 *   3. honour GEMINI_MCP_NO_FALLBACK=1 env var even without the flag
 *   4. leave the normal success path unaffected when noFallback=true
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ERROR_MESSAGES, MODELS } from '../constants.js';

// Mock the cliExecutor module before importing geminiExecutor so the mock is in place
vi.mock('./cliExecutor.js', () => ({
  executeCliCommand: vi.fn(),
}));

// Dynamic import after mock registration
const { executeCliCommand } = await import('./cliExecutor.js');
const { executeGeminiCLI } = await import('./geminiExecutor.js');

const mockExecuteCliCommand = vi.mocked(executeCliCommand);

function makeQuotaError(): Error {
  return new Error(ERROR_MESSAGES.QUOTA_EXCEEDED);
}

function makeSuccessResult(stdout = 'ok') {
  return { stdout, stderr: '', exitCode: 0 };
}

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.GEMINI_MCP_NO_FALLBACK;
});

afterEach(() => {
  delete process.env.GEMINI_MCP_NO_FALLBACK;
});

describe('executeGeminiCLI --no-fallback gate', () => {
  it('propagates QUOTA_EXCEEDED unchanged when noFallback=true', async () => {
    // First (and only) call throws quota error
    mockExecuteCliCommand.mockRejectedValueOnce(makeQuotaError());

    await expect(
      executeGeminiCLI('hello', MODELS.PRO, false, false, undefined, true)
    ).rejects.toThrow(ERROR_MESSAGES.QUOTA_EXCEEDED);

    // The gate must have thrown before attempting the fallback model — only one call
    expect(mockExecuteCliCommand).toHaveBeenCalledTimes(1);
  });

  it('attempts flash fallback when noFallback=false (default behaviour unchanged)', async () => {
    // First call (pro) throws quota error; second call (flash) succeeds
    mockExecuteCliCommand
      .mockRejectedValueOnce(makeQuotaError())
      .mockResolvedValueOnce(makeSuccessResult('flash response'));

    const result = await executeGeminiCLI('hello', MODELS.PRO, false, false, undefined, false);

    // Fallback ran: two calls total
    expect(mockExecuteCliCommand).toHaveBeenCalledTimes(2);
    expect(result).toBe('flash response');
  });

  it('GEMINI_MCP_NO_FALLBACK=1 env var triggers gate without explicit flag', async () => {
    process.env.GEMINI_MCP_NO_FALLBACK = '1';
    mockExecuteCliCommand.mockRejectedValueOnce(makeQuotaError());

    await expect(
      executeGeminiCLI('hello', MODELS.PRO, false, false, undefined, undefined)
    ).rejects.toThrow(ERROR_MESSAGES.QUOTA_EXCEEDED);

    // Gate fired; no fallback attempt
    expect(mockExecuteCliCommand).toHaveBeenCalledTimes(1);
  });

  it('normal success path with noFallback=true completes without error', async () => {
    mockExecuteCliCommand.mockResolvedValueOnce(makeSuccessResult('good response'));

    const result = await executeGeminiCLI('hello', MODELS.PRO, false, false, undefined, true);

    expect(result).toBe('good response');
    expect(mockExecuteCliCommand).toHaveBeenCalledTimes(1);
  });
});
