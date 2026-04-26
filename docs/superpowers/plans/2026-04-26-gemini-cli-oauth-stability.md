# Gemini CLI OAuth Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `jacobcxdev/gemini-mcp-tool` preserve Gemini CLI OAuth while preventing the MCP stdio server from disconnecting after successful `ask-gemini` calls.

**Architecture:** Keep the MCP server as a stdio server and keep Gemini execution delegated to the installed `gemini` CLI (`gemini -p ...`) so OAuth remains owned by Google’s CLI. Modernise/harden the server lifecycle and child-process boundary so Gemini child exits, timeouts, and errors are returned as tool results rather than terminating the MCP server.

**Tech Stack:** TypeScript, Node.js, `@modelcontextprotocol/sdk`, `child_process.spawn`, existing `gemini` CLI OAuth configuration, Claude Code MCP.

---

## File Structure

- `src/utils/cliExecutor.ts` — create a focused child-process executor for `gemini` and other CLI commands. It owns timeout, stdout/stderr capture, process cleanup, and converts child failures into typed errors.
- `src/tools/ask-gemini.tool.ts` — modify to call the CLI executor rather than any direct SDK/API-key implementation. It must never require `GEMINI_API_KEY`.
- `src/tools/simple-tools.ts` — keep or adjust `ping`/`help` to use the CLI executor for `gemini -help` where needed.
- `src/index.ts` — modify server startup and top-level error handlers so runtime errors are logged without treating child-process failures as fatal MCP server failures.
- `src/constants.ts` — keep CLI constants and remove any API-key-oriented constants if present.
- `package.json` and `package-lock.json` — update package metadata for the fork and, if required, update `@modelcontextprotocol/sdk` to a modern compatible version.
- `README.md` — update installation, ownership, OAuth, and fork-specific instructions so users do not install the upstream package by mistake.
- `docs/installation.md`, `docs/getting-started.md`, `docs/index.md`, `docs/api.md` — update user-facing docs to reflect the fork, local/GitHub installation, CLI OAuth, and no API-key requirement.
- `scripts/test-mcp-stability.mjs` — create a lightweight local smoke test that repeatedly calls the built MCP server through the MCP SDK client or, if SDK client setup is too heavy, repeatedly invokes the internal executor and documents manual Claude Code validation.

---

### Task 1: Baseline the Fork and Install Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Check the initial repo state**

Run:

```bash
cd /Users/jacob/Developer/src/github/jacobcxdev/gemini-mcp-tool
git status --short --branch
npm install
npm run build
```

Expected:

```text
## main...origin/main
```

`npm install` should complete successfully. `npm run build` should either pass or reveal current TypeScript errors that must be handled before changing behaviour.

- [ ] **Step 2: Update package metadata for the fork**

Edit `package.json` so these fields identify the fork and do not direct users to upstream for support:

```json
{
  "name": "@jacobcxdev/gemini-mcp-tool",
  "description": "MCP server for Gemini CLI OAuth integration",
  "author": "Jacob Clayden",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/jacobcxdev/gemini-mcp-tool.git"
  },
  "bugs": {
    "url": "https://github.com/jacobcxdev/gemini-mcp-tool/issues"
  },
  "homepage": "https://github.com/jacobcxdev/gemini-mcp-tool#readme"
}
```

Keep the existing `bin` name unless there is a collision in testing:

```json
{
  "bin": {
    "gemini-mcp": "dist/index.js"
  }
}
```

- [ ] **Step 3: Upgrade MCP SDK only if the current build proves outdated or incompatible**

