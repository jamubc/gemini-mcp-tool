import { spawn, SpawnOptionsWithoutStdio } from 'child_process';

export type ExecResult =
  | { ok: true; out: string }
  | { ok: false; code: number; err: string };

/**
 * Filters out known Node.js warning messages from stderr
 */
function filterNodeWarnings(text: string): string {
  // List of patterns to filter out
  const warningPatterns = [
    /\(node:\d+\) \[MODULE_TYPELESS_PACKAGE_JSON\] Warning:.*/g,
    /\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)/g,
    /ExperimentalWarning: .*/g,
    /DeprecationWarning: .*/g,
    /\(node:\d+\) Warning: .*/g,
  ];
  
  let filtered = text;
  for (const pattern of warningPatterns) {
    filtered = filtered.replace(pattern, '');
  }
  
  // Remove empty lines created by filtering
  return filtered.split('\n')
    .filter(line => line.trim().length > 0)
    .join('\n');
}

/**
 * Executes a shell command with streaming output.
 * - Streams stdout/stderr to the parent process
 * - Auto-injects --no-pager for git commands
 * - Filters out Node.js module warnings from stderr
 * @param command The command to run
 * @param args Arguments for the command
 * @param opts Spawn options (e.g., cwd, env)
 * @returns ExecResult indicating success or failure
 */
export async function runShell(
  command: string,
  args: string[] = [],
  opts?: SpawnOptionsWithoutStdio
): Promise<ExecResult> {
  const finalArgs = command === 'git' ? ['--no-pager', ...args] : args;
  return new Promise(resolve => {
    const child = spawn(command, finalArgs, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...opts,
    });

    let out = '';
    let err = '';

    if (child.stdout) {
      child.stdout.on('data', data => {
        const text = data.toString();
        process.stdout.write(text);
        out += text;
      });
    }

    if (child.stderr) {
      child.stderr.on('data', data => {
        const text = data.toString();
        // Filter out Node.js warnings before streaming
        const filteredText = filterNodeWarnings(text);
        if (filteredText.trim()) {
          process.stderr.write(filteredText);
        }
        err += text; // Keep original for error reporting
      });
    }

    child.on('close', code => {
      if (code === 0) {
        resolve({ ok: true, out });
      } else {
        // Filter Node warnings from error output as well
        const filteredErr = filterNodeWarnings(err);
        resolve({ ok: false, code: code || 0, err: filteredErr || err });
      }
    });

    child.on('error', error => {
      resolve({ ok: false, code: -1, err: error.message });
    });
  });
}

