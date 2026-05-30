import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveApprovalMode, buildGeminiArgs } from "./gemini.js";

const ENV_KEY = "GEMINI_MCP_APPROVAL_MODE";

function withEnv(value: string | undefined, fn: () => void): void {
  const prev = process.env[ENV_KEY];
  if (value === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = value;
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = prev;
  }
}

test("resolveApprovalMode is opt-in (undefined unless set) and rejects unknown values", () => {
  withEnv(undefined, () => {
    assert.equal(resolveApprovalMode(), undefined);
    assert.equal(resolveApprovalMode("bogus"), undefined);
    assert.equal(resolveApprovalMode("yolo"), "yolo");
    assert.equal(resolveApprovalMode("plan"), "plan");
  });
});

test("resolveApprovalMode reads the env var, but the arg overrides it", () => {
  withEnv("auto_edit", () => {
    assert.equal(resolveApprovalMode(), "auto_edit");
    assert.equal(resolveApprovalMode("plan"), "plan");
  });
});

test("buildGeminiArgs forces no approval mode by default", () => {
  withEnv(undefined, () => {
    assert.deepEqual(buildGeminiArgs("gemini-2.5-flash", { sandbox: true }), [
      "-m",
      "gemini-2.5-flash",
      "-s",
    ]);
    assert.deepEqual(buildGeminiArgs(undefined, { resume: "abc" }), ["--resume", "abc"]);
    assert.deepEqual(buildGeminiArgs(undefined, { sessionId: "xyz" }), [
      "--session-id",
      "xyz",
    ]);
  });
});

test("buildGeminiArgs adds the approval flag only when requested; resume beats sessionId", () => {
  withEnv(undefined, () => {
    assert.deepEqual(buildGeminiArgs(undefined, { approvalMode: "yolo" }), [
      "--approval-mode",
      "yolo",
    ]);
    assert.deepEqual(
      buildGeminiArgs(undefined, { approvalMode: "plan", resume: "r1", sessionId: "s1" }),
      ["--approval-mode", "plan", "--resume", "r1"],
    );
  });
});
