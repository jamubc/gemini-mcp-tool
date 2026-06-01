import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
// This wires the full changeMode path that the ask-gemini tool drives for large
// edits: a Gemini-style response string -> parse -> validate -> chunk -> cache,
// then the fetch-chunk tool retrieving subsequent chunks. No CLI is involved —
// the "Gemini output" is a fixture string, so the test is hermetic.
import { processChangeModeOutput } from "../../src/utils/geminiExecutor.js";
import { fetchChunkTool } from "../../src/tools/fetch-chunk.tool.js";
import { clearCache } from "../../src/utils/chunkCache.js";

const FENCE = "```";

function block(file: string, line: number, oldCode: string, newCode: string): string {
  return [`**FILE: ${file}:${line}**`, FENCE, "OLD:", oldCode, "NEW:", newCode, FENCE].join("\n");
}

// Four edits with large bodies (~6 KB each) exceed the 20 KB chunk budget,
// forcing the response to be split and cached.
function bigMultiEditResponse(): string {
  const big = "a".repeat(6000);
  return [
    block("src/one.ts", 10, big, "one"),
    block("src/two.ts", 20, big, "two"),
    block("src/three.ts", 30, big, "three"),
    block("src/four.ts", 40, big, "four"),
  ].join("\n\n");
}

beforeEach(() => clearCache());
afterEach(() => clearCache());

describe("MCP Subsystem Integration: changeMode Pipeline", () => {
  test("a single-edit response renders one chunk with no continuation", async () => {
    const out = await processChangeModeOutput(block("src/a.ts", 1, "const x = 1;", "const x = 2;"), undefined, undefined, "prompt-a");
    assert.match(out, /CHANGEMODE OUTPUT/);
    assert.ok(out.includes("const x = 2;"));
    assert.doesNotMatch(out, /Chunk 1 of/); // single chunk => no chunk header
  });

  test("a large multi-edit response chunks, caches, and advertises fetch-chunk", async () => {
    const first = await processChangeModeOutput(bigMultiEditResponse(), undefined, undefined, "prompt-big");
    assert.match(first, /Chunk 1 of 2/);

    // The continuation must surface a real 8-char cache key.
    const m = first.match(/cacheKey="([a-f0-9]{8})"/);
    assert.ok(m, "expected a fetch-chunk cacheKey in the first chunk");
    const cacheKey = m![1];

    // The fetch-chunk tool retrieves the next chunk from that key.
    const second = await fetchChunkTool.execute({ cacheKey, chunkIndex: 2 });
    assert.match(second, /Chunk 2 of 2/);

    // ...and chunk 1 is still retrievable.
    const again = await fetchChunkTool.execute({ cacheKey, chunkIndex: 1 });
    assert.match(again, /Chunk 1 of 2/);
  });

  test("fetch-chunk reports an out-of-range index", async () => {
    const first = await processChangeModeOutput(bigMultiEditResponse(), undefined, undefined, "prompt-range");
    const cacheKey = first.match(/cacheKey="([a-f0-9]{8})"/)![1];
    const out = await fetchChunkTool.execute({ cacheKey, chunkIndex: 99 });
    assert.match(out, /Invalid chunk index/);
  });

  test("fetch-chunk reports a cache miss for an unknown (but well-formed) key", async () => {
    const out = await fetchChunkTool.execute({ cacheKey: "00000000", chunkIndex: 1 });
    assert.match(out, /Cache miss/);
  });

  test("fetch-chunk rejects a malformed cache key before touching the cache", async () => {
    const out = await fetchChunkTool.execute({ cacheKey: "../../etc/passwd", chunkIndex: 1 });
    assert.match(out, /Invalid cacheKey format/);
  });

  test("a response with no OLD/NEW edits yields a clear message", async () => {
    const out = await processChangeModeOutput("Gemini replied with prose and no edits.", undefined, undefined, "prompt-none");
    assert.match(out, /No edits found/);
  });
});

