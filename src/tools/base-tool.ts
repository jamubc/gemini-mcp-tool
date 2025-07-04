import { Tool } from './index.js';
import { ToolBehavior } from '../types/tool-behavior.js';
import { StrictMode, StrictModeType } from '../types/strict-mode.js';
import { executeGeminiCLI } from '../utils/gemini-executor.js';
import { resolveFilePaths } from '../utils/path-resolver.js';
import { createStandardizedResponse, StandardizedResponseSections } from '../utils/structured-response.js';
import { ToolExecutionError, TimeoutError } from '../types/errors.js';
import { sanitize } from '../utils/error-sanitizer.js';

/**
 * Feature flags that can be enabled/disabled per tool
 */
export interface ToolFeatures {
  /** Whether this tool uses Gemini CLI */
  geminiEnabled: boolean;
  /** Default strict mode for Gemini execution */
  strictMode: StrictModeType;
  /** Whether the tool supports file path resolution with @ syntax */
  fileHandling: boolean;
  /** Whether sandbox mode is supported */
  sandboxSupport: boolean;
  /** Whether the tool can be exposed as a slash command */
  promptMode: boolean;
  /** Whether to support backup creation before file operations */
  backupSupport: boolean;
  /** Enable Context-Engineering patterns for agent-to-agent communication */
  contextEngineering: boolean;
  /** Enable pareto-lang protocol patterns */
  paretoProtocol: boolean;
  /** Automatically resolve empty/invalid paths to fallback locations */
  autoResolve: boolean;
  /** Custom timeout in milliseconds (default varies by operation) */
  timeout?: number;
}

/**
 * Base abstract class for all MCP tools
 * Provides common functionality and enforces consistent patterns
 */
export abstract class BaseTool implements Tool {
  // Core properties that must be defined by child classes
  abstract name: string;
  abstract description: string;
  abstract inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };

  // Optional prompt mode configuration
  asPrompt?: {
    enabled: boolean;
    arguments?: Array<{
      name: string;
      description: string;
      required?: boolean;
    }>;
  };

  // Feature flags with sensible defaults
  protected features: ToolFeatures = {
    geminiEnabled: true,
    strictMode: StrictMode.AUTO,
    fileHandling: true,
    sandboxSupport: false,
    promptMode: false,
    backupSupport: false,
    contextEngineering: false,
    paretoProtocol: false,
    autoResolve: false,
  };

  // Default behavior metadata (overridable)
  behavior: ToolBehavior = {
    idempotent: true,
    readsFilesystem: "relative",
    writesFilesystem: false,
    network: "none",
    should_explain: true,
    output_format: "formatted",
    context_needed: true,
    suppress_context: false,
  };

  /**
   * Helper to build standard input schema
   */
  protected buildInputSchema(
    properties: Record<string, any>,
    required: string[] = []
  ): Tool['inputSchema'] {
    return {
      type: "object",
      properties,
      required,
    };
  }

  /**
   * Main execute method with common error handling and formatting
   */
  async execute(args: any): Promise<string> {
    try {
      // Pre-execution validation and setup
      await this.preExecute(args);

      // Main execution logic (implemented by child)
      const result = await this.doExecute(args);

      // Post-execution formatting
      return this.formatResponse(result, args);
    } catch (error) {
      // Consistent error handling
      return this.handleError(error);
    }
  }

  /**
   * Pre-execution hook for validation and setup
   * Override in child classes for custom validation
   */
  protected async preExecute(args: any): Promise<void> {
    // Default implementation - no-op
  }

  /**
   * Abstract method that child classes must implement
   * This is where the actual tool logic goes
   */
  protected abstract doExecute(args: any): Promise<any>;

  /**
   * Execute Gemini CLI with configured features
   */
  protected async executeGemini(
    prompt: string,
    args: any,
    overrideStrictMode?: StrictModeType
  ): Promise<string> {
    if (!this.features.geminiEnabled) {
      throw new ToolExecutionError(
        this.name,
        "This tool does not support Gemini execution"
      );
    }

    // Resolve file paths if file handling is enabled and @ syntax is present
    let resolvedPrompt = prompt;
    if (this.features.fileHandling && prompt.includes('@')) {
      resolvedPrompt = await resolveFilePaths(prompt);
    }

    // Determine strict mode
    const strictMode = overrideStrictMode || 
                      (args.strictMode as StrictModeType) || 
                      this.features.strictMode;

    // Handle timeout if specified
    const timeout = args.timeout || this.features.timeout;
    if (timeout) {
      return this.executeWithTimeout(
        () => executeGeminiCLI(
          resolvedPrompt,
          args.model,
          args.sandbox && this.features.sandboxSupport,
          strictMode
        ),
        timeout
      );
    }

    // Execute without timeout
    return executeGeminiCLI(
      resolvedPrompt,
      args.model,
      args.sandbox && this.features.sandboxSupport,
      strictMode
    );
  }

  /**
   * Execute a promise with timeout
   */
  protected async executeWithTimeout<T>(
    promise: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(
          new TimeoutError(
            `Tool timeout after ${timeoutMs / 1000} seconds`,
            timeoutMs,
            this.name
          )
        ),
        timeoutMs
      );
    });

    return Promise.race([promise(), timeoutPromise]);
  }

  /**
   * Format the response using standardized sections
   * Override buildResponseSections in child classes
   */
  protected formatResponse(result: any, args: any): string {
    const sections = this.buildResponseSections(result, args);
    const metadata = this.getMetadata(result);
    
    return createStandardizedResponse(
      sections,
      this.behavior,
      metadata
    );
  }

  /**
   * Build response sections - must be implemented by child classes
   */
  protected abstract buildResponseSections(
    result: any,
    args: any
  ): StandardizedResponseSections;

  /**
   * Get metadata for the response
   * Override in child classes to provide custom metadata
   */
  protected getMetadata(result: any): any {
    return {
      status: "success",
      execution_details: `${this.name} completed successfully`,
    };
  }

  /**
   * Handle errors consistently across all tools
   */
  protected handleError(error: any): never {
    const sanitizedMessage = sanitize(error);
    
    // If it's already a ToolExecutionError, re-throw it
    if (error instanceof ToolExecutionError) {
      throw error;
    }
    
    // Otherwise, wrap it
    throw new ToolExecutionError(
      this.name,
      `${this.name} failed: ${sanitizedMessage}`,
      error
    );
  }

  /**
   * Validate required arguments
   */
  protected validateRequired(args: any, required: string[]): void {
    for (const field of required) {
      if (!args[field] || (typeof args[field] === 'string' && !args[field].trim())) {
        throw new ToolExecutionError(
          this.name,
          `Missing required field: ${field}`
        );
      }
    }
  }

  /**
   * Enable prompt mode for this tool
   */
  protected enablePromptMode(
    args: Array<{
      name: string;
      description: string;
      required?: boolean;
    }>
  ): void {
    this.features.promptMode = true;
    this.asPrompt = {
      enabled: true,
      arguments: args,
    };
  }

  /**
   * Configure features in bulk
   */
  protected configureFeatures(features: Partial<ToolFeatures>): void {
    this.features = { ...this.features, ...features };
  }

  /**
   * Configure behavior in bulk
   */
  protected configureBehavior(behavior: Partial<ToolBehavior>): void {
    this.behavior = { ...this.behavior, ...behavior };
  }
}