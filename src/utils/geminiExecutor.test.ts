import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { ERROR_MESSAGES, MODELS } from "../constants.js";
import { executeGeminiCLI } from "./geminiExecutor.js";

const fakeGemini = `#!/usr/bin/env node
const { appendFileSync } = require("node:fs");

const args = process.argv.slice(2);
appendFileSync(process.env.FAKE_GEMINI_LOG, JSON.stringify({ args }) + "\\n");

const modelIndex = args.indexOf("-m");
const model = modelIndex === -1 ? "default" : args[modelIndex + 1];
const mode = process.env.FAKE_GEMINI_MODE;
const quota = ${JSON.stringify(ERROR_MESSAGES.QUOTA_EXCEEDED)};

if (mode === "success") {
  console.log(process.env.FAKE_GEMINI_SUCCESS_STDOUT || "success response");
  process.exit(0);
}

if (mode === "quota-then-flash" && model === ${JSON.stringify(MODELS.FLASH)}) {
  console.log("flash response");
  process.exit(0);
}

console.error(quota);
process.exit(1);
`;

let tempDir = "";
let logFile = "";
let originalEnv: Record<string, string | undefined> = {};

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

async function readCalls(): Promise<Array<{ args: string[] }>> {
  try {
    const content = await readFile(logFile, "utf8");
    return content.trim() ? content.trim().split("\n").map((line) => JSON.parse(line)) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function captureError(operation: Promise<unknown>): Promise<Error> {
  try {
    await operation;
  } catch (error) {
    assert(error instanceof Error);
    return error;
  }
  assert.fail("expected operation to throw");
}

beforeEach(async () => {
  originalEnv = {
    FAKE_GEMINI_LOG: process.env.FAKE_GEMINI_LOG,
    FAKE_GEMINI_MODE: process.env.FAKE_GEMINI_MODE,
    FAKE_GEMINI_SUCCESS_STDOUT: process.env.FAKE_GEMINI_SUCCESS_STDOUT,
    GEMINI_MCP_NO_FALLBACK: process.env.GEMINI_MCP_NO_FALLBACK,
    PATH: process.env.PATH,
  };

  tempDir = await mkdtemp(join(tmpdir(), "gemini-mcp-tool-"));
  logFile = join(tempDir, "calls.jsonl");
  await writeFile(join(tempDir, "gemini"), fakeGemini, { mode: 0o755 });

  process.env.FAKE_GEMINI_LOG = logFile;
  process.env.FAKE_GEMINI_MODE = "quota-then-flash";
  process.env.PATH = `${tempDir}${delimiter}${originalEnv.PATH ?? ""}`;
  delete process.env.GEMINI_MCP_NO_FALLBACK;
  delete process.env.FAKE_GEMINI_SUCCESS_STDOUT;
});

afterEach(async () => {
  for (const [name, value] of Object.entries(originalEnv)) {
    restoreEnv(name, value);
  }
  await rm(tempDir, { recursive: true, force: true });
});

describe("executeGeminiCLI --no-fallback gate", () => {
  it("propagates QUOTA_EXCEEDED unchanged when noFallback=true", async () => {
    const error = await captureError(
      executeGeminiCLI("hello", MODELS.PRO, false, false, undefined, true)
    );

    assert.equal(error.message, `gemini failed: ${ERROR_MESSAGES.QUOTA_EXCEEDED}`);
    assert.equal((await readCalls()).length, 1);
  });

  it("attempts flash fallback when noFallback=false", async () => {
    const result = await executeGeminiCLI("hello", MODELS.PRO, false, false, undefined, false);
    const calls = await readCalls();

    assert.equal(result, "flash response");
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].args.slice(0, 2), ["-m", MODELS.FLASH]);
  });

  it("GEMINI_MCP_NO_FALLBACK=1 env var triggers gate without explicit flag", async () => {
    process.env.GEMINI_MCP_NO_FALLBACK = "1";

    const error = await captureError(
      executeGeminiCLI("hello", MODELS.PRO, false, false, undefined)
    );

    assert.equal(error.message, `gemini failed: ${ERROR_MESSAGES.QUOTA_EXCEEDED}`);
    assert.equal((await readCalls()).length, 1);
  });

  it("normal success path with noFallback=true completes without error", async () => {
    process.env.FAKE_GEMINI_MODE = "success";
    process.env.FAKE_GEMINI_SUCCESS_STDOUT = "good response";

    const result = await executeGeminiCLI("hello", MODELS.PRO, false, false, undefined, true);

    assert.equal(result, "good response");
    assert.equal((await readCalls()).length, 1);
  });
});
