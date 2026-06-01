import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEnv } from "../../../src/utils/envFile.js";

test("parseEnv: basic KEY=VALUE pairs", () => {
  const r = parseEnv("GEMINI_MODEL=gemini-2.5-pro\nGEMINI_MCP_TIMEOUT_MS=1800000");
  assert.equal(r.GEMINI_MODEL, "gemini-2.5-pro");
  assert.equal(r.GEMINI_MCP_TIMEOUT_MS, "1800000");
});

test("parseEnv: skips blanks and # comments", () => {
  const r = parseEnv("# a comment\n\n  # indented comment\nGEMINI_MODEL=x\n");
  assert.deepEqual(Object.keys(r), ["GEMINI_MODEL"]);
  assert.equal(r.GEMINI_MODEL, "x");
});

test("parseEnv: strips one layer of matching quotes and honours `export`", () => {
  const r = parseEnv(`export GEMINI_MODEL="gemini 2.5"\nGEMINI_CLI_PATH='/a/b c/gemini'`);
  assert.equal(r.GEMINI_MODEL, "gemini 2.5");
  assert.equal(r.GEMINI_CLI_PATH, "/a/b c/gemini");
});

test("parseEnv: keeps '=' inside values and trims surrounding whitespace", () => {
  const r = parseEnv("  GEMINI_MODEL = a=b=c  \nGEMINI_FLASH_MODEL=  flash  ");
  assert.equal(r.GEMINI_MODEL, "a=b=c");
  assert.equal(r.GEMINI_FLASH_MODEL, "flash");
});

test("parseEnv: ignores malformed lines without '='", () => {
  const r = parseEnv("NOT_AN_ASSIGNMENT\nGEMINI_MODEL=ok");
  assert.equal(r.NOT_AN_ASSIGNMENT, undefined);
  assert.equal(r.GEMINI_MODEL, "ok");
});
