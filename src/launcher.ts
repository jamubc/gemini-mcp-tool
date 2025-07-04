#!/usr/bin/env node

/**
 * Launcher script that ensures the Gemini MCP server is always started with the
 * correct working directory. If an existing server is running with a different
 * cwd, it is terminated and a fresh instance is spawned. Users can override
 * the cwd explicitly via the `--cwd <path>` flag, but in most cases the
 * launcher will pass the shell's current directory automatically so absolute
 * paths "just work".
 *
 * ---------------------------------------------------------------------------
 * Why you may see repeated "[gemini-mcp] Reusing existing server in same cwd"   
 * log lines and what the launcher actually does:
 *
 * • When you execute `gemini-mcp` (or any npm script that resolves to it) the
 *   entrypoint is the **compiled** `dist/launcher.js` – this very file after
 *   TypeScript compilation.
 * • The launcher keeps a small JSON pid-file in
 *   `$TMPDIR/gemini-mcp-server.pid.json` containing `{ pid, cwd }` for the
 *   server it spawned previously.
 * • On every invocation it:
 *     – reads that pid-file (if it exists)  
 *     – calls `process.kill(pid, 0)` to verify the process is still alive  
 *     – compares the stored `cwd` with the cwd of the current shell
 * • If the process is alive **and** the cwd matches, the launcher prints
 *   `[gemini-mcp] Reusing existing server in same cwd: <cwd>` and exits early.
 *   The existing server (running in `dist/index.js`) continues to handle JSON-
 *   RPC traffic over stdio, so startup is instantaneous.
 *
 * Why there are two artefacts in `dist/`:
 *
 *   File                 | Role
 *   -------------------- | -----------------------------------------------------------
 *   `dist/launcher.js`   | Thin CLI wrapper implementing the singleton logic above.
 *   `dist/index.js`      | Full Gemini MCP server – loads tools, serves stdio.
 *
 * The corresponding source files are `src/launcher.ts` and `src/index.ts`.
 * Splitting responsibilities keeps the CLI fast while allowing the server to
 * remain more heavyweight.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

/** Location of the pid file that stores the last server's pid + cwd */
const PID_FILE = path.join(os.tmpdir(), 'gemini-mcp-server.pid.json');

interface PidFile { pid: number; cwd: string };

function readPidFile(): PidFile | null {
try {
    const raw = fs.readFileSync(PID_FILE, 'utf8');
    return JSON.parse(raw) as PidFile;
  } catch {
    return null;
  }
}

function writePidFile(data: PidFile) {
try {
    fs.writeFileSync(PID_FILE, JSON.stringify(data), 'utf8');
  } catch (err) {
    console.warn('[gemini-mcp] Unable to write PID file:', err);
  }
}

function isProcessAlive(pid: number) {
try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killProcess(pid: number) {
try {
    process.kill(pid, 'SIGTERM');
  } catch {
    /* ignored */
  }
}

// ---------------------------------------------------------------------------------
// 1. Parse CLI flags – we only care about --cwd, everything else is forwarded.
// ---------------------------------------------------------------------------------

const forwardArgs: string[] = [];
let overrideCwd: string | undefined;

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--cwd') {
    overrideCwd = process.argv[i + 1];
    i++; // skip next
  } else {
    forwardArgs.push(arg);
  }
}

const desiredCwd = overrideCwd ?? process.cwd();

// ---------------------------------------------------------------------------------
// 2. Handle existing server instance
// ---------------------------------------------------------------------------------

const existing = readPidFile();
if (existing && isProcessAlive(existing.pid)) {
  if (existing.cwd !== desiredCwd) {
    console.warn('[gemini-mcp] Detected running server in different cwd – restarting…');
    killProcess(existing.pid);
  } else {
    console.warn('[gemini-mcp] Reusing existing server in same cwd:', existing.cwd);
    // Exit early because the server is already running with correct cwd.
    process.exit(0);
  }
}

// ---------------------------------------------------------------------------------
// 3. Spawn the real server (dist/index.js) in the desired cwd
// ---------------------------------------------------------------------------------

const serverEntry = path.join(path.dirname(new URL(import.meta.url).pathname), 'index.js');

const child = spawn(process.execPath, [serverEntry, ...forwardArgs], {
  cwd: desiredCwd,
  stdio: 'inherit',
  env: { ...process.env, GEMINI_MCP_LAUNCHED: '1' },
});

writePidFile({ pid: child.pid ?? -1, cwd: desiredCwd });

child.on('exit', (code, signal) => {
  try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});

