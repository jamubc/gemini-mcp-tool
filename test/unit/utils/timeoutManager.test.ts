import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTimeoutMs, RECOMMENDED_TIMEOUT_MS } from "../../../src/utils/timeoutManager.js";

test("resolveTimeoutMs: disabled by default when unset or blank (1.1.6 parity)", () => {
  assert.equal(resolveTimeoutMs({}), 0);
  assert.equal(resolveTimeoutMs({ GEMINI_MCP_TIMEOUT_MS: "" }), 0);
  assert.equal(resolveTimeoutMs({ GEMINI_MCP_TIMEOUT_MS: "   " }), 0);
});

test("resolveTimeoutMs: honours a positive override", () => {
  assert.equal(resolveTimeoutMs({ GEMINI_MCP_TIMEOUT_MS: "5000" }), 5000);
  assert.equal(
    resolveTimeoutMs({ GEMINI_MCP_TIMEOUT_MS: String(RECOMMENDED_TIMEOUT_MS) }),
    RECOMMENDED_TIMEOUT_MS,
  );
});

test("resolveTimeoutMs: 0, negative, or invalid disables the timeout (returns 0)", () => {
  assert.equal(resolveTimeoutMs({ GEMINI_MCP_TIMEOUT_MS: "0" }), 0);
  assert.equal(resolveTimeoutMs({ GEMINI_MCP_TIMEOUT_MS: "-1" }), 0);
  assert.equal(resolveTimeoutMs({ GEMINI_MCP_TIMEOUT_MS: "abc" }), 0);
});
