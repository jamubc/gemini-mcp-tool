import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAgyArgs } from "./agy.js";

test("buildAgyArgs maps prompt, sessions, sandbox, and yolo", () => {
  assert.deepEqual(buildAgyArgs("hi", {}), ["-p", "hi"]);
  assert.deepEqual(buildAgyArgs("hi", { resume: "latest" }), ["--continue", "-p", "hi"]);
  assert.deepEqual(buildAgyArgs("hi", { resume: "conv-1" }), [
    "--conversation",
    "conv-1",
    "-p",
    "hi",
  ]);
  assert.deepEqual(buildAgyArgs("hi", { sessionId: "conv-2" }), [
    "--conversation",
    "conv-2",
    "-p",
    "hi",
  ]);
  assert.deepEqual(buildAgyArgs("hi", { sandbox: true, approvalMode: "yolo" }), [
    "--sandbox",
    "--dangerously-skip-permissions",
    "-p",
    "hi",
  ]);
});
