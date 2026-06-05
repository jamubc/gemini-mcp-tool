import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Each test gets its own isolated temporary directory so tests never share state.
let tmpDir: string;

function setMemoryDir(dir: string) {
  process.env["GEMINI_MCP_MEMORY_DIR"] = dir;
}

function clearMemoryDir() {
  delete process.env["GEMINI_MCP_MEMORY_DIR"];
}

// Re-import the module fresh for each test to pick up the ENV change.
// Because the module uses process.env at call-time (not import-time) we can
// just set the env var before each test.
import {
  saveEntry,
  getEntry,
  listEntries,
  deleteEntry,
  clearAll,
} from "../../../src/utils/memoryStore.js";

describe("memoryStore: core CRUD", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mem-test-"));
    setMemoryDir(tmpDir);
  });

  afterEach(() => {
    clearMemoryDir();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("store → recall round-trip preserves content", () => {
    saveEntry("my-key", "hello world");
    const entry = getEntry("my-key");
    assert.ok(entry);
    assert.equal(entry.content, "hello world");
  });

  test("recall returns undefined for a missing key", () => {
    const entry = getEntry("does-not-exist");
    assert.equal(entry, undefined);
  });

  test("list reflects stored entries", () => {
    saveEntry("alpha", "content A");
    saveEntry("beta", "content B");
    const items = listEntries();
    const keys = items.map((i) => i.key);
    assert.ok(keys.includes("alpha"), "alpha should be listed");
    assert.ok(keys.includes("beta"), "beta should be listed");
  });

  test("list returns empty array when store is empty", () => {
    assert.deepEqual(listEntries(), []);
  });

  test("delete removes the entry; subsequent recall returns undefined", () => {
    saveEntry("temp", "data");
    const removed = deleteEntry("temp");
    assert.equal(removed, true);
    assert.equal(getEntry("temp"), undefined);
  });

  test("delete returns false for a key that does not exist", () => {
    assert.equal(deleteEntry("ghost"), false);
  });

  test("clear empties the store and returns the count", () => {
    saveEntry("x", "1");
    saveEntry("y", "2");
    const count = clearAll();
    assert.equal(count, 2);
    assert.deepEqual(listEntries(), []);
  });

  test("clear on an empty / missing dir returns 0", () => {
    // Dir doesn't exist yet — clearAll should be a no-op.
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "mem-empty-"));
    setMemoryDir(emptyDir);
    const count = clearAll();
    assert.equal(count, 0);
    fs.rmSync(emptyDir, { recursive: true, force: true });
  });

  test("overwrite updates content but preserves createdAt", () => {
    saveEntry("k", "v1");
    const first = getEntry("k")!;
    const createdAt = first.meta.createdAt;

    // Small delay is unnecessary — the function simply re-reads createdAt from
    // the existing file, so even an immediate overwrite preserves it.
    saveEntry("k", "v2");
    const second = getEntry("k")!;
    assert.equal(second.content, "v2");
    assert.equal(second.meta.createdAt, createdAt);
  });

  test("metadata label and tags are persisted", () => {
    saveEntry("tagged", "data", { label: "My Label", tags: ["a", "b"] });
    const entry = getEntry("tagged")!;
    assert.equal(entry.meta.label, "My Label");
    assert.deepEqual(entry.meta.tags, ["a", "b"]);
  });

  test("list item includes bytes and updatedAt", () => {
    saveEntry("sz", "hello");
    const items = listEntries();
    const item = items.find((i) => i.key === "sz");
    assert.ok(item);
    assert.ok(item.bytes > 0);
    assert.ok(typeof item.updatedAt === "string");
  });
});

describe("memoryStore: key validation", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mem-kval-"));
    setMemoryDir(tmpDir);
  });

  afterEach(() => {
    clearMemoryDir();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("rejects ../x (traversal attempt)", () => {
    assert.throws(() => saveEntry("../x", "data"), /traversal|Invalid memory key/);
  });

  test("rejects an absolute path as key", () => {
    assert.throws(() => saveEntry("/etc/passwd", "data"), /Invalid memory key/);
  });

  test("rejects a key starting with ~", () => {
    assert.throws(() => saveEntry("~/secret", "data"), /Invalid memory key/);
  });

  test("rejects an empty key", () => {
    assert.throws(() => saveEntry("", "data"), /non-empty|Invalid memory key/);
  });

  test("rejects a key that is too long (> 128 chars)", () => {
    const longKey = "a".repeat(129);
    assert.throws(() => saveEntry(longKey, "data"), /Invalid memory key/);
  });

  test("rejects a key with invalid characters (spaces, slashes)", () => {
    assert.throws(() => saveEntry("bad key!", "data"), /Invalid memory key/);
    assert.throws(() => saveEntry("bad/key", "data"), /Invalid memory key/);
  });

  test("accepts valid keys with dots, dashes, and underscores", () => {
    assert.doesNotThrow(() => saveEntry("my-key_v1.2", "ok"));
  });
});

describe("memoryStore: size and cap enforcement", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mem-cap-"));
    setMemoryDir(tmpDir);
  });

  afterEach(() => {
    clearMemoryDir();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("rejects content that exceeds the 256 KiB per-entry limit", () => {
    const oversized = "x".repeat(256 * 1024 + 1);
    assert.throws(() => saveEntry("big", oversized), /256 KiB|exceeds/);
  });

  test("accepts content right at the 256 KiB boundary", () => {
    const maxContent = "x".repeat(256 * 1024);
    assert.doesNotThrow(() => saveEntry("max", maxContent));
  });

  test("enforces the 200-entry maximum", () => {
    // Fill the store to the limit.
    for (let i = 0; i < 200; i++) {
      saveEntry(`entry-${String(i).padStart(3, "0")}`, `value ${i}`);
    }
    // The 201st entry must be rejected.
    assert.throws(
      () => saveEntry("one-too-many", "overflow"),
      /full|200 entries/
    );
  });

  test("overwriting an existing key does not count against the entry cap", () => {
    for (let i = 0; i < 200; i++) {
      saveEntry(`slot-${String(i).padStart(3, "0")}`, `v${i}`);
    }
    // Updating an existing key must succeed even at max capacity.
    assert.doesNotThrow(() => saveEntry("slot-000", "updated"));
  });
});
