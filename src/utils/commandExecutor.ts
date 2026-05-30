import { spawn } from "child_process";
import { Logger } from "./logger.js";

// Quote a single argument for cmd.exe (used by spawn's shell:true on Windows).
// Embedded quotes are doubled and backslash runs before a quote (or the closing
// quote) are doubled so they don't escape it, per CommandLineToArgvW rules. Note
// cmd still expands %VAR%/!VAR! inside quotes — an env read at worst, not RCE.
function quoteForCmd(arg: string): string {
  const body = String(arg).replace(/(\\*)"/g, '$1$1""').replace(/(\\+)$/, '$1$1');
  return `"${body}"`;
}

export async function executeCommand(
  command: string,
  args: string[],
  onProgress?: (newOutput: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    Logger.commandExecution(command, args, startTime);

    // Windows quirk: Node 22+ blocks spawning `.cmd` / `.bat` shims without
    // `shell: true` (CVE-2024-27980). But shell:true routes the command through
    // cmd.exe, which re-parses the joined line — so EVERY argument must be
    // quoted, not just those with whitespace. cmd metacharacters (& | < > ^ ( ))
    // trigger command injection even in tokens without spaces (e.g. a prompt
    // `a&calc`); wrapping each arg in double quotes makes them inert. This is a
    // no-op on macOS / Linux, where shell:false passes argv directly.
    const isWindows = process.platform === "win32";
    const safeArgs = isWindows ? args.map(quoteForCmd) : args;

    const childProcess = spawn(command, safeArgs, {
      env: process.env,
      shell: isWindows,
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