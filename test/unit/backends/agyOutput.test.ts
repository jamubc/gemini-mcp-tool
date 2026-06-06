import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseAgyHelp, NO_AGY_CAPABILITIES } from "../../../src/backends/agyCapabilities.js";
import {
  parseAgyJsonResponse,
  shSingleQuote,
  stripScriptNoise,
  ptyEnabled,
} from "../../../src/backends/agyOutput.js";

describe("Backends: agy capability probing (Phase 3)", () => {
  test("detects flags advertised by `agy --help`", () => {
    const help = [
      "Usage: agy [options]",
      "  -p, --prompt <text>      run a one-shot prompt",
      "  --output-format <fmt>    output format: text, json",
      "  --conversation <id>      resume a specific conversation",
      "  -c, --continue           continue the most recent conversation",
      "  --print-timeout <ms>     bound a headless run",
    ].join("\n");
    const caps = parseAgyHelp(help);
    assert.equal(caps.outputFormatJson, true);
    assert.equal(caps.conversationId, true);
    assert.equal(caps.continueFlag, true);
    assert.equal(caps.printTimeout, true);
  });

  test("a 1.0.x help with no json mode yields the conservative defaults", () => {
    const caps = parseAgyHelp("Usage: agy\n  -p, --prompt <text>\n  -i  interactive login");
    assert.equal(caps.outputFormatJson, false);
    assert.equal(caps.printTimeout, false);
  });

  test("empty help is treated as no capabilities", () => {
    assert.deepEqual(parseAgyHelp(""), NO_AGY_CAPABILITIES);
  });
});

describe("Backends: agy JSON stdout parsing (Phase 3)", () => {
  test("reads a single result object's conventional reply field", () => {
    assert.equal(parseAgyJsonResponse('{"response":"hello world"}'), "hello world");
    assert.equal(parseAgyJsonResponse('{"text":"  spaced  "}'), "spaced");
  });

  test("reads a JSONL/stream of transcript entries via the canonical extractor", () => {
    const stream = [
      '{"type":"USER_INPUT","content":"q"}',
      '{"source":"MODEL","type":"PLANNER_RESPONSE","status":"IN_PROGRESS","content":"part"}',
      '{"source":"MODEL","type":"PLANNER_RESPONSE","status":"DONE","content":"the answer"}',
    ].join("\n");
    assert.equal(parseAgyJsonResponse(stream), "the answer");
  });

  test("handles a top-level array of entries", () => {
    const arr = JSON.stringify([
      { type: "USER_INPUT", content: "q" },
      { source: "MODEL", type: "PLANNER_RESPONSE", status: "DONE", content: "arr answer" },
    ]);
    assert.equal(parseAgyJsonResponse(arr), "arr answer");
  });

  test("returns undefined for empty or non-JSON stdout", () => {
    assert.equal(parseAgyJsonResponse(""), undefined);
    assert.equal(parseAgyJsonResponse("not json at all"), undefined);
  });
});

describe("Backends: PTY helpers (Phase 3, S1b)", () => {
  test("shSingleQuote makes injection metacharacters inert", () => {
    assert.equal(shSingleQuote("plain"), "'plain'");
    // an embedded single quote is closed, escaped, and reopened
    assert.equal(shSingleQuote("a'b"), "'a'\\''b'");
    // metacharacters survive literally inside the quotes
    assert.equal(shSingleQuote("a; rm -rf /"), "'a; rm -rf /'");
  });

  test("stripScriptNoise drops the script(1) banners and CRs", () => {
    const raw = "Script started, file is /dev/null\r\nthe answer\r\nScript done, file is /dev/null\r\n";
    assert.equal(stripScriptNoise(raw), "the answer");
  });

  test("ptyEnabled is opt-in via AGY_MCP_PTY", () => {
    assert.equal(ptyEnabled({}), false);
    assert.equal(ptyEnabled({ AGY_MCP_PTY: "1" }), true);
    assert.equal(ptyEnabled({ AGY_MCP_PTY: "true" }), true);
    assert.equal(ptyEnabled({ AGY_MCP_PTY: "0" }), false);
  });
});
