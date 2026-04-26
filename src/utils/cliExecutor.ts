import { spawn } from "node:child_process";

export interface CliExecutionOptions {
  command: string;
  args: readonly string[];
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface CliExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class CliExecutionError extends Error {
  readonly result?: CliExecutionResult;

  constructor(message: string, result?: CliExecutionResult) {
    super(message);
    this.name = "CliExecutionError";
    this.result = result;
  }
}

export async function executeCliCommand(options: CliExecutionOptions): Promise<CliExecutionResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.command, [...options.args], {
      env: options.env ?? process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      settle(() => {
        child.kill("SIGTERM");
        reject(new CliExecutionError(`${options.command} timed out after ${options.timeoutMs}ms`, {
          stdout,
          stderr,
          exitCode: -1,
        }));
      });
    }, options.timeoutMs);

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };

    child.stdout?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      options.onStdout?.(chunk);
    });

    child.stderr?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      options.onStderr?.(chunk);
    });

    child.on("error", (error) => {
      settle(() => reject(new CliExecutionError(`Failed to spawn ${options.command}: ${error.message}`, {
        stdout,
        stderr,
        exitCode: -1,
      })));
    });

    child.on("close", (code) => {
      const exitCode = code ?? 0;
      const result = { stdout, stderr, exitCode };

      settle(() => {
        if (exitCode === 0) {
          resolve(result);
          return;
        }

        const detail = stderr.trim() || stdout.trim() || `exit code ${exitCode}`;
        reject(new CliExecutionError(`${options.command} failed: ${detail}`, result));
      });
    });
  });
}
