import { test } from "node:test";
import assert from "node:assert/strict";
import { getBackend } from "../../../src/backends/index.js";

test("getBackend defaults to gemini", () => {
  assert.equal(getBackend({}).name, "gemini");
  assert.equal(getBackend({ GEMINI_MCP_BACKEND: "" }).name, "gemini");
  assert.equal(getBackend({ GEMINI_MCP_BACKEND: "gemini" }).name, "gemini");
  assert.equal(getBackend({ GEMINI_MCP_BACKEND: "unknown" }).name, "gemini");
});

test("getBackend selects agy when requested (case-insensitive, incl. 'antigravity')", () => {
  assert.equal(getBackend({ GEMINI_MCP_BACKEND: "agy" }).name, "agy");
  assert.equal(getBackend({ GEMINI_MCP_BACKEND: "AGY" }).name, "agy");
  assert.equal(getBackend({ GEMINI_MCP_BACKEND: "antigravity" }).name, "agy");
});
