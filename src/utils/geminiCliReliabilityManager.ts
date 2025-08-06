import { spawn, ChildProcess } from 'child_process';
import { Logger } from './logger.js';

export interface GeminiExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  timeout?: boolean;
}

export interface GeminiExecutionOptions {
  timeout?: number;
  model?: string;
  sandbox?: boolean;
  maxRetries?: number;
  progressiveTimeout?: boolean;
}

/**
 * Enhanced Gemini CLI reliability manager with progressive timeout strategy
 * Addresses consistent exit code 124 timeout failures in tests
 */
export class GeminiCliReliabilityManager {
  private static readonly DEFAULT_TIMEOUT = 15000; // 15 seconds initial
  private static readonly PROGRESSIVE_TIMEOUT = 30000; // 30 seconds on retry
  private static readonly MAX_RETRIES = 2;
  private static readonly PREFLIGHT_TIMEOUT = 5000; // Quick availability check
  
  /**
   * Execute Gemini CLI command with reliability enhancements
   * Progressive timeout strategy: 15s → 30s on retry
   */
  static async executeGeminiCommandReliably(
    prompt: string,
    options: GeminiExecutionOptions = {}
  ): Promise<GeminiExecutionResult> {
    const opts = {
      timeout: this.DEFAULT_TIMEOUT,
      model: 'gemini-2.5-flash', // Use faster model for testing
      sandbox: false,
      maxRetries: this.MAX_RETRIES,
      progressiveTimeout: true,
      ...options
    };

    // Pre-flight check: Verify Gemini CLI is available
    const preflightResult = await this.preflightCheck();
    if (!preflightResult.success) {
      return preflightResult;
    }

    let lastError: any;
    let currentTimeout = opts.timeout!;

    for (let attempt = 0; attempt < opts.maxRetries!; attempt++) {
      try {
        Logger.debug(`Gemini CLI attempt ${attempt + 1}/${opts.maxRetries} (timeout: ${currentTimeout}ms)`);
        
        const result = await this.executeWithTimeout(prompt, opts.model!, opts.sandbox!, currentTimeout);
        
        if (result.success) {
          Logger.debug(`Gemini CLI succeeded on attempt ${attempt + 1}`);
          return result;
        }

        // Handle specific failure patterns
        if (result.exitCode === 124) {
          Logger.warn(`Gemini CLI timeout (124) on attempt ${attempt + 1}`);
          lastError = result;
          
          // Progressive timeout: increase for next attempt
          if (opts.progressiveTimeout && attempt < opts.maxRetries! - 1) {
            currentTimeout = this.PROGRESSIVE_TIMEOUT;
          }
          continue;
        }

        // Non-timeout error - don't retry
        return result;
        
      } catch (error) {
        lastError = error;
        Logger.warn(`Gemini CLI attempt ${attempt + 1} failed:`, error);
      }
    }

    // All attempts failed
    return {
      success: false,
      error: `Gemini CLI failed after ${opts.maxRetries} attempts. Last error: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
      timeout: lastError?.exitCode === 124
    };
  }

  /**
   * Pre-flight check to verify Gemini CLI availability
   * Quick 5-second check before actual execution
   */
  private static async preflightCheck(): Promise<GeminiExecutionResult> {
    try {
      Logger.debug('Running Gemini CLI pre-flight availability check...');
      
      const result = await this.executeWithTimeout(
        'ping', // Simple command to test availability
        'gemini-2.5-flash',
        false,
        this.PREFLIGHT_TIMEOUT
      );

      if (result.success) {
        Logger.debug('Gemini CLI pre-flight check passed');
        return { success: true };
      }

      Logger.warn('Gemini CLI pre-flight check failed:', result.error);
      return {
        success: false,
        error: 'Gemini CLI is not available or not responding'
      };
      
    } catch (error) {
      Logger.warn('Gemini CLI pre-flight check error:', error);
      return {
        success: false,
        error: `Pre-flight check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Execute Gemini CLI with timeout control and proper process management
   */
  private static async executeWithTimeout(
    prompt: string,
    model: string,
    sandbox: boolean,
    timeoutMs: number
  ): Promise<GeminiExecutionResult> {
    return new Promise((resolve) => {
      let resolved = false;
      let output = '';
      let errorOutput = '';

      // Build command arguments
      const args = ['-m', model];
      if (sandbox) {
        args.push('-s');
      }
      args.push(prompt);

      Logger.debug(`Executing: gemini ${args.join(' ')} (timeout: ${timeoutMs}ms)`);

      // Spawn process with proper error handling
      const child: ChildProcess = spawn('gemini', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true, // Hide window on Windows
        detached: false,   // Keep attached for proper cleanup
        env: { ...process.env } // Inherit environment
      });

      // Set up timeout handler
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          Logger.warn(`Gemini CLI timeout after ${timeoutMs}ms`);
          
          // Forcefully terminate the process
          if (child.pid) {
            try {
              process.kill(child.pid, 'SIGKILL');
            } catch (killError) {
              Logger.warn('Failed to kill Gemini process:', killError);
            }
          }

          resolve({
            success: false,
            error: `Command timeout after ${timeoutMs}ms`,
            exitCode: 124,
            timeout: true
          });
        }
      }, timeoutMs);

      // Handle process events
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          Logger.error('Gemini CLI spawn error:', error);
          
          resolve({
            success: false,
            error: `Process spawn error: ${error.message}`
          });
        }
      });

      child.on('exit', (code, signal) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          
          Logger.debug(`Gemini CLI exited with code ${code}, signal ${signal}`);

          if (code === 0) {
            resolve({
              success: true,
              output: output.trim(),
              exitCode: code
            });
          } else {
            const errorMessage = errorOutput.trim() || `Process exited with code ${code}`;
            resolve({
              success: false,
              error: errorMessage,
              exitCode: code || undefined,
              timeout: code === 124
            });
          }
        }
      });

      child.on('close', (code, signal) => {
        // Additional cleanup - exit should have already handled this
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          Logger.debug(`Gemini CLI closed with code ${code}, signal ${signal}`);
          
          resolve({
            success: false,
            error: `Process closed unexpectedly (code: ${code}, signal: ${signal})`,
            exitCode: code || undefined
          });
        }
      });
    });
  }

  /**
   * Test utility: Execute simple command for availability testing
   */
  static async testGeminiAvailability(): Promise<boolean> {
    try {
      const result = await this.executeGeminiCommandReliably('Hello', {
        timeout: 10000,
        model: 'gemini-2.5-flash',
        maxRetries: 1,
        progressiveTimeout: false
      });
      
      return result.success;
    } catch (error) {
      Logger.warn('Gemini availability test failed:', error);
      return false;
    }
  }

  /**
   * Get recommended timeout for test environment
   */
  static getTestTimeout(): number {
    // In test environment, use longer timeout to prevent flaky tests
    return process.env.NODE_ENV === 'test' ? this.PROGRESSIVE_TIMEOUT : this.DEFAULT_TIMEOUT;
  }
}