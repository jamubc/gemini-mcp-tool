/**
 * Error type definitions for the Gemini MCP Tool
 */

/**
 * Base error class for all Gemini MCP errors
 */
export class GeminiMCPError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'GeminiMCPError';
  }
}

/**
 * Error thrown when a tool execution fails
 */
export class ToolExecutionError extends GeminiMCPError {
  constructor(
    public readonly toolName: string,
    message: string,
    public readonly originalError?: Error | unknown
  ) {
    super(message, 'TOOL_EXECUTION_ERROR', { toolName });
    this.name = 'ToolExecutionError';
  }
}

/**
 * Error thrown when command execution fails
 */
export class CommandExecutionError extends GeminiMCPError {
  constructor(
    public readonly command: string,
    message: string,
    public readonly exitCode?: number,
    public readonly stderr?: string
  ) {
    super(message, 'COMMAND_EXECUTION_ERROR', { command, exitCode });
    this.name = 'CommandExecutionError';
  }
}

/**
 * Error thrown when Gemini CLI execution fails
 */
export class GeminiCLIError extends GeminiMCPError {
  constructor(
    message: string,
    public readonly prompt?: string,
    public readonly model?: string
  ) {
    super(message, 'GEMINI_CLI_ERROR', { prompt, model });
    this.name = 'GeminiCLIError';
  }
}

/**
 * Error thrown when a timeout occurs
 */
export class TimeoutError extends GeminiMCPError {
  constructor(
    message: string,
    public readonly timeoutMs: number,
    public readonly operation?: string
  ) {
    super(message, 'TIMEOUT_ERROR', { timeoutMs, operation });
    this.name = 'TimeoutError';
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends GeminiMCPError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: any
  ) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when a prompt execution fails
 */
export class PromptExecutionError extends GeminiMCPError {
  constructor(
    public readonly promptName: string,
    message: string,
    public readonly args?: Record<string, any>
  ) {
    super(message, 'PROMPT_EXECUTION_ERROR', { promptName, args });
    this.name = 'PromptExecutionError';
  }
}

/**
 * Type guard to check if an error is a GeminiMCPError
 */
export function isGeminiMCPError(error: unknown): error is GeminiMCPError {
  return error instanceof GeminiMCPError;
}

/**
 * Type guard to check if an error has a message property
 */
export function hasErrorMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as any).message === 'string'
  );
}

/**
 * Safely extract error message from unknown error type
 */
export function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  
  if (hasErrorMessage(error)) {
    return error.message;
  }
  
  return String(error);
}