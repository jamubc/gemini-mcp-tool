import { spawn, ChildProcess } from 'child_process';
import { Logger } from './logger.js';
import { QuotaManager, isQuotaError, getQuotaAwareErrorMessage } from './quotaManager.js';

export interface GeminiExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  timeout?: boolean;
  quotaExceeded?: boolean;
  quotaType?: 'pro' | 'flash' | 'unknown';
  canFallback?: boolean;
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
  private static cachedWorkingCommand: string | null = null; // Cache the working CLI command
  
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

    const quotaManager = QuotaManager.getInstance();
    
    // Check quota status before attempting execution
    const quotaStatus = quotaManager.getQuotaStatus(opts.model!);
    if (quotaStatus.isQuotaExceeded) {
      Logger.warn(`Quota exceeded for ${opts.model}: ${quotaStatus.suggestedAction}`);
      return {
        success: false,
        error: quotaStatus.suggestedAction,
        quotaExceeded: true,
        quotaType: quotaStatus.quotaType,
        canFallback: quotaStatus.canFallback
      };
    }

    // Always check CLI installation first (no API call, fast check)
    if (!await this.isCliInstalled()) {
      return {
        success: false,
        error: 'Gemini CLI is not installed or not available in PATH'
      };
    }
    
    // If CLI is installed but quota is exceeded, return quota error
    if (quotaStatus.isQuotaExceeded) {
      Logger.debug('CLI installed but quota exceeded, returning quota status');
      // Return the quota exceeded error instead of proceeding to API call
      return {
        success: false,
        error: quotaStatus.suggestedAction,
        quotaExceeded: true,
        quotaType: quotaStatus.quotaType,
        canFallback: quotaStatus.canFallback
      };
    }

    let lastError: any;
    let currentTimeout = opts.timeout!;

    for (let attempt = 0; attempt < opts.maxRetries!; attempt++) {
      try {
        Logger.debug(`Gemini CLI attempt ${attempt + 1}/${opts.maxRetries} (timeout: ${currentTimeout}ms)`);
        
        const result = await this.executeWithTimeout(prompt, opts.model!, opts.sandbox!, currentTimeout);
        
        if (result.success) {
          Logger.debug(`Gemini CLI succeeded on attempt ${attempt + 1}`);
          // Clear quota status on success
          quotaManager.resetQuotaStatus(opts.model);
          return result;
        }

        // Check for quota-related errors
        if (result.error && isQuotaError(result.error)) {
          const quotaError = quotaManager.analyzeError(result.error, opts.model);
          Logger.warn(`Quota error detected: ${quotaError.message}`);
          
          return {
            success: false,
            error: getQuotaAwareErrorMessage(result.error, opts.model),
            exitCode: result.exitCode,
            quotaExceeded: true,
            quotaType: quotaError.model === 'pro' ? 'pro' : quotaError.model === 'flash' ? 'flash' : 'unknown',
            canFallback: quotaError.fallbackAvailable
          };
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

        // Non-timeout error - don't retry unless it's quota-related
        return result;
        
      } catch (error) {
        lastError = error;
        Logger.warn(`Gemini CLI attempt ${attempt + 1} failed:`, error);
        
        // Check if the error is quota-related
        if (error instanceof Error && isQuotaError(error.message)) {
          const quotaError = quotaManager.analyzeError(error.message, opts.model);
          return {
            success: false,
            error: getQuotaAwareErrorMessage(error, opts.model),
            quotaExceeded: true,
            quotaType: quotaError.model === 'pro' ? 'pro' : quotaError.model === 'flash' ? 'flash' : 'unknown',
            canFallback: quotaError.fallbackAvailable
          };
        }
      }
    }

    // All attempts failed
    return {
      success: false,
      error: `Gemini CLI failed after ${opts.maxRetries} attempts. Last error: ${
        lastError instanceof Error ? lastError.message : 
        typeof lastError === 'object' ? JSON.stringify(lastError) : 
        String(lastError)
      }`,
      timeout: lastError?.exitCode === 124
    };
  }

  /**
   * Check if Gemini CLI is installed without making API calls
   * Uses --version flag which doesn't consume quota and provides version info
   * Handles npm global installations and PATH issues
   */
  private static async isCliInstalled(): Promise<boolean> {
    try {
      const { spawn } = await import('child_process');
      
      return new Promise<boolean>((resolve) => {
        let output = '';
        let resolved = false;
        
        // Try different command variants for cross-platform compatibility
        const commands = process.platform === 'win32' 
          ? ['gemini.cmd', 'gemini', 'npx gemini'] 
          : ['gemini', 'npx gemini'];
        
        let commandIndex = 0;
        
        const tryCommand = () => {
          if (commandIndex >= commands.length) {
            Logger.debug('Gemini CLI not found in any variant');
            if (!resolved) {
              resolved = true;
              resolve(false);
            }
            return;
          }
          
          const cmd = commands[commandIndex];
          const args = cmd.includes('npx') ? ['gemini', '--version'] : ['--version'];
          const command = cmd.includes('npx') ? 'npx' : cmd;
          
          Logger.debug(`Trying CLI command: ${command} ${args.join(' ')}`);
          
          const child = spawn(command, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
            shell: true, // Enable shell for better PATH resolution
            env: { ...process.env }, // Inherit full environment
            timeout: 5000
          });
          
          child.stdout?.on('data', (data) => {
            output += data.toString();
          });
          
          child.on('exit', (code) => {
            if (!resolved) {
              if (code === 0 && output.trim()) {
                Logger.debug(`Gemini CLI found via '${cmd}': ${output.trim()}`);
                // Cache the working command for future use
                GeminiCliReliabilityManager.cachedWorkingCommand = cmd;
                resolved = true;
                resolve(true);
              } else {
                commandIndex++;
                output = ''; // Reset output for next attempt
                tryCommand();
              }
            }
          });
          
          child.on('error', (error) => {
            if (!resolved) {
              Logger.debug(`CLI command '${cmd}' failed:`, error.message);
              commandIndex++;
              output = '';
              tryCommand();
            }
          });
          
          // Timeout for individual command attempt
          setTimeout(() => {
            if (!resolved && !child.killed) {
              child.kill();
              commandIndex++;
              output = '';
              tryCommand();
            }
          }, 4000);
        };
        
        tryCommand();
        
        // Overall timeout fallback
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            Logger.debug('CLI detection timed out completely');
            resolve(false);
          }
        }, 15000);
      });
    } catch (error) {
      Logger.debug('CLI availability check failed:', error);
      return false;
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

      // Use cached working command or fallback to 'gemini'
      const workingCommand = this.cachedWorkingCommand || 'gemini';
      
      // Build command arguments
      const args = ['-m', model];
      if (sandbox) {
        args.push('-s');
      }
      // Properly escape the prompt for shell execution
      const escapedPrompt = process.platform === 'win32' 
        ? `"${prompt.replace(/"/g, '\\"')}"` 
        : `'${prompt.replace(/'/g, "'\\''")}'`;
      args.push('-p', escapedPrompt);

      Logger.debug(`Raw args: ${JSON.stringify(args)}`);
      Logger.debug(`Executing: ${workingCommand} ${args.join(' ')} (timeout: ${timeoutMs}ms)`);

      // Determine actual command and arguments for spawn
      let spawnCommand = workingCommand;
      let spawnArgs = args;
      
      if (workingCommand.includes('npx')) {
        spawnCommand = 'npx';
        spawnArgs = ['gemini', ...args];
      }

      // Spawn process with proper error handling
      const child: ChildProcess = spawn(spawnCommand, spawnArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true, // Hide window on Windows
        detached: false,   // Keep attached for proper cleanup
        shell: true,       // Enable shell for better PATH resolution
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
              exitCode: code,
              timeout: false
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
   * Get Gemini CLI version information without consuming API quota
   */
  static async getCliVersion(): Promise<string | null> {
    try {
      // Ensure CLI detection has been run to cache working command
      if (!this.cachedWorkingCommand) {
        const isInstalled = await this.isCliInstalled();
        if (!isInstalled) {
          return null;
        }
      }
      
      const { spawn } = await import('child_process');
      const workingCommand = this.cachedWorkingCommand || 'gemini';
      
      return new Promise<string | null>((resolve) => {
        let output = '';
        
        // Determine command and args for version check
        let spawnCommand = workingCommand;
        let spawnArgs = ['--version'];
        
        if (workingCommand.includes('npx')) {
          spawnCommand = 'npx';
          spawnArgs = ['gemini', '--version'];
        }
        
        const child = spawn(spawnCommand, spawnArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
          shell: true,
          env: { ...process.env },
          timeout: 5000
        });
        
        child.stdout?.on('data', (data) => {
          output += data.toString();
        });
        
        child.on('exit', (code) => {
          if (code === 0 && output.trim()) {
            resolve(output.trim());
          } else {
            resolve(null);
          }
        });
        
        child.on('error', () => {
          resolve(null);
        });
        
        setTimeout(() => {
          child.kill();
          resolve(null);
        }, 5000);
      });
    } catch (error) {
      return null;
    }
  }

  /**
   * Test utility: Check CLI availability without consuming API quota
   */
  static async testGeminiAvailability(): Promise<boolean> {
    try {
      // First check if CLI is installed (no API call)
      const cliInstalled = await this.isCliInstalled();
      if (!cliInstalled) {
        Logger.debug('Gemini CLI not installed');
        return false;
      }
      
      // Get version info for better diagnostics
      const version = await this.getCliVersion();
      if (version) {
        Logger.debug(`Gemini CLI version: ${version}`);
      }
      
      // Check quota status (no API call)
      const { QuotaManager } = await import('./quotaManager.js');
      const quotaManager = QuotaManager.getInstance();
      const proStatus = quotaManager.getQuotaStatus('gemini-2.5-pro');
      const flashStatus = quotaManager.getQuotaStatus('gemini-2.5-flash');
      
      // CLI is available if installed and at least one model has quota
      const hasAvailableQuota = !proStatus.isQuotaExceeded || !flashStatus.isQuotaExceeded;
      
      Logger.debug(`CLI installed: ${cliInstalled}, quota available: ${hasAvailableQuota}`);
      return cliInstalled && hasAvailableQuota;
      
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