If `package.json` still has `@modelcontextprotocol/sdk` at `^0.5.0`, update it to the latest compatible `^1.x` release used by the currently installed fork line:

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0"
  }
}
```

Run:

```bash
npm install
npm run build
```

Expected: TypeScript either passes or fails with import/type errors that identify the exact MCP SDK API changes to apply in Task 4.

- [ ] **Step 4: Commit metadata/dependency baseline**

Run:

```bash
git add package.json package-lock.json
git commit -m "chore: identify fork package metadata"
```

Expected: commit succeeds.

---

### Task 2: Add a Hardened CLI Executor

**Files:**
- Create: `src/utils/cliExecutor.ts`
- Test manually through: `npm run build`

- [ ] **Step 1: Create the executor file**

Create `src/utils/cliExecutor.ts` with this implementation:

```typescript
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

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };

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
```

- [ ] **Step 2: Build to verify the executor compiles**

Run:

```bash
npm run build
```

Expected: PASS, or only unrelated pre-existing errors from the current codebase.

- [ ] **Step 3: Commit executor**

Run:

```bash
git add src/utils/cliExecutor.ts
git commit -m "feat: add hardened CLI executor"
```

Expected: commit succeeds.

---

### Task 3: Route Gemini Calls Through CLI OAuth

**Files:**
- Modify: `src/tools/ask-gemini.tool.ts`
- Modify: `src/tools/simple-tools.ts` if help uses direct SDK/API-key code
- Modify: `src/constants.ts` if API-key constants exist

- [ ] **Step 1: Inspect current tool implementation**

Run:

```bash
grep -rnE "@google/genai|GEMINI_API_KEY|GoogleGenAI|generateContentStream|executeCliCommand|spawn\(" src
```

Expected: any direct SDK/API-key references are identified before editing.

- [ ] **Step 2: Replace direct Gemini execution with CLI execution**

In `src/tools/ask-gemini.tool.ts`, ensure the execution path builds CLI arguments like this:

```typescript
import { CLI } from "../constants.js";
import { executeCliCommand } from "../utils/cliExecutor.js";

const FIVE_MINUTES_MS = 300_000;

export async function executeGeminiCliPrompt(
  prompt: string,
  model?: string,
  onOutput?: (chunk: string) => void,
): Promise<string> {
  const args = model && model !== CLI.DEFAULTS.MODEL
    ? [CLI.FLAGS.MODEL, model, CLI.FLAGS.PROMPT, prompt]
    : [CLI.FLAGS.PROMPT, prompt];

  const result = await executeCliCommand({
    command: CLI.COMMANDS.GEMINI,
    args,
    timeoutMs: FIVE_MINUTES_MS,
    onStdout: onOutput,
    onStderr: onOutput,
  });

  return result.stdout.trim();
}
```

Then ensure the tool handler calls `executeGeminiCliPrompt(prompt, model, progressCallback)` and returns the resulting text.

- [ ] **Step 3: Remove any API key validation**

If any source file checks for `process.env.GEMINI_API_KEY`, remove that check. This fork must rely on the installed `gemini` CLI auth state.

After editing, run:

```bash
grep -rnE "GEMINI_API_KEY|GoogleGenAI|generateContentStream|@google/genai" src package.json
```

Expected: no matches.

- [ ] **Step 4: Build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit CLI OAuth route**

Run:

```bash
git add src/tools/ask-gemini.tool.ts src/tools/simple-tools.ts src/constants.ts package.json package-lock.json
git commit -m "fix: route Gemini calls through CLI OAuth"
```

Expected: commit succeeds. If one listed file is unchanged, omit it from `git add`.

---

### Task 4: Harden MCP Server Lifecycle

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add top-level process error handlers**

Near the top of `src/index.ts`, add handlers that log but do not call `process.exit` for recoverable async errors:

```typescript
process.on("unhandledRejection", (reason) => {
  Logger.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  Logger.error("Uncaught exception:", error);
});
```

- [ ] **Step 2: Keep startup fatal only for startup failure**

Ensure `main().catch(...)` only exits when server startup fails:

```typescript
main().catch((error) => {
  Logger.error("Fatal startup error:", error);
  process.exit(1);
});
```

- [ ] **Step 3: Ensure tool execution errors stay inside tool responses**

Verify `CallToolRequestSchema` catches `executeTool` errors and returns:

```typescript
return {
  content: [
    {
      type: "text",
      text: `Error executing ${toolName}: ${errorMessage}`,
    },
  ],
  isError: true,
};
```

Do not throw child-process errors past the tool handler.

- [ ] **Step 4: Build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit lifecycle hardening**

Run:

```bash
git add src/index.ts
git commit -m "fix: keep MCP server alive after tool failures"
```

Expected: commit succeeds.

---

### Task 5: Add Stability Smoke Test Script

**Files:**
- Create: `scripts/test-mcp-stability.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add a repeat-call smoke test script**

