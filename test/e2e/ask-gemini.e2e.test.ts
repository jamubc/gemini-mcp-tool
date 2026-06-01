import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { callGemini, callTool, startServer, textOf, GEMINI_SKIP, type ServerHandle } from "./harness.js";
import { loadConfig } from "../envParser.js";

// LIVE tests: these drive the real gemini CLI through the real MCP server. They
// auto-skip when gemini is not on PATH, so the suite degrades gracefully. Real
// model calls are slow, hence the generous per-test timeout. Model is dynamically loaded
// from config to match the test suite settings.
const config = loadConfig();
const LIVE = { skip: GEMINI_SKIP, timeout: 120_000 } as const;
const MODEL = config.judgeGeminiModel;

let server: ServerHandle;

before(async () => {
  server = await startServer();
});
after(async () => {
  await server?.close();
});

describe("MCP Protocol E2E: Live Gemini CLI & Tool Requests", () => {
  test("ask-gemini answers a deterministic factual question", LIVE, async (t) => {
    const { isError, text } = await callGemini(t, server, {
      name: "ask-gemini",
      arguments: { prompt: "What is 2 + 2? Reply with only the number.", model: MODEL },
    });
    assert.equal(isError, false, text);
    assert.match(text, /Gemini response:/); // the tool's wrapper is always present
    assert.match(text, /\b4\b/); // ...and the model actually answered
  });

  // Note: native sessions (sessionId/resume) are a future feature — their e2e test
  // arrives with that PR. 1.1.7 covers the reliability + plain Q&A surface.

  test("ask-gemini inlines an in-project @file reference", LIVE, async (t) => {
    const { isError, text } = await callGemini(t, server, {
      name: "ask-gemini",
      arguments: {
        prompt:
          "@test/e2e/fixtures/sentinel.txt Reply with only the sentinel token that appears in this file.",
        model: MODEL,
      },
    });
    assert.equal(isError, false, text);
    assert.match(text, /BANANA_SENTINEL_42/);
  });

  test("Help returns the gemini CLI help text", LIVE, async (t) => {
    const res = await callTool(t, server, { name: "Help", arguments: {} });
    const text = textOf(res);
    assert.equal(res.isError ?? false, false, text);
    assert.match(text, /usage|--model|gemini/i);
  });

  // brainstorm generates free-form ideas: the slowest call, and nondeterministic
  // (flash can even return empty). Its prompt construction is unit-tested, and its
  // integration path is identical to ask-gemini (proven above), so here we only
  // verify the live round-trip succeeds end-to-end. Larger timeout, single attempt.
  test("brainstorm completes a real round-trip through gemini", { skip: GEMINI_SKIP, timeout: 180_000 }, async (t) => {
    const res = await callTool(t, server, {
      name: "brainstorm",
      arguments: { prompt: "one quick way to speed up CI", model: MODEL, ideaCount: 1, includeAnalysis: false },
    });
    assert.equal(res.isError ?? false, false, textOf(res));
  });
});

