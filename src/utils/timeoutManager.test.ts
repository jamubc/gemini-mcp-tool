import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTimeoutMs, DEFAULT_COMMAND_TIMEOUT_MS } from "./timeoutManager.js";

test("resolveTimeoutMs: default when unset or blank", () => {
  assert.equal(resolveTimeoutMs({}), DEFAULT_COMMAND_TIMEOUT_MS);
  assert.equal(resolveTimeoutMs({ GEMINI_MCP_TIMEOUT_MS: "" }), DEFAULT_COMMAND_TIMEOUT_MS);
  assert.equal(resolveTimeoutMs({ GEMINI_MCP_TIMEOUT_MS: "   " }), DEFAULT_COMMAND_TIMEOUT_MS);
});

test("resolveTimeoutMs: honours a positive override", () => {
  assert.equal(resolveTimeoutMs({ GEMINI_MCP_TIMEOUT_MS: "5000" }), 5000);
});

test("resolveTimeoutMs: 0, negative, or invalid disables the timeout (returns 0)", () => {
  assert.equal(resolveTimeoutMs({ GEMINI_MCP_TIMEOUT_MS: "0" }), 0);
  assert.equal(resolveTimeoutMs({ GEMINI_MCP_TIMEOUT_MS: "-1" }), 0);
  assert.equal(resolveTimeoutMs({ GEMINI_MCP_TIMEOUT_MS: "abc" }), 0);
});
