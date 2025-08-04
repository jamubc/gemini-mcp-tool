import { spawn } from "child_process";
import { Logger } from "./logger.js";
import * as os from "os";
import * as path from "path";

// Windows compatibility: PowerShell execution helper
function executeCommandWithPipedInput(
  command: string,
  args: string[],
  input: string,
  powershellPath?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const isWindows = os.platform() === "win32";
    let actualCommand: string;
    let actualArgs: string[];

    if (isWindows) {
      // Use PowerShell for better Windows compatibility
      const psPath = powershellPath || "powershell.exe";
      const fullCommand = `${command} ${args.join(" ")}`;
      actualCommand = psPath;
      actualArgs = ["-Command", `$input | ${fullCommand}`];
    } else {
      actualCommand = command;
      actualArgs = args;
    }

    const childProcess = spawn(actualCommand, actualArgs, {
      env: process.env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    childProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    childProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    childProcess.on("error", (error) => {
      reject(new Error(`Failed to spawn command: ${error.message}`));
    });

    childProcess.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        const errorMessage = stderr.trim() || "Unknown error";
        reject(new Error(`Command failed with exit code ${code}: ${errorMessage}`));
      }
    });

    // Send input to the process
    if (childProcess.stdin) {
      childProcess.stdin.write(input);
      childProcess.stdin.end();
    }
  });
}

export async function executeCommand(
  command: string,
  args: string[],
  onProgress?: (newOutput: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    Logger.commandExecution(command, args, startTime);

    // Windows compatibility: Enhanced environment setup
    const isWindows = os.platform() === "win32";
    const enhancedEnv = { ...process.env };
    
    if (isWindows) {
      // Add common Node.js paths for Windows
      const commonPaths = [
        path.join(os.homedir(), "AppData", "Roaming", "npm"),
        path.join(os.homedir(), "AppData", "Local", "npm"),
        "C:\\Program Files\\nodejs",
        "C:\\Program Files (x86)\\nodejs"
      ];
      
      const currentPath = enhancedEnv.PATH || "";
      const newPaths = commonPaths.filter(p => !currentPath.includes(p));
      if (newPaths.length > 0) {
        enhancedEnv.PATH = currentPath + ";" + newPaths.join(";");
      }
    }

    const childProcess = spawn(command, args, {
      env: enhancedEnv,
      shell: isWindows, // Use shell on Windows for better compatibility
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let isResolved = false;
    let lastReportedLength = 0;
    
    childProcess.stdout.on("data", (data) => {
      stdout += data.toString();
      
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