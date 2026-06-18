/**
 * Unit tests for repoDelta.ts
 *
 * All tests use a fake GitRunner — no real git subprocess is invoked.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeDelta, decideMode } from "../../../src/utils/repoDelta.js";

// ─── Fake GitRunner factory ───────────────────────────────────────────────────

interface FakeGitConfig {
  head?: string;
  nameOnly?: string;   // newline-separated changed files
  diff?: string;       // full diff text
  statusPorcelain?: string;
}

function makeFakeGitRunner(cfg: FakeGitConfig) {
  return (args: string[]): string => {
    const sub = args[0];
    if (sub === "rev-parse" && args[1] === "HEAD") {
      return cfg.head ?? "aabbccdd1234";
    }
    if (sub === "diff" && args[1] === "--name-only") {
      return cfg.nameOnly ?? "";
    }
    if (sub === "diff" && args.length === 2) {
      // git diff <base>..HEAD
      return cfg.diff ?? "";
    }
    if (sub === "status" && args[1] === "--porcelain") {
      return cfg.statusPorcelain ?? "";
    }
    return "";
  };
}

// ─── computeDelta ─────────────────────────────────────────────────────────────

describe("repoDelta: computeDelta", () => {
  test("returns headRef from rev-parse HEAD", () => {
    const run = makeFakeGitRunner({ head: "deadbeef1234" });
    const result = computeDelta("base1234", { run });
    assert.strictEqual(result.headRef, "deadbeef1234");
  });

  test("returns the supplied baseRef unchanged", () => {
    const run = makeFakeGitRunner({});
    const result = computeDelta("mybase", { run });
    assert.strictEqual(result.baseRef, "mybase");
  });

  test("parses changedFiles from --name-only output", () => {
    const run = makeFakeGitRunner({
      nameOnly: "src/foo.ts\nsrc/bar.ts",
    });
    const result = computeDelta("base", { run });
    assert.deepStrictEqual(result.changedFiles, ["src/foo.ts", "src/bar.ts"]);
  });

  test("merges working-tree files from git status --porcelain", () => {
    const run = makeFakeGitRunner({
      nameOnly: "src/committed.ts",
      statusPorcelain: "?? src/untracked.ts\n M src/modified.ts",
    });
    const result = computeDelta("base", { run });
    assert.ok(result.changedFiles.includes("src/committed.ts"));
    assert.ok(result.changedFiles.includes("src/untracked.ts"));
    assert.ok(result.changedFiles.includes("src/modified.ts"));
  });

  test("deduplicates files that appear in both diff and status", () => {
    const run = makeFakeGitRunner({
      nameOnly: "src/dupe.ts",
      statusPorcelain: "M  src/dupe.ts",
    });
    const result = computeDelta("base", { run });
    assert.strictEqual(result.changedFiles.filter((f) => f === "src/dupe.ts").length, 1);
  });

  test("returns the diff text in result.diff", () => {
    const fakeDiff = "diff --git a/src/x.ts b/src/x.ts\n+added line";
    const run = makeFakeGitRunner({ diff: fakeDiff });
    const result = computeDelta("base", { run });
    assert.strictEqual(result.diff, fakeDiff);
    assert.strictEqual(result.truncated, false);
  });

  test("truncates diff when it exceeds maxBytes", () => {
    const largeDiff = "x".repeat(500);
    const run = makeFakeGitRunner({ diff: largeDiff });
    const result = computeDelta("base", { run, maxBytes: 100 });
    assert.strictEqual(result.diff.length, 100);
    assert.strictEqual(result.truncated, true);
  });

  test("does not truncate when diff is exactly at the cap", () => {
    const exactDiff = "y".repeat(100);
    const run = makeFakeGitRunner({ diff: exactDiff });
    const result = computeDelta("base", { run, maxBytes: 100 });
    assert.strictEqual(result.diff.length, 100);
    assert.strictEqual(result.truncated, false);
  });

  test("returns empty changedFiles and empty diff when there are no changes", () => {
    const run = makeFakeGitRunner({ nameOnly: "", diff: "", statusPorcelain: "" });
    const result = computeDelta("base", { run });
    assert.deepStrictEqual(result.changedFiles, []);
    assert.strictEqual(result.diff, "");
    assert.strictEqual(result.truncated, false);
  });

  test("throws when the GitRunner throws (e.g. not a git repo)", () => {
    const brokenRun = (_args: string[]): string => {
      throw new Error("not a git repository");
    };
    assert.throws(() => computeDelta("base", { run: brokenRun }), /not a git repository/);
  });
});

// ─── decideMode ──────────────────────────────────────────────────────────────

describe("repoDelta: decideMode", () => {
  test("returns 'full' when hasBaseline is false", () => {
    assert.strictEqual(
      decideMode({ hasBaseline: false, deltaBytes: 0, maxBytes: 200_000, baseReachable: true }),
      "full"
    );
  });

  test("returns 'full' when baseReachable is false", () => {
    assert.strictEqual(
      decideMode({ hasBaseline: true, deltaBytes: 100, maxBytes: 200_000, baseReachable: false }),
      "full"
    );
  });

  test("returns 'full' when deltaBytes exceeds maxBytes", () => {
    assert.strictEqual(
      decideMode({ hasBaseline: true, deltaBytes: 300_000, maxBytes: 200_000, baseReachable: true }),
      "full"
    );
  });

  test("returns 'delta' when baseline exists, base is reachable, and delta fits", () => {
    assert.strictEqual(
      decideMode({ hasBaseline: true, deltaBytes: 50_000, maxBytes: 200_000, baseReachable: true }),
      "delta"
    );
  });

  test("returns 'delta' when deltaBytes is exactly maxBytes", () => {
    // Not strictly > maxBytes, so should be delta.
    assert.strictEqual(
      decideMode({ hasBaseline: true, deltaBytes: 200_000, maxBytes: 200_000, baseReachable: true }),
      "delta"
    );
  });

  test("returns 'full' when deltaBytes is maxBytes + 1", () => {
    assert.strictEqual(
      decideMode({ hasBaseline: true, deltaBytes: 200_001, maxBytes: 200_000, baseReachable: true }),
      "full"
    );
  });

  test("returns 'full' when both hasBaseline and baseReachable are false", () => {
    assert.strictEqual(
      decideMode({ hasBaseline: false, deltaBytes: 0, maxBytes: 200_000, baseReachable: false }),
      "full"
    );
  });
});
