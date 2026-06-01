import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { callGemini, callTool, startServer, textOf, GEMINI_SKIP, type ServerHandle } from "./harness.js";

// LIVE tests: these drive the real gemini CLI through the real MCP server. They
// auto-skip when gemini is not on PATH, so the suite degrades gracefully. Real
// model calls are slow, hence the generous per-test timeout. Model is pinned to
// flash for speed and to spare the pro daily quota.
const LIVE = { skip: GEMINI_SKIP, timeout: 120_000 } as const;
const MODEL = "gemini-2.5-flash";

let server: ServerHandle;

before(async () => {
  server = await startServer();
});
after(async () => {
  await server?.close();
});

test("ask-gemini answers a deterministic factual question", LIVE, async (t) => {
  const { isError, text } = await callGemini(t, server, {
    name: "ask-gemini",
    arguments: { prompt: "What is 2 + 2? Reply with only the number.", model: MODEL },
  });
  assert.equal(isError, false, text);
  assert.match(text, /Gemini response:/); // the tool's wrapper is always present
  assert.match(text, /\b4\b/); // ...and the model actually answered
});

test("ask-gemini echoes the session id so a follow-up can resume it", LIVE, async (t) => {
  // Unique per run: gemini persists sessions to disk, so a fixed id collides
  // ("Session ID already exists") on the next run. The [session: …] marker is
  // added by the tool itself, so asserting on this exact id is deterministic.
  const sessionId = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await callTool(t, server, {
    name: "ask-gemini",
    arguments: { prompt: "Reply with the single word: ok", model: MODEL, sessionId },
  });
  const text = textOf(res);
  assert.equal(res.isError ?? false, false, text);
  assert.ok(text.includes(`[session: ${sessionId}]`), text);
});

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
