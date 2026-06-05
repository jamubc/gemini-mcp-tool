/**
 * Integration tests for warm-residency: computeDelta (real git) and
 * residencyState round-trip.
 *
 * git is available in this environment; no Gemini CLI is involved.
 * Each test creates its own isolated temporary directory so tests can run
 * serially without side effects.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawnSync } from "child_process";

import { computeDelta, makeDefaultGitRunner } from "../../src/utils/repoDelta.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Create a temporary directory and return its path. */
function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Remove a temp dir after use. */
function rmrf(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

/** Run a git command in a dir, throw on failure. */
function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", shell: false });
  if (r.status !== 0 || r.error) {
    throw new Error(`git ${args[0]}: ${(r.stderr ?? "").trim() || r.error?.message}`);
  }
  return (r.stdout ?? "").trim();
}

/**
 * Bootstrap a minimal git repo: init, set identity, create an initial commit.
 * Returns the SHA of the initial commit.
 */
function bootstrapRepo(dir: string): string {
  git(dir, "init");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "Test");
  // Ensure branch is named 'main' regardless of system defaults.
  git(dir, "checkout", "-b", "main");
  const readmePath = path.join(dir, "README.md");
  fs.writeFileSync(readmePath, "# test repo\n", "utf8");
  git(dir, "add", "README.md");
  git(dir, "commit", "-m", "chore: initial commit");
  return git(dir, "rev-parse", "HEAD");
}

// ─── computeDelta integration ─────────────────────────────────────────────────

describe("Integration: computeDelta with real git", () => {
  const dirs: string[] = [];
  after(() => dirs.forEach(rmrf));

  test("detects a new file added after the baseline commit", () => {
    const dir = makeTempDir("warm-delta-");
    dirs.push(dir);

    const baseSha = bootstrapRepo(dir);

    // Add a new file and commit it.
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src", "new.ts"), "export {};", "utf8");
    git(dir, "add", ".");
    git(dir, "commit", "-m", "feat: add new.ts");

    const run = makeDefaultGitRunner(dir);
    const result = computeDelta(baseSha, { run });

    assert.ok(result.changedFiles.includes("src/new.ts"), "should include src/new.ts");
    assert.ok(result.diff.includes("new.ts"), "diff should mention new.ts");
    assert.strictEqual(result.baseRef, baseSha);
    assert.notStrictEqual(result.headRef, baseSha, "headRef differs from base after commit");
    assert.strictEqual(result.truncated, false);
  });

  test("detects a modification to an existing file", () => {
    const dir = makeTempDir("warm-delta-mod-");
    dirs.push(dir);

    const baseSha = bootstrapRepo(dir);

    // Modify the README after baseline.
    fs.writeFileSync(path.join(dir, "README.md"), "# updated\n", "utf8");
    git(dir, "add", "README.md");
    git(dir, "commit", "-m", "docs: update readme");

    const run = makeDefaultGitRunner(dir);
    const result = computeDelta(baseSha, { run });

    assert.ok(result.changedFiles.includes("README.md"));
    assert.ok(result.diff.includes("updated"));
  });

  test("returns empty changedFiles and diff when there are no commits after baseline", () => {
    const dir = makeTempDir("warm-delta-empty-");
    dirs.push(dir);

    const baseSha = bootstrapRepo(dir);

    const run = makeDefaultGitRunner(dir);
    const result = computeDelta(baseSha, { run });

    // HEAD equals base — no diff.
    assert.strictEqual(result.headRef, baseSha);
    assert.deepStrictEqual(result.changedFiles, []);
    assert.strictEqual(result.diff, "");
    assert.strictEqual(result.truncated, false);
  });

  test("respects maxBytes and marks truncated when diff is huge", () => {
    const dir = makeTempDir("warm-delta-trunc-");
    dirs.push(dir);

    const baseSha = bootstrapRepo(dir);

    // Write a large file to exceed a tiny cap.
    fs.writeFileSync(path.join(dir, "big.txt"), "z".repeat(2000), "utf8");
    git(dir, "add", "big.txt");
    git(dir, "commit", "-m", "chore: big file");

    const run = makeDefaultGitRunner(dir);
    const result = computeDelta(baseSha, { run, maxBytes: 50 });

    assert.strictEqual(result.truncated, true);
    assert.ok(result.diff.length <= 50);
  });
});

