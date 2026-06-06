import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getBackend,
  geminiBackend,
  agyBackend,
  withNotices,
  DEFAULT_BACKEND,
  resolveDefaultBackend,
  backendSelection,
  __resetRetirementNudgeForTest,
} from "../../../src/backends/index.js";

const BEFORE = new Date("2026-06-01T00:00:00Z"); // before the 2026-06-18 retirement
const AFTER = new Date("2026-07-01T00:00:00Z"); // after it

describe("Backends: selection", () => {
  test("defaults to the gemini backend before retirement", () => {
    assert.equal(DEFAULT_BACKEND, "gemini");
    assert.equal(getBackend({}, BEFORE).name, "gemini");
    assert.equal(getBackend({ GEMINI_MCP_BACKEND: "" }, BEFORE).name, "gemini");
    assert.equal(getBackend({ GEMINI_MCP_BACKEND: "gemini" }, BEFORE), geminiBackend);
  });

  test("selects agy for agy/antigravity (case/space-insensitive)", () => {
    assert.equal(getBackend({ GEMINI_MCP_BACKEND: "agy" }, BEFORE), agyBackend);
    assert.equal(getBackend({ GEMINI_MCP_BACKEND: " Antigravity " }, BEFORE), agyBackend);
  });

  test("unknown backend names fall back to gemini", () => {
    assert.equal(getBackend({ GEMINI_MCP_BACKEND: "bogus" }, BEFORE).name, "gemini");
  });

  test("Phase 4: default flips to agy on/after the retirement date", () => {
    assert.equal(resolveDefaultBackend(BEFORE), "gemini");
    assert.equal(resolveDefaultBackend(AFTER), "agy");
    assert.equal(getBackend({}, AFTER), agyBackend);
    // An explicit override still wins after retirement.
    assert.equal(getBackend({ GEMINI_MCP_BACKEND: "gemini" }, AFTER), geminiBackend);
  });

  test("backendSelection surfaces the post-retirement auto-switch notice", () => {
    __resetRetirementNudgeForTest();
    const { backend, notices } = backendSelection({}, AFTER);
    assert.equal(backend, agyBackend);
    assert.equal(notices.length, 1);
    assert.match(notices[0], /retired on 2026-06-18/);
    // No notice when the backend was chosen explicitly.
    assert.deepEqual(backendSelection({ GEMINI_MCP_BACKEND: "agy" }, AFTER).notices, []);
  });

  test("backendSelection nudges once in the final countdown, then stays quiet", () => {
    __resetRetirementNudgeForTest();
    const soon = new Date("2026-06-10T00:00:00Z"); // within WARN_WITHIN_DAYS
    const first = backendSelection({}, soon);
    assert.equal(first.backend, geminiBackend);
    assert.equal(first.notices.length, 1);
    assert.match(first.notices[0], /retires on 2026-06-18/);
    // Once per process: the second call is silent.
    assert.deepEqual(backendSelection({}, soon).notices, []);
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
