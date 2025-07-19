import { spawn } from "child_process";
import { Logger } from "./logger.js";
import { TIMING, ERROR_MESSAGES } from "../constants.js";

/**
 * Safely executes a shell command with proper argument handling and monitoring
 * @param command The command to execute
 * @param args The arguments to pass to the command
 * @returns Promise resolving to the command output
 */
export async function executeCommand(
  command: string,
  args: string[],
): Promise<string> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    Logger.commandExecution(command, args, startTime);

    // Spawn the child process with safety settings
    const childProcess = spawn(command, args, {
      env: process.env,
      shell: false, // Prevent shell injection
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let isResolved = false;

    // Collect stdout data
    childProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    // Collect stderr data
    childProcess.stderr.on("data", (data) => {
      stderr += data.toString();

      // Log only when we find RESOURCE_EXHAUSTED --> Usually when gemini-2.5-pro quota is exceeded
      if (stderr.includes("RESOURCE_EXHAUSTED")) {
        // Extract key information from the error
        const modelMatch = stderr.match(/Quota exceeded for quota metric '([^']+)'/);
        const statusMatch = stderr.match(/status["\s]*[:=]\s*(\d+)/);
        const reasonMatch = stderr.match(/"reason":\s*"([^"]+)"/);
        
        const model = modelMatch ? modelMatch[1] : "Unknown Model";
        const status = statusMatch ? statusMatch[1] : "429";
        const reason = reasonMatch ? reasonMatch[1] : "rateLimitExceeded";
        
        const errorJson = {
          error: {
            code: parseInt(status),
            message: `Quota exceeded for ${model}`,
            details: {
              model: model,
              reason: reason,
              statusText: "Too Many Requests"
            }
          }
        };
        
        Logger.error(`Gemini Quota Error: ${JSON.stringify(errorJson, null, 2)}`);
      }
    });

    // Handle process errors
    childProcess.on("error", (error) => {
      if (!isResolved) {
        isResolved = true;
        //clearInterval(progressInterval);
        Logger.error(`Process error:`, error);
        reject(new Error(`Failed to spawn command: ${error.message}`));
      }
    });

    // Handle process completion --> IMPORTANT: "[Gemini MCP] [57.8s] Process finished with exit code: 1 "
    childProcess.on("close", (code) => {
      if (!isResolved) {
        isResolved = true;
        //  clearInterval(progressInterval);

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