// ─── residencyState round-trip integration ────────────────────────────────────

describe("Integration: residencyState round-trip", () => {
  const dirs: string[] = [];
  after(() => dirs.forEach(rmrf));

  test("getBaseline returns null when no state file exists", async () => {
    const tmpDir = makeTempDir("warm-state-");
    dirs.push(tmpDir);

    const origCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      // Import fresh to respect the new cwd.
      const { getBaseline } = await import("../../src/utils/residencyState.js");
      const result = getBaseline();
      assert.strictEqual(result, null);
    } finally {
      process.chdir(origCwd);
    }
  });

  test("setBaseline persists SHA and getBaseline reads it back", async () => {
    const tmpDir = makeTempDir("warm-state-rw-");
    dirs.push(tmpDir);

    const origCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const { getBaseline, setBaseline, clearBaseline } =
        await import("../../src/utils/residencyState.js");

      // Start clean.
      clearBaseline();
      assert.strictEqual(getBaseline(), null);

      const sha = "abc123def456";
      setBaseline(sha);

      const got = getBaseline();
      assert.ok(got !== null, "baseline should be set");
      assert.strictEqual(got.baseSha, sha);
      assert.ok(got.createdAt, "createdAt should be populated");
      assert.doesNotThrow(() => new Date(got.createdAt), "createdAt should be a valid ISO date");

      // Verify the file is in the expected directory.
      const stateFile = path.join(tmpDir, ".gemini-mcp", "residency.json");
      assert.ok(fs.existsSync(stateFile), "residency.json should exist");

      // clearBaseline should remove it.
      clearBaseline();
      assert.strictEqual(getBaseline(), null);
      assert.ok(!fs.existsSync(stateFile), "residency.json should be gone after clear");
    } finally {
      process.chdir(origCwd);
    }
  });

  test("setBaseline overwrites an earlier baseline", async () => {
    const tmpDir = makeTempDir("warm-state-overwrite-");
    dirs.push(tmpDir);

    const origCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const { getBaseline, setBaseline, clearBaseline } =
        await import("../../src/utils/residencyState.js");

      clearBaseline();
      setBaseline("sha-first");
      setBaseline("sha-second");

      const got = getBaseline();
      assert.ok(got !== null);
      assert.strictEqual(got.baseSha, "sha-second");
    } finally {
      process.chdir(origCwd);
    }
  });

  test("GEMINI_MCP_STATE_DIR env override changes the storage directory", async () => {
    const tmpDir = makeTempDir("warm-state-envdir-");
    dirs.push(tmpDir);
    const customSubdir = "my-custom-state";

    const origCwd = process.cwd();
    const origEnv = process.env["GEMINI_MCP_STATE_DIR"];
    process.chdir(tmpDir);
    process.env["GEMINI_MCP_STATE_DIR"] = customSubdir;

    try {
      const { getBaseline, setBaseline, clearBaseline } =
        await import("../../src/utils/residencyState.js");

      clearBaseline();
      setBaseline("env-sha");

      const customFile = path.join(tmpDir, customSubdir, "residency.json");
      assert.ok(
        fs.existsSync(customFile),
        `residency.json should exist at custom path: ${customFile}`
      );

      const got = getBaseline();
      assert.ok(got !== null);
      assert.strictEqual(got.baseSha, "env-sha");

      clearBaseline();
    } finally {
      process.chdir(origCwd);
      if (origEnv === undefined) {
        delete process.env["GEMINI_MCP_STATE_DIR"];
      } else {
        process.env["GEMINI_MCP_STATE_DIR"] = origEnv;
      }
    }
  });
});
