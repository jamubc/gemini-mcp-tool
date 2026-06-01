// Shared harness for the live e2e suite. Spawns the REAL MCP server (the built
// dist/index.js) over stdio and connects with the MCP SDK client — the same way
// a real client (Claude, mcpjam, etc.) does. Tool calls therefore exercise the
// entire product: protocol -> registry -> tool -> backend -> spawned gemini CLI.
//
// This file is intentionally not named *.test.ts so the runner does not execute
// it directly.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { TestContext } from "node:test";
import { inspect } from "node:util";
import { fileURLToPath } from "node:url";
import { CLI } from "../../src/constants.js";
import { resolveCommandForExecution } from "../../src/utils/commandExecutor.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, "..", "..");
const SERVER_ENTRY = path.join(REPO_ROOT, "dist", "index.js");

/** True when the real gemini CLI is installed and resolvable on PATH. */
export function hasGemini(): boolean {
  const isWindows = process.platform === "win32";
  const command = resolveCommandForExecution(CLI.COMMANDS.GEMINI);
  const executable = isWindows && /\s/.test(command) ? `"${command.replace(/"/g, '""')}"` : command;
  const result = spawnSync(executable, ["--version"], {
    stdio: "ignore",
    shell: isWindows,
    windowsHide: true,
  });
  return result.status === 0;
}

/** Skip reason for gemini-dependent tests, or false when gemini is available. */
export const GEMINI_SKIP: string | false = hasGemini()
  ? false
  : "gemini CLI not on PATH — run `npm i -g @google/gemini-cli` and authenticate";

export interface ServerHandle {
  client: Client;
  cwd?: string;
  close: () => Promise<void>;
}

/** Start the built MCP server and return a connected client. */
export async function startServer(
  extraEnv: Record<string, string> = {},
  cwd?: string
): Promise<ServerHandle> {
  if (!existsSync(SERVER_ENTRY)) {
    throw new Error(
      `Server entry not found at ${SERVER_ENTRY}. Run \`npm run build\` first ` +
        `(\`npm run test:e2e\` does this for you).`,
    );
  }

  // Pass the parent environment through (PATH so gemini resolves, HOME so the
  // gemini auth/config is found), plus any per-test overrides.
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") env[k] = v;
  }
  Object.assign(env, extraEnv);

  const isWindows = process.platform === "win32";
  const transport = cwd
    ? new StdioClientTransport({
        command: isWindows ? "cmd.exe" : "sh",
        args: isWindows
          ? ["/c", `cd /d "${cwd}" && "${process.execPath}" "${SERVER_ENTRY}"`]
          : ["-c", `cd "${cwd}" && "${process.execPath}" "${SERVER_ENTRY}"`],
        env,
        stderr: "inherit",
      })
    : new StdioClientTransport({
        command: process.execPath,
        args: [SERVER_ENTRY],
        env,
        stderr: "inherit",
      });
  const client = new Client({ name: "gmcpt-e2e", version: "0.0.0" }, { capabilities: {} });
  await client.connect(transport);

  return { client, cwd, close: () => transport.close() };
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    const raw: Record<string, unknown> = {
      name: value.name,
      message: value.message,
    };
    for (const key of Object.getOwnPropertyNames(value)) {
      if (key !== "stack") raw[key] = (value as unknown as Record<string, unknown>)[key];
    }
    return raw;
  }
  return value;
}

function formatRaw(value: unknown): string {
  try {
    const json = JSON.stringify(value, jsonReplacer, 2);
    if (json !== undefined) return json;
  } catch {
    // Fall back to inspect for unexpected non-JSON SDK objects.
  }
  return inspect(value, {
    depth: null,
    maxArrayLength: null,
    maxStringLength: null,
    breakLength: 100,
  });
}

export function rawResponse(
  t: TestContext,
  label: string,
  value: unknown,
  inputArgs?: unknown,
  cwd?: string
): void {
  const border = "=".repeat(60);
  const resolvedCwd = cwd || process.cwd();
  const cwdSection = `\n📂 SPAWNED CWD: ${resolvedCwd}`;
  const inputSection = inputArgs 
    ? `\n👉 INPUT ARGUMENTS:\n${JSON.stringify(inputArgs, null, 2)}`
    : "";
  t.diagnostic(
    `\n${border}\n[E2E DIAGNOSTIC] ${label}${cwdSection}${inputSection}\n\n📥 RAW RESPONSE:\n${formatRaw(value)}\n${border}\n`
  );
}

export async function listTools(t: TestContext, server: ServerHandle) {
  const result = await server.client.listTools();
  rawResponse(t, "tools/list", result, undefined, server.cwd);
  return result;
}

export async function listPrompts(t: TestContext, server: ServerHandle) {
  const result = await server.client.listPrompts();
  rawResponse(t, "prompts/list", result, undefined, server.cwd);
  return result;
}

export async function callTool(
  t: TestContext,
  server: ServerHandle,
  params: Parameters<Client["callTool"]>[0],
) {
  const result = await server.client.callTool(params);
  rawResponse(t, `tools/call ${params.name}`, result, params.arguments, server.cwd);
  return result;
}

/**
 * Call a tool whose assertions depend on the live MODEL output, retrying on a
 * transient empty/errored response (the model occasionally returns nothing).
 * This verifies we eventually get a *valid* response without masking a real,
 * persistent failure. Each attempt's raw response is printed. Use plain
 * `callTool` for tools whose checks are deterministic (e.g. the session marker,
 * `gemini --help`) so they aren't retried needlessly.
 */
export async function callGemini(
  t: TestContext,
  server: ServerHandle,
  params: Parameters<Client["callTool"]>[0],
  retries = 2,
): Promise<{ isError: boolean; text: string }> {
  let isError = false;
  let text = "";
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const res = await server.client.callTool(params);
    isError = (res as { isError?: boolean }).isError ?? false;
    text = textOf(res);
    rawResponse(t, `tools/call ${params.name}${attempt > 1 ? ` (attempt ${attempt})` : ""}`, res, params.arguments, server.cwd);
    if (!isError && text.trim().length > 0) break;
    if (attempt <= retries) {
      t.diagnostic(`${params.name}: empty/errored response — retrying (${attempt}/${retries})`);
    }
  }
  return { isError, text };
}

/**
 * Concatenate the text parts of a tool result. Typed as `unknown` because the
 * SDK's callTool return is a union (the back-compat shape has no `content`);
 * we narrow structurally here.
 */
export function textOf(result: unknown): string {
  const content = (result as { content?: Array<{ type?: string; text?: string }> }).content ?? [];
  return content
    .filter((c) => c?.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("\n");
}