Create `scripts/test-mcp-stability.mjs`:

```javascript
#!/usr/bin/env node
import { spawn } from "node:child_process";

const iterations = Number.parseInt(process.argv[2] ?? "10", 10);

async function runGeminiPing(iteration) {
  return new Promise((resolve, reject) => {
    const child = spawn("gemini", ["-p", `Reply with exactly: pong ${iteration}`], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`iteration ${iteration} timed out`));
    }, 120_000);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        console.error(`iteration ${iteration}: ok`);
        resolve(stdout.trim());
        return;
      }

      reject(new Error(`iteration ${iteration} failed with ${code}: ${stderr.trim()}`));
    });
  });
}

for (let iteration = 1; iteration <= iterations; iteration += 1) {
  const output = await runGeminiPing(iteration);
  if (!output.includes(`pong ${iteration}`)) {
    throw new Error(`iteration ${iteration} returned unexpected output: ${output}`);
  }
}

console.error(`${iterations} Gemini CLI OAuth calls completed successfully`);
```

- [ ] **Step 2: Add npm scripts**

In `package.json`, add:

```json
{
  "scripts": {
    "smoke:gemini-cli": "node scripts/test-mcp-stability.mjs 10",
    "verify": "npm run build && npm run smoke:gemini-cli"
  }
}
```

Preserve existing scripts.

- [ ] **Step 3: Run the smoke test**

Run:

```bash
npm run build
npm run smoke:gemini-cli
```

Expected:

```text
10 Gemini CLI OAuth calls completed successfully
```

- [ ] **Step 4: Commit smoke test**

Run:

```bash
git add scripts/test-mcp-stability.mjs package.json package-lock.json
git commit -m "test: add Gemini CLI OAuth smoke test"
```

Expected: commit succeeds.

---

### Task 6: Update README and Documentation for the Fork

**Files:**
- Modify: `README.md`
- Modify: `docs/installation.md`
- Modify: `docs/getting-started.md`
- Modify: `docs/index.md`
- Modify: `docs/api.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Replace misleading upstream install commands**

Update `README.md` and `docs/installation.md` so Claude Code installation uses this local/GitHub fork path while it remains unpublished:

```bash
claude mcp remove gemini-cli -s user
claude mcp add gemini-cli -s user -- node /Users/jacob/Developer/src/github/jacobcxdev/gemini-mcp-tool/dist/index.js
```

Also document the development install flow:

```bash
cd /Users/jacob/Developer/src/github/jacobcxdev/gemini-mcp-tool
npm install
npm run build
```

- [ ] **Step 2: State authentication clearly**

Add this text to `README.md` and `docs/getting-started.md`:

```markdown
This fork uses the installed `gemini` CLI for all model calls. Authentication is handled by the Gemini CLI’s OAuth flow, so this server does not require `GEMINI_API_KEY` and does not use the Google GenAI SDK directly.

Before configuring the MCP server, verify the CLI works:

```bash
gemini -p ping
```
```

- [ ] **Step 3: Update project ownership links**

Replace these references where present:

```text
https://github.com/jamubc/gemini-mcp-tool
https://jamubc.github.io/gemini-mcp-tool/
npx -y gemini-mcp-tool
```

With fork-aware references:

```text
https://github.com/jacobcxdev/gemini-mcp-tool
local node dist/index.js installation until published
```

Keep an attribution note:

```markdown
Forked from `jamubc/gemini-mcp-tool`; this fork focuses on Claude Code stability while preserving Gemini CLI OAuth.
```

- [ ] **Step 4: Add stability validation instructions**

Add a troubleshooting section:

```markdown
## Stability smoke test

