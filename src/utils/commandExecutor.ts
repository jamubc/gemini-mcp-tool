import { spawn } from "child_process";
import { Logger } from "./logger.js";

export async function executeCommand(
  command: string,
  args: string[],
  onProgress?: (newOutput: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    Logger.commandExecution(command, args, startTime);

    // Windows quirk: Node 22+ blocks spawning `.cmd` / `.bat` shims without
    // `shell: true` (CVE-2024-27980). But `shell: true` causes cmd.exe to
    // re-tokenise the argument list on whitespace, which mangles any prompt
    // that contains spaces (Gemini sees `-p Hello` plus stray positionals
    // `world.`). The fix is to enable the shell on Windows AND wrap any arg
    // containing whitespace or a double quote in cmd.exe-safe quotes
    // (internal `"` is escaped as `""`). This is a no-op on macOS / Linux.
    const isWindows = process.platform === "win32";
    const safeArgs = isWindows
      ? args.map(a => {
          const s = String(a);
          return /[\s"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
      : args;

    const childProcess = spawn(command, safeArgs, {
      env: process.env,
      shell: isWindows,
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Use array buffers for O(n) performance instead of O(n²) string concatenation
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    let isResolved = false;

    childProcess.stdout.on("data", (data) => {
      const chunk = data.toString();
      stdoutChunks.push(chunk);

      // Report immediately if callback provided (no substring calculation needed)
      if (onProgress) {
        onProgress(chunk);
      }
    });


    // CLI level errors
    childProcess.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderrChunks.push(chunk);
      // find RESOURCE_EXHAUSTED when gemini-2.5-pro quota is exceeded
      if (chunk.includes("RESOURCE_EXHAUSTED")) {
        const stderrSoFar = stderrChunks.join('');
        const modelMatch = stderrSoFar.match(/Quota exceeded for quota metric '([^']+)'/);
        const statusMatch = stderrSoFar.match(/status["\s]*[:=]\s*(\d+)/);
        const reasonMatch = stderrSoFar.match(/"reason":\s*"([^"]+)"/);
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
        // Join array buffers efficiently
        const stdout = stdoutChunks.join('');
        const stderr = stderrChunks.join('');

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