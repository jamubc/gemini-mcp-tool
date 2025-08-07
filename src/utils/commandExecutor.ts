import { spawn, ChildProcess } from "child_process";
import { Logger } from "./logger.js";
import { RollingTimeoutManager, RollingTimeoutConfig } from "./rollingTimeoutManager.js";

/**
 * Configuration options for command execution
 */
export interface CommandOptions {
  /** Rolling timeout in milliseconds - resets on data activity (default: 30000) */
  rollingTimeout?: number;
  /** Absolute timeout in milliseconds - maximum duration regardless of activity (default: 600000) */
  absoluteTimeout?: number;
  /** Enable throttled timeout resets for performance (default: true) */
  enableThrottling?: boolean;
  /** Custom abort signal for external cancellation */
  signal?: AbortSignal;
}

export async function executeCommand(
  command: string,
  args: string[],
  onProgress?: (newOutput: string) => void,
  options?: CommandOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    Logger.commandExecution(command, args, startTime);

    // Initialize rolling timeout manager if timeout options provided
    let timeoutManager: RollingTimeoutManager | undefined;
    if (options?.rollingTimeout || options?.absoluteTimeout) {
      const timeoutConfig: Partial<RollingTimeoutConfig> = {};
      if (options.rollingTimeout) timeoutConfig.rollingTimeout = options.rollingTimeout;
      if (options.absoluteTimeout) timeoutConfig.absoluteTimeout = options.absoluteTimeout;
      if (options.enableThrottling !== undefined) timeoutConfig.enableThrottling = options.enableThrottling;
      
      timeoutManager = new RollingTimeoutManager(timeoutConfig);
      timeoutManager.start();
      
      // Handle timeout abort
      timeoutManager.getAbortSignal().addEventListener('abort', (event: any) => {
        const reason = event.target.reason;
        Logger.warn(`Command timed out: ${reason?.message || 'Unknown timeout'}`);
        if (childProcess && !childProcess.killed) {
          killProcessGracefully(childProcess);
        }
        if (!isResolved) {
          isResolved = true;
          reject(reason || new Error('Operation timed out'));
        }
        timeoutManager?.stop();
      });
    }

    // Handle external abort signal
    if (options?.signal) {
      options.signal.addEventListener('abort', () => {
        Logger.warn('Command aborted by external signal');
        if (childProcess && !childProcess.killed) {
          killProcessGracefully(childProcess);
        }
        if (!isResolved) {
          isResolved = true;
          reject(new Error('Operation was aborted'));
        }
        timeoutManager?.stop();
      });
    }

    const childProcess = spawn(command, args, {
      env: process.env,
      // Windows requires spawning through the shell to resolve PATH correctly
      // See: https://github.com/jamubc/gemini-mcp-tool/issues/9
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
      // Ensure Gemini CLI runs in the same CWD as Claude for file access
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";
    let isResolved = false;
    let lastReportedLength = 0;
    
    childProcess.stdout.on("data", (data) => {
      stdout += data.toString();
      
      // Reset rolling timeout on data activity
      timeoutManager?.resetOnActivity();
      
      // Report new content if callback provided
      if (onProgress && stdout.length > lastReportedLength) {
        const newContent = stdout.substring(lastReportedLength);
        lastReportedLength = stdout.length;
        onProgress(newContent);
      }
    });


    // CLI level errors
    childProcess.stderr.on("data", (data) => {
      stderr += data.toString();
      // find RESOURCE_EXHAUSTED when gemini-2.5-pro quota is exceeded
      if (stderr.includes("RESOURCE_EXHAUSTED")) {
        const modelMatch = stderr.match(/Quota exceeded for quota metric '([^']+)'/);
        const statusMatch = stderr.match(/status["\s]*[:=]\s*(\d+)/);
        const reasonMatch = stderr.match(/"reason":\s*"([^"]+)"/);
        const model = modelMatch ? modelMatch[1] : "Unknown Model";
        const status = statusMatch ? statusMatch[1] : "429";
        const reason = reasonMatch ? reasonMatch[1] : "rateLimitExceeded";
        const errorJson = {
          error: {
            code: parseInt(status),
            message: `GMCPT: --> Quota exceeded for ${model}`,
            details: {
              model: model,
              reason: reason,
              statusText: "Too Many Requests -- > try using gemini-2.5-flash by asking",
            }
          }
        };
        Logger.error(`Gemini Quota Error: ${JSON.stringify(errorJson, null, 2)}`);
      }
    });
    childProcess.on("error", (error) => {
      if (!isResolved) {
        isResolved = true;
        Logger.error(`Process error:`, error);
        reject(new Error(`Failed to spawn command: ${error.message}`));
      }
    });
    childProcess.on("close", (code) => {
      if (!isResolved) {
        isResolved = true;
        timeoutManager?.stop();
        
        if (code === 0) {
          Logger.commandComplete(startTime, code, stdout.length);
          resolve(stdout.trim());
        } else {
          Logger.commandComplete(startTime, code);
          Logger.error(`Failed with exit code ${code}`);
          const errorMessage = stderr.trim() || "Unknown error";
          reject(
            new Error(`Command failed with exit code ${code}: ${errorMessage}`),
          );
        }
      }
    });
  });
}

/**
 * Gracefully kill a child process with escalating termination signals
 * Implements the security requirement for graceful process termination
 */
function killProcessGracefully(childProcess: ChildProcess): void {
  if (childProcess.killed || !childProcess.pid) {
    return;
  }

  Logger.debug(`Attempting graceful termination of process ${childProcess.pid}`);
  
  // Step 1: Send SIGTERM for graceful shutdown
  childProcess.kill('SIGTERM');
  
  // Step 2: Wait grace period, then force kill if still running
  setTimeout(() => {
    if (!childProcess.killed && childProcess.pid) {
      Logger.debug(`Force killing process ${childProcess.pid} after grace period`);
      
      if (process.platform === 'win32') {
        // Windows doesn't support SIGKILL, use taskkill for process tree termination
        try {
          spawn('taskkill', ['/F', '/T', '/PID', childProcess.pid.toString()], { 
            stdio: 'ignore',
            detached: true 
          });
        } catch (error) {
          Logger.error(`Failed to force kill Windows process: ${error}`);
          childProcess.kill('SIGKILL');
        }
      } else {
        // Unix: Kill process group to ensure child processes are terminated
        try {
          process.kill(-childProcess.pid, 'SIGKILL');
        } catch (error) {
          // Fallback to killing just the process
          childProcess.kill('SIGKILL');
        }
      }
    }
  }, 5000); // 5 second grace period as specified in security requirements
}