Run this before registering the MCP server:

```bash
npm run verify
```

Then test through Claude Code:

1. Run `/mcp` and confirm `gemini-cli` is connected.
2. Call `mcp__gemini-cli__ping`.
3. Call `mcp__gemini-cli__ask-gemini` 10 times with short prompts.
4. Run `/mcp` again and confirm the server stayed connected.
```

- [ ] **Step 5: Update changelog**

Add a top entry to `CHANGELOG.md`:

```markdown
## Unreleased

- Preserve Gemini CLI OAuth by routing model calls through the installed `gemini` binary.
- Harden child-process handling so Gemini command completion does not terminate the MCP stdio server.
- Update fork documentation and installation instructions for `jacobcxdev/gemini-mcp-tool`.
```

- [ ] **Step 6: Verify docs no longer mislead**

Run:

```bash
grep -rnE "jamubc.github.io|npx -y gemini-mcp-tool|GEMINI_API_KEY|Google GenAI SDK|@google/genai" README.md docs package.json
```

Expected: no misleading install/API-key references remain. Attribution-only upstream links are acceptable if clearly labelled as upstream.

- [ ] **Step 7: Build docs if configured**

Run:

```bash
npm run docs:build
```

Expected: PASS.

- [ ] **Step 8: Commit documentation updates**

Run:

```bash
git add README.md docs/installation.md docs/getting-started.md docs/index.md docs/api.md CHANGELOG.md
git commit -m "docs: update fork installation and OAuth guidance"
```

Expected: commit succeeds.

---

### Task 7: Register and Validate the Local MCP Server in Claude Code

**Files:**
- No source files unless validation finds a defect.

- [ ] **Step 1: Build final dist**

Run:

```bash
npm run build
```

Expected: PASS and `dist/index.js` exists.

- [ ] **Step 2: Replace current MCP server registration**

Run:

```bash
claude mcp remove gemini-cli -s user
claude mcp add gemini-cli -s user -- node /Users/jacob/Developer/src/github/jacobcxdev/gemini-mcp-tool/dist/index.js
claude mcp get gemini-cli
```

Expected: `gemini-cli` points at the fork’s `dist/index.js` and has no `GEMINI_API_KEY` environment requirement.

- [ ] **Step 3: Restart or reconnect MCP**

In Claude Code, use `/mcp` to reconnect the server if needed.

Expected: `gemini-cli` shows connected.

- [ ] **Step 4: Validate through MCP tool calls**

Call these tools from Claude Code:

```text
mcp__gemini-cli__ping
mcp__gemini-cli__ask-gemini prompt="Reply with exactly: pong 1"
mcp__gemini-cli__ask-gemini prompt="Reply with exactly: pong 2"
mcp__gemini-cli__ask-gemini prompt="Reply with exactly: pong 3"
```

Then repeat short `ask-gemini` calls until 10 total successful responses have returned.

Expected: all calls return, and `/mcp` still reports `gemini-cli` connected without manual reconnection.

- [ ] **Step 5: Commit validation notes only if source changed during validation**

If validation required code or docs changes, commit them:

```bash
git status --short
git add <changed-files>
git commit -m "fix: stabilise Claude Code MCP validation"
```

Expected: no commit if no files changed.

---

## Self-Review

- Spec coverage: The plan covers preserving Gemini CLI OAuth, avoiding `GEMINI_API_KEY`, hardening child process lifecycle, validating repeated calls, and updating README/docs to avoid upstream-misleading installation instructions.
- Placeholder scan: No `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: `executeCliCommand`, `CliExecutionOptions`, `CliExecutionResult`, and `executeGeminiCliPrompt` are named consistently across tasks.
- Scope check: This is one subsystem: a Gemini CLI-backed MCP server fork. Publishing to npm is intentionally out of scope until local validation passes.
