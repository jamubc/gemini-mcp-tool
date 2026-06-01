import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { chunkChangeModeEdits, summarizeChunking } from "../../../src/utils/changeModeChunker.js";
import type { ChangeModeEdit } from "../../../src/utils/changeModeParser.js";

function edit(filename: string, oldCode = "x", newCode = "y"): ChangeModeEdit {
  const lines = (s: string) => (s === "" ? 0 : s.split("\n").length);
  return {
    filename,
    oldStartLine: 1,
    oldEndLine: Math.max(1, lines(oldCode)),
    oldCode,
    newStartLine: 1,
    newEndLine: Math.max(1, lines(newCode)),
    newCode,
  };
}

describe("Node Utilities: changeMode Chunker", () => {
  test("chunkChangeModeEdits returns one empty chunk for no edits", () => {
    const chunks = chunkChangeModeEdits([]);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].edits.length, 0);
    assert.equal(chunks[0].totalChunks, 1);
    assert.equal(chunks[0].hasMore, false);
  });

  test("chunkChangeModeEdits keeps small edits together in a single chunk (default budget)", () => {
    const chunks = chunkChangeModeEdits([edit("a.ts"), edit("b.ts"), edit("c.ts")]);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].edits.length, 3);
    assert.equal(chunks[0].totalChunks, 1);
    assert.equal(chunks[0].hasMore, false);
  });

  test("chunkChangeModeEdits keeps edits to the same file grouped together", () => {
    // Two edits to the same file fit easily under the default budget.
    const chunks = chunkChangeModeEdits([edit("same.ts", "aaa"), edit("same.ts", "bbb")]);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].edits.length, 2);
  });

  test("chunkChangeModeEdits splits across chunks when the budget is exceeded", () => {
    // Each edit is ~260 chars (250 overhead + filename*2 + code). A 300-char budget
    // forces one edit per chunk across three distinct files.
    const chunks = chunkChangeModeEdits([edit("a.ts"), edit("b.ts"), edit("c.ts")], 300);
    assert.equal(chunks.length, 3);
    assert.deepEqual(
      chunks.map((c) => c.chunkIndex),
      [1, 2, 3],
    );
    assert.deepEqual(
      chunks.map((c) => c.hasMore),
      [true, true, false],
    );
    assert.deepEqual(
      chunks.map((c) => c.totalChunks),
      [3, 3, 3],
    );
  });

  test("chunkChangeModeEdits splits a single oversized file across chunks", () => {
    const chunks = chunkChangeModeEdits([edit("big.ts", "aaa"), edit("big.ts", "bbb")], 300);
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0].edits[0].filename, "big.ts");
    assert.equal(chunks[1].edits[0].filename, "big.ts");
  });

  test("summarizeChunking reports edit and chunk counts", () => {
    const chunks = chunkChangeModeEdits([edit("a.ts"), edit("b.ts")], 300);
    const summary = summarizeChunking(chunks);
    assert.match(summary, /# edits: 2/);
    assert.match(summary, /# chunks: 2/);
  });
});

