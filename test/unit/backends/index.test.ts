import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getBackend,
  geminiBackend,
  agyBackend,
  withNotices,
  DEFAULT_BACKEND,
} from "../../../src/backends/index.js";

describe("Backends: selection", () => {
  test("defaults to the gemini backend", () => {
    assert.equal(DEFAULT_BACKEND, "gemini");
    assert.equal(getBackend({}).name, "gemini");
    assert.equal(getBackend({ GEMINI_MCP_BACKEND: "" }).name, "gemini");
    assert.equal(getBackend({ GEMINI_MCP_BACKEND: "gemini" }), geminiBackend);
  });

  test("selects agy for agy/antigravity (case/space-insensitive)", () => {
    assert.equal(getBackend({ GEMINI_MCP_BACKEND: "agy" }), agyBackend);
    assert.equal(getBackend({ GEMINI_MCP_BACKEND: " Antigravity " }), agyBackend);
  });

  test("unknown backend names fall back to gemini", () => {
    assert.equal(getBackend({ GEMINI_MCP_BACKEND: "bogus" }).name, "gemini");
  });

  test("capability flags reflect each CLI's reality", () => {
    assert.equal(geminiBackend.supportsModelSelection, true);
    assert.equal(geminiBackend.sandboxIsolatesToolExecution, true);
    // agy print-mode is Flash-only and does not isolate tool execution.
    assert.equal(agyBackend.supportsModelSelection, false);
    assert.equal(agyBackend.sandboxIsolatesToolExecution, false);
  });
});

describe("Backends: withNotices", () => {
  test("returns the body unchanged when there are no notices", () => {
    assert.equal(withNotices([], "hello"), "hello");
  });

  test("prepends each notice with a warning marker", () => {
    const out = withNotices(["a", "b"], "body");
    assert.equal(out, "⚠️ a\n⚠️ b\n\nbody");
  });
});
