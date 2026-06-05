import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Drive the memory tool end-to-end through the registry.  No Gemini calls are
// made — this is fully hermetic.
import {
  executeTool,
  getToolDefinitions,
  toolExists,
} from "../../src/tools/index.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mem-int-"));
  process.env["GEMINI_MCP_MEMORY_DIR"] = tmpDir;
});

afterEach(() => {
  delete process.env["GEMINI_MCP_MEMORY_DIR"];
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("MCP Subsystem Integration: memory tool registry contract", () => {
  test("'memory' is registered in the tool registry", () => {
    assert.equal(toolExists("memory"), true);
  });

  test("memory tool definition has 'action' in required fields", () => {
    const defs = getToolDefinitions();
    const memDef = defs.find((d) => d.name === "memory");
    assert.ok(memDef, "memory tool definition must exist");
    assert.ok(
      (memDef!.inputSchema.required as string[]).includes("action"),
      "'action' must be required"
    );
  });

  test("executeTool('memory', {}) surfaces a zod validation error for missing action", async () => {
    await assert.rejects(
      () => executeTool("memory", {}),
      /Invalid arguments for memory.*action/s
    );
  });

  test("store → recall round-trip via executeTool()", async () => {
    await executeTool("memory", { action: "store", key: "ctx", content: "hello" });
    const out = await executeTool("memory", { action: "recall", key: "ctx" });
    assert.ok(out.includes("hello"));
  });

  test("recall miss via executeTool() returns ❌", async () => {
    const out = await executeTool("memory", { action: "recall", key: "absent" });
    assert.match(out, /❌/);
  });

  test("list via executeTool() returns markdown table after store", async () => {
    await executeTool("memory", { action: "store", key: "k1", content: "v1" });
    const out = await executeTool("memory", { action: "list" });
    assert.match(out, /\| Key \|/);
    assert.ok(out.includes("k1"));
  });

  test("delete via executeTool() removes entry", async () => {
    await executeTool("memory", { action: "store", key: "del", content: "bye" });
    await executeTool("memory", { action: "delete", key: "del" });
    const out = await executeTool("memory", { action: "recall", key: "del" });
    assert.match(out, /❌/);
  });

  test("clear via executeTool() empties the store", async () => {
    await executeTool("memory", { action: "store", key: "a", content: "1" });
    await executeTool("memory", { action: "store", key: "b", content: "2" });
    const clearOut = await executeTool("memory", { action: "clear" });
    assert.match(clearOut, /✅/);
    const listOut = await executeTool("memory", { action: "list" });
    assert.match(listOut, /empty/i);
  });
});
