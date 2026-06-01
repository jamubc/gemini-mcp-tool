import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
// Drives the registry -> tool boundary for every path that resolves WITHOUT
// invoking the Gemini CLI: argument validation, and the guard/error branches
// inside the tools. (The happy path that actually calls Gemini is covered by
// the e2e suite.) These must never spawn a subprocess.
import { executeTool } from "../../src/tools/index.js";
import { clearCache } from "../../src/utils/chunkCache.js";

beforeEach(() => clearCache());

describe("MCP Subsystem Integration: Tool Input Validation Contracts", () => {
  test("executeTool surfaces zod validation as a friendly error", async () => {
    // ask-gemini requires a non-empty prompt; the error names the offending field.
    await assert.rejects(() => executeTool("ask-gemini", {}), /Invalid arguments for ask-gemini.*prompt/s);
  });

  test("executeTool throws for an unknown tool", async () => {
    await assert.rejects(() => executeTool("no-such-tool", {}), /Unknown tool/);
  });

  test("fetch-chunk via the registry returns a cache-miss message (no spawn)", async () => {
    const out = await executeTool("fetch-chunk", { cacheKey: "deadbeef", chunkIndex: 1 });
    assert.match(out, /Cache miss/);
  });

  test("fetch-chunk via the registry rejects a malformed cache key (no spawn)", async () => {
    const out = await executeTool("fetch-chunk", { cacheKey: "not-a-key", chunkIndex: 1 });
    assert.match(out, /Invalid cacheKey format/);
  });

  test("ask-gemini rejects a malformed chunkCacheKey before calling Gemini", async () => {
    const out = await executeTool("ask-gemini", {
      prompt: "x",
      changeMode: true,
      chunkIndex: 1,
      chunkCacheKey: "bad!key!",
    });
    assert.match(out, /Invalid chunkCacheKey format/);
  });

  test("ask-gemini changeMode continuation with a missing cache reports a cache miss (no spawn)", async () => {
    // Well-formed key, but nothing cached -> the continuation path returns the
    // cache-miss message rather than shelling out to Gemini.
    const out = await executeTool("ask-gemini", {
      prompt: "x",
      changeMode: true,
      chunkIndex: 1,
      chunkCacheKey: "deadbeef",
    });
    assert.match(out, /Cache miss/);
  });
});
