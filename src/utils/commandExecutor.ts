import { spawn } from "child_process";
import { Logger } from "./logger.js";
import { TIMEOUTS, ERROR_MESSAGES } from "../constants.js";

export class TimeoutError extends Error {
  constructor(message: string, public timeout: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export async function executeCommand(
  command: string,
  args: string[],
  onProgress?: (newOutput: string) => void,
  timeout: number = TIMEOUTS.DEFAULT_COMMAND_TIMEOUT
): Promise<string> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    Logger.commandExecution(command, args, startTime);

    const childProcess = spawn(command, args, {
      env: process.env,
      // Windows requires spawning through the shell to resolve PATH correctly
      // See: https://github.com/jamubc/gemini-mcp-tool/issues/9
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let isResolved = false;
    let lastReportedLength = 0;

    // Set up rolling timeout handling
    let timeoutId: NodeJS.Timeout;
    
    const startTimeout = () => {
      return setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          Logger.error(`Command timed out after ${timeout}ms of inactivity`);
          
          // Kill the child process
          childProcess.kill('SIGTERM');
          
          // If SIGTERM doesn't work, force kill after a short delay
          setTimeout(() => {
            if (!childProcess.killed) {
              childProcess.kill('SIGKILL');
            }
          }, 5000);
          
          reject(new TimeoutError(ERROR_MESSAGES.COMMAND_TIMEOUT, timeout));
        }
      }, timeout);
    };
    
    // Start initial timeout
    timeoutId = startTimeout();
    
    childProcess.stdout.on("data", (data) => {
      stdout += data.toString();
      
      // Reset rolling timeout whenever data is received
      if (!isResolved) {
        clearTimeout(timeoutId);
        timeoutId = startTimeout();
      }
      
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
        clearTimeout(timeoutId);
        Logger.error(`Process error:`, error);
        reject(new Error(`Failed to spawn command: ${error.message}`));
      }
    });
    childProcess.on("close", (code) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeoutId);
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