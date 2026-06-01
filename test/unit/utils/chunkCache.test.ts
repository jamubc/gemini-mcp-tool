import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  cacheChunks,
  getChunks,
  clearCache,
  getCacheStats,
} from "../../../src/utils/chunkCache.js";
import type { EditChunk } from "../../../src/utils/changeModeChunker.js";

// chunkCache persists to a shared scratch dir under os.tmpdir() (10-min TTL).
// clearCache() isolates each test; it only touches that scratch dir.
beforeEach(() => clearCache());
afterEach(() => clearCache());

function chunk(n: number): EditChunk {
  return {
    edits: [
      {
        filename: `file${n}.ts`,
        oldStartLine: 1,
        oldEndLine: 1,
        oldCode: `old${n}`,
        newStartLine: 1,
        newEndLine: 1,
        newCode: `new${n}`,
      },
    ],
    chunkIndex: n,
    totalChunks: 1,
    hasMore: false,
    estimatedChars: 100,
  };
}

describe("Node Utilities: Chunk Cache", () => {
  test("cacheChunks returns an 8-char hex key and getChunks round-trips the data", () => {
    const key = cacheChunks("a prompt", [chunk(1), chunk(2)]);
    assert.match(key, /^[a-f0-9]{8}$/);

    const got = getChunks(key);
    assert.ok(got);
    assert.equal(got!.length, 2);
    assert.equal(got![0].edits[0].newCode, "new1");
  });

  test("cacheChunks is deterministic for the same prompt", () => {
    const a = cacheChunks("identical", [chunk(1)]);
    const b = cacheChunks("identical", [chunk(1)]);
    assert.equal(a, b);
  });

  test("getChunks rejects malformed keys (path traversal / wrong shape)", () => {
    assert.equal(getChunks("../../etc/passwd"), null);
    assert.equal(getChunks("ZZZZZZZZ"), null); // not hex
    assert.equal(getChunks("abc"), null); // too short
    assert.equal(getChunks("deadbeef99"), null); // too long
  });

  test("getChunks returns null for a valid-format key with no cached file", () => {
    assert.equal(getChunks("00000000"), null);
  });

  test("getChunks expires entries past the TTL and deletes the file", () => {
    const key = cacheChunks("expire me", [chunk(1)]);
    const { cacheDir } = getCacheStats();
    const file = path.join(cacheDir, `${key}.json`);

    // Backdate the stored timestamp beyond the 10-minute TTL.
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    data.timestamp = Date.now() - 11 * 60 * 1000;
    fs.writeFileSync(file, JSON.stringify(data));

    assert.equal(getChunks(key), null);
    assert.equal(fs.existsSync(file), false); // expired file is removed
  });

  test("the cache enforces a maximum file count (FIFO eviction)", () => {
    const { maxSize } = getCacheStats();
    for (let i = 0; i < maxSize + 5; i++) {
      cacheChunks(`prompt-${i}`, [chunk(i)]);
    }
    assert.equal(getCacheStats().size, maxSize);
  });

  test("getCacheStats reports the TTL and max size; clearCache empties the dir", () => {
    const stats = getCacheStats();
    assert.equal(stats.ttl, 10 * 60 * 1000);
    assert.equal(stats.maxSize, 50);

    cacheChunks("something", [chunk(1)]);
    assert.ok(getCacheStats().size >= 1);
    clearCache();
    assert.equal(getCacheStats().size, 0);
  });
});

