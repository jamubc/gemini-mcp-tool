import { spawn } from "child_process";
import { Logger } from "./logger.js";

// Sanitize command and arguments to prevent shell injection and flag injection
function sanitizeInput(input: string): string {
  // Remove or escape dangerous shell metacharacters
  let sanitized = input.replace(/[;&|`$(){}[\]<>]/g, '');
  // Prevent flag injection by removing leading dashes
  sanitized = sanitized.replace(/^-+/, '');
  return sanitized;
}

function validateCommand(command: string): boolean {
  // Only allow specific whitelisted commands
  const allowedCommands = ['gemini', 'gemini.exe', 'echo'];
  const baseCommand = command.split(/[/\\]/).pop()?.toLowerCase() || '';
  return allowedCommands.includes(baseCommand);
}

export async function executeCommand(
  command: string,
  args: string[],
  onProgress?: (newOutput: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Validate command before execution
    if (!validateCommand(command)) {
      reject(new Error(`Command not allowed: ${command}. Only gemini, gemini.exe, and npx are permitted.`));
      return;
    }

    // Sanitize arguments to prevent shell injection
    const sanitizedArgs = args.map(arg => sanitizeInput(arg));
    
    const startTime = Date.now();
    Logger.commandExecution(command, sanitizedArgs, startTime);

    const childProcess = spawn(command, sanitizedArgs, {
      env: process.env,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      cwd: process.cwd()
    });

    if (!childProcess.stdout || !childProcess.stderr) {
      childProcess.kill();
      reject(new Error("Process spawning failed: streams not available"));
      return;
    }

    let stdout = "";
    let stderr = "";
    let isResolved = false;
    let lastReportedLength = 0;
    
    childProcess.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
      
      // Report new content if callback provided
      if (onProgress && stdout.length > lastReportedLength) {
        const newContent = stdout.substring(lastReportedLength);
        lastReportedLength = stdout.length;
        onProgress(newContent);
      }
    });


    // CLI level errors
    childProcess.stderr.on("data", (data: Buffer) => {
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
    childProcess.on("error", (error: Error) => {
      if (!isResolved) {
        isResolved = true;
        Logger.error(`Process error:`, error);
        reject(new Error(`Failed to spawn command: ${error.message}`));
      }
    });
    childProcess.on("close", (code: number | null) => {
      if (!isResolved) {
        isResolved = true;
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