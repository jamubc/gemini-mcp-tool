import { spawn, execSync } from "child_process";
import { Logger } from "./logger.js";
import { CLI, ENV } from "../constants.js";

// Quote a single argument for cmd.exe (used by spawn's shell:true on Windows).
// Embedded quotes are doubled and backslash runs before a quote (or the closing
// quote) are doubled so they don't escape it, per CommandLineToArgvW rules. Note
// cmd still expands %VAR%/!VAR! inside quotes — an env read at worst, not RCE.
export function quoteForCmd(arg: string): string {
  const body = String(arg).replace(/(\\*)"/g, '$1$1""').replace(/(\\+)$/, '$1$1');
  return `"${body}"`;
}

export function selectWindowsGeminiCandidate(candidates: string[], command: string = CLI.COMMANDS.GEMINI): string {
  const byExt = (ext: string) => candidates.find((c) => c.toLowerCase().endsWith(ext));
  return byExt(".cmd") || byExt(".exe") || byExt(".bat") || `${command}.cmd`;
}

// Windows-only: find the real executable for the gemini command. The MCP server
// often runs without the user's interactive PATH, so we (1) honour an explicit
// GEMINI_CLI_PATH override, then (2) ask `where` and prefer shims that cmd.exe
// can actually launch. PowerShell shims and extensionless shell scripts are not
// selected as fallbacks. Resolution is cached per command for the life of the process.
const resolveCache = new Map<string, string>();
export function resolveCommandForExecution(command: string): string {
  if (process.platform !== "win32" || command !== CLI.COMMANDS.GEMINI) return command;

  const cached = resolveCache.get(command);
  if (cached) return cached;

  let resolved: string = command;
  const override = process.env[ENV.GEMINI_CLI_PATH]?.trim();
  if (override) {
    resolved = override;
  } else {
    try {
      const out = execSync(`where ${command}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const candidates = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      resolved = selectWindowsGeminiCandidate(candidates, command);
    } catch {
      resolved = `${command}.cmd`;
    }
  }

  resolveCache.set(command, resolved);
  return resolved;
}

// Actionable guidance when the executable can't be found (ENOENT). The most
// common cause is the MCP server not inheriting the user's interactive PATH.
export function buildEnoentErrorMessage(command: string): string {
  const isWindows = process.platform === "win32";
  const lines = [
    `Could not find the "${command}" executable.`,
    `The MCP server runs in its own process and may not inherit your shell's PATH.`,
    `• Verify it is installed and resolvable: \`${isWindows ? "where" : "which"} ${command}\`.`,
  ];
  if (command === CLI.COMMANDS.GEMINI) {
    lines.push(
      `• Install it: \`npm install -g @google/gemini-cli\`.`,
      isWindows
        ? `• Or set ${ENV.GEMINI_CLI_PATH} to the full path of the gemini shim (e.g. C:\\path\\to\\gemini.cmd).`
        : `• Or set ${ENV.GEMINI_CLI_PATH} to the full path of the gemini executable.`,
    );
  }
  return lines.join("\n");
}

export async function executeCommand(
  command: string,
  args: string[],
  onProgress?: (newOutput: string) => void,
  stdinData?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    Logger.commandExecution(command, args, startTime);

    const isWindows = process.platform === "win32";
    const resolvedCommand = resolveCommandForExecution(command);

    // Windows quirk: Node 22+ blocks spawning `.cmd` / `.bat` shims without
    // `shell: true` (CVE-2024-27980). But shell:true routes the command through
    // cmd.exe, which re-parses the joined line — so EVERY argument must be
    // quoted, not just those with whitespace. cmd metacharacters (& | < > ^ ( ))
    // trigger command injection even in tokens without spaces (e.g. a prompt
    // `a&calc`); wrapping each arg in double quotes makes them inert. This is a
    // no-op on macOS / Linux, where shell:false passes argv directly.
    const safeArgs = isWindows ? args.map(quoteForCmd) : args;
    // A resolved full path may contain spaces; quote it for cmd.exe. A bare
    // command name (no whitespace) passes through unchanged to preserve the
    // exact, already-tested shim-launch behaviour.
    const spawnCommand =
      isWindows && /\s/.test(resolvedCommand) ? `"${resolvedCommand}"` : resolvedCommand;

    // Complex prompts arrive on stdin (see geminiExecutor) to bypass cmd.exe
    // parsing and the OS command-line length limit; only open stdin then.
    // windowsHide suppresses the popup console window on Windows (no-op elsewhere).
    const childProcess = spawn(spawnCommand, safeArgs, {
      env: process.env,
      shell: isWindows,
      windowsHide: true,
      stdio: [stdinData !== undefined ? "pipe" : "ignore", "pipe", "pipe"],
    });

    if (stdinData !== undefined && childProcess.stdin) {
      // If the child has already exited/closed its stdin, write() emits EPIPE on
      // the stream; without this listener that becomes an uncaught exception and
      // crashes the (long-lived) MCP server.
      childProcess.stdin.on("error", (err) => {
        Logger.error(`stdin write failed: ${err instanceof Error ? err.message : String(err)}`);
      });
      childProcess.stdin.write(stdinData);
      childProcess.stdin.end();
    }

    let stdout = "";
    let stderr = "";
    let isResolved = false;
    let lastReportedLength = 0;

    childProcess.stdout?.on("data", (data) => {
      stdout += data.toString();

      // Report new content if callback provided
      if (onProgress && stdout.length > lastReportedLength) {
        const newContent = stdout.substring(lastReportedLength);
        lastReportedLength = stdout.length;
        onProgress(newContent);
      }
    });

    // CLI level errors
    childProcess.stderr?.on("data", (data) => {
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
      if (isResolved) return;
      isResolved = true;
      Logger.error(`Process error:`, error);
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        reject(new Error(buildEnoentErrorMessage(command)));
      } else {
        reject(new Error(`Failed to spawn command: ${error.message}`));
      }
    });
    childProcess.on("close", (code) => {
      if (isResolved) return;
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
    });
  });
}
