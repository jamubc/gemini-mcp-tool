import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let tmpDir: string;

function setMemoryDir(dir: string) {
  process.env["GEMINI_MCP_MEMORY_DIR"] = dir;
}

function clearMemoryDir() {
  delete process.env["GEMINI_MCP_MEMORY_DIR"];
}

import { memoryTool } from "../../../src/tools/memory.tool.js";

describe("MCP Tool: memory — execute dispatch", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mem-tool-"));
    setMemoryDir(tmpDir);
  });

  afterEach(() => {
    clearMemoryDir();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("store action succeeds and returns a confirmation", async () => {
    const result = await memoryTool.execute({ action: "store", key: "ctx", content: "my notes" });
    assert.match(result, /✅/);
    assert.ok(result.includes("ctx"));
  });

  test("store → recall round-trip via execute()", async () => {
    await memoryTool.execute({ action: "store", key: "notes", content: "remember this" });
    const recalled = await memoryTool.execute({ action: "recall", key: "notes" });
    assert.ok(recalled.includes("remember this"));
  });

  test("recall miss returns a ❌ message", async () => {
    const result = await memoryTool.execute({ action: "recall", key: "missing" });
    assert.match(result, /❌/);
    assert.ok(result.includes("missing"));
  });

  test("list renders a markdown table with stored entries", async () => {
    await memoryTool.execute({ action: "store", key: "a", content: "aaa" });
    await memoryTool.execute({ action: "store", key: "b", content: "bbb" });
    const result = await memoryTool.execute({ action: "list" });
    assert.match(result, /\| Key \|/);
    assert.ok(result.includes("a"));
    assert.ok(result.includes("b"));
  });

  test("list reports empty store", async () => {
    const result = await memoryTool.execute({ action: "list" });
    assert.match(result, /empty/i);
  });

  test("delete action removes the entry", async () => {
    await memoryTool.execute({ action: "store", key: "del-me", content: "gone" });
    const del = await memoryTool.execute({ action: "delete", key: "del-me" });
    assert.match(del, /✅/);
    const recalled = await memoryTool.execute({ action: "recall", key: "del-me" });
    assert.match(recalled, /❌/);
  });

  test("delete non-existent key returns ❌", async () => {
    const result = await memoryTool.execute({ action: "delete", key: "ghost" });
    assert.match(result, /❌/);
  });

  test("clear removes all entries", async () => {
    await memoryTool.execute({ action: "store", key: "x", content: "1" });
    await memoryTool.execute({ action: "store", key: "y", content: "2" });
    const result = await memoryTool.execute({ action: "clear" });
    assert.match(result, /✅/);
    const list = await memoryTool.execute({ action: "list" });
    assert.match(list, /empty/i);
  });

  test("store without content returns ❌", async () => {
    const result = await memoryTool.execute({ action: "store", key: "k" });
    assert.match(result, /❌/);
  });

  test("store without key returns ❌", async () => {
    const result = await memoryTool.execute({ action: "store", content: "c" });
    assert.match(result, /❌/);
  });

  test("recall without key returns ❌", async () => {
    const result = await memoryTool.execute({ action: "recall" });
    assert.match(result, /❌/);
  });

  test("delete without key returns ❌", async () => {
    const result = await memoryTool.execute({ action: "delete" });
    assert.match(result, /❌/);
  });

  test("store persists optional label and tags", async () => {
    await memoryTool.execute({
      action: "store",
      key: "meta-test",
      content: "data",
      label: "My Label",
      tags: ["tag1", "tag2"],
    });
    const result = await memoryTool.execute({ action: "recall", key: "meta-test" });
    assert.ok(result.includes("My Label"));
    assert.ok(result.includes("tag1"));
  });
});

describe("MCP Tool: memory — tool shape", () => {
  test("tool has name 'memory'", () => {
    assert.equal(memoryTool.name, "memory");
  });

  test("tool has category 'utility'", () => {
    assert.equal(memoryTool.category, "utility");
  });

  test("zodSchema requires 'action'", () => {
    const result = memoryTool.zodSchema.safeParse({});
    assert.equal(result.success, false);
    if (!result.success) {
      const actionIssue = result.error.issues.find((i) => i.path.includes("action"));
      assert.ok(actionIssue, "Expected a validation error for missing 'action'");
    }
  });

  test("zodSchema accepts all valid action values", () => {
    for (const action of ["store", "recall", "list", "delete", "clear"]) {
      const result = memoryTool.zodSchema.safeParse({ action });
      assert.equal(result.success, true, `Expected '${action}' to be valid`);
    }
  });

  test("zodSchema rejects unknown action values", () => {
    const result = memoryTool.zodSchema.safeParse({ action: "explode" });
    assert.equal(result.success, false);
  });
});
