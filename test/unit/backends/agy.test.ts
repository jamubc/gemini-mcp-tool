import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildAgyArgs, buildAgyPrompt, agyPrintTimeoutArg } from "../../../src/backends/agy.js";
import { extractReplies, conversationFreshSince } from "../../../src/backends/agyTranscript.js";
import { COMMAND_TIMEOUT_MS } from "../../../src/utils/commandExecutor.js";
import { APPROVAL_MODES } from "../../../src/constants.js";

describe("Backends: agy arg building", () => {
  test("emits no session/model flags for a plain prompt (model is never forwarded)", () => {
    assert.deepEqual(buildAgyArgs({ model: "gemini-2.5-pro" }), []);
  });

  test("maps resume='latest' to --continue and a specific id to --conversation", () => {
    assert.deepEqual(buildAgyArgs({ resume: "latest" }), ["--continue"]);
    assert.deepEqual(buildAgyArgs({ resume: "abc123" }), ["--conversation", "abc123"]);
  });

  test("uses --conversation for an explicit sessionId", () => {
    assert.deepEqual(buildAgyArgs({ sessionId: "sess-1" }), ["--conversation", "sess-1"]);
  });

  test("forwards --sandbox and maps only yolo to --dangerously-skip-permissions", () => {
    assert.deepEqual(buildAgyArgs({ sandbox: true }), ["--sandbox"]);
    assert.deepEqual(buildAgyArgs({ approvalMode: APPROVAL_MODES.YOLO }), [
      "--dangerously-skip-permissions",
    ]);
    assert.deepEqual(buildAgyArgs({ approvalMode: APPROVAL_MODES.PLAN }), []);
  });
});

describe("Backends: agy prompt building", () => {
  test("inlines in-project @file references itself (agy does not)", () => {
    const out = buildAgyPrompt("summarise @package.json", {});
    assert.match(out, /BEGIN FILE: package\.json/);
    assert.match(out, /"name": "gemini-mcp-tool"/);
    assert.doesNotMatch(out, /@package\.json/); // token replaced by contents
  });

  test("keeps the project-root guard when inlining", () => {
    assert.throws(() => buildAgyPrompt("read @../secret", {}), /outside the project directory/);
  });

  test("wraps changeMode requests in the OLD/NEW template", () => {
    const out = buildAgyPrompt("rename foo", { changeMode: true });
    assert.match(out, /\[CHANGEMODE INSTRUCTIONS\]/);
    assert.match(out, /USER REQUEST:/);
  });

  test("does not inline an email address as an @file reference", () => {
    const out = buildAgyPrompt("email me at user@example.com about it", {});
    assert.match(out, /user@example\.com/);
    assert.doesNotMatch(out, /FILE NOT FOUND/);
  });
});

describe("Backends: agy transcript extraction", () => {
  test("returns DONE planner replies after the last user input", () => {
    const entries = [
      { type: "USER_INPUT", content: "old turn" },
      { source: "MODEL", type: "PLANNER_RESPONSE", status: "DONE", content: "stale" },
      { type: "USER_INPUT", content: "current turn" },
      { source: "MODEL", type: "PLANNER_RESPONSE", status: "IN_PROGRESS", content: "partial" },
      { source: "MODEL", type: "PLANNER_RESPONSE", status: "DONE", content: "the answer" },
    ];
    assert.equal(extractReplies(entries), "the answer");
  });

  test("ignores non-model and non-done entries", () => {
    const entries = [
      { type: "USER_INPUT", content: "q" },
      { source: "TOOL", type: "PLANNER_RESPONSE", status: "DONE", content: "tool noise" },
      { source: "MODEL", type: "OTHER", status: "DONE", content: "wrong type" },
    ];
    assert.equal(extractReplies(entries), "");
  });

  test("conversationFreshSince is false for an unknown conversation", () => {
    assert.equal(conversationFreshSince("nonexistent-conversation-id", 1), false);
  });
});

describe("Backends: agy print timeout", () => {
  test("derives from the command timeout cap, 60s under it", () => {
    const expected = `${Math.max(60, Math.floor(COMMAND_TIMEOUT_MS / 1000) - 60)}s`;
    assert.equal(agyPrintTimeoutArg(), expected);
  });

  test("AGY_PRINT_TIMEOUT overrides the derived value", () => {
    const prev = process.env.AGY_PRINT_TIMEOUT;
    process.env.AGY_PRINT_TIMEOUT = "30m";
    try {
      assert.equal(agyPrintTimeoutArg(), "30m");
    } finally {
      if (prev === undefined) delete process.env.AGY_PRINT_TIMEOUT;
      else process.env.AGY_PRINT_TIMEOUT = prev;
    }
  });
});
