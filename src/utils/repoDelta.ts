/**
 * repoDelta.ts
 *
 * Utilities for computing an incremental git diff between a baseline ref and HEAD.
 * The GitRunner type is injectable so unit tests can supply a pure-function fake
 * without spawning a real subprocess.
 */
import { spawnSync } from "child_process";
import * as path from "path";
import { Logger } from "./logger.js";

/** A synchronous function that runs git with the given args and returns stdout. */
export type GitRunner = (args: string[]) => string;

export interface DeltaResult {
  baseRef: string;
  headRef: string;
  changedFiles: string[];
  diff: string;
  truncated: boolean;
}

export interface DecideInput {
  hasBaseline: boolean;
  deltaBytes: number;
  maxBytes: number;
  baseReachable: boolean;
}

export type AnalysisMode = "delta" | "full";

/** Default max diff size: 200 KB. */
const DEFAULT_MAX_BYTES = 200_000;

/**
 * Build the default GitRunner that shells out to the real git binary.
 * All paths are confined to cwd, and args are passed as an argv array (no shell string).
 */
export function makeDefaultGitRunner(cwd: string = process.cwd()): GitRunner {
  const normalizedCwd = path.resolve(cwd);
  return (args: string[]): string => {
    const result = spawnSync("git", args, {
      cwd: normalizedCwd,
      encoding: "utf8",
      // Never produce a shell string from user input — args are passed verbatim.
      shell: false,
    });
    if (result.error) {
      throw new Error(`git failed: ${result.error.message}`);
    }
    if (result.status !== 0) {
      throw new Error(
        `git ${args[0] ?? ""} exited with status ${result.status}: ${(result.stderr ?? "").trim()}`
      );
    }
    return (result.stdout ?? "").trim();
  };
}

/**
 * Compute the incremental diff between `baseRef` and HEAD.
 *
 * @param baseRef - A git ref (SHA, branch, tag) to treat as the baseline.
 * @param opts.run      - Injected GitRunner; defaults to the real git binary.
 * @param opts.maxBytes - Cap for the diff text (default 200 000 bytes).
 * @returns DeltaResult describing changed files and the raw diff.
 */
export function computeDelta(
  baseRef: string,
  opts: { run?: GitRunner; maxBytes?: number } = {}
): DeltaResult {
  const run = opts.run ?? makeDefaultGitRunner();
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  Logger.debug(`repoDelta: computing delta from ${baseRef}`);

  // Resolve the current HEAD commit SHA.
  const headRef = run(["rev-parse", "HEAD"]);

  // Obtain the list of files changed between baseRef and HEAD.
  const nameOnlyOutput = run(["diff", "--name-only", `${baseRef}..HEAD`]);
  const committedFiles = nameOnlyOutput
    ? nameOnlyOutput.split("\n").filter(Boolean)
    : [];

  // Also capture untracked / modified working-tree files via `git status`.
  const statusOutput = run(["status", "--porcelain"]);
  const workingFiles = statusOutput
    ? statusOutput
        .split("\n")
        .filter(Boolean)
        .map((line) => line.slice(3).trim())
        .filter(Boolean)
    : [];

  // Deduplicate the combined file list.
  const changedFiles = [
    ...new Set([...committedFiles, ...workingFiles]),
  ];

  // Obtain the full diff text.
  const rawDiff = run(["diff", `${baseRef}..HEAD`]);

  let diff: string;
  let truncated: boolean;

  if (Buffer.byteLength(rawDiff, "utf8") > maxBytes) {
    // Truncate to the byte cap using a character-level approximation.
    // We slice to maxBytes characters (UTF-8 multi-byte chars are unusual in
    // diff output; this is a best-effort limit, not a cryptographic one).
    diff = rawDiff.slice(0, maxBytes);
    truncated = true;
    Logger.debug(
      `repoDelta: diff truncated at ${maxBytes} bytes (raw was ${rawDiff.length} chars)`
    );
  } else {
    diff = rawDiff;
    truncated = false;
  }

  return { baseRef, headRef, changedFiles, diff, truncated };
}

/**
 * Decide whether the next analysis should send the full workspace or just
 * the incremental delta.
 *
 * Returns 'full' when:
 *   - there is no baseline to diff from (fresh session),
 *   - the computed delta exceeds the byte budget (too large for a focused review),
 *   - or the base ref is not reachable in the repo (e.g. shallow clone, force-push).
 *
 * Returns 'delta' otherwise.
 */
export function decideMode(opts: DecideInput): AnalysisMode {
  if (!opts.hasBaseline) {
    Logger.debug("decideMode: no baseline → full");
    return "full";
  }
  if (!opts.baseReachable) {
    Logger.debug("decideMode: base ref unreachable → full");
    return "full";
  }
  if (opts.deltaBytes > opts.maxBytes) {
    Logger.debug(
      `decideMode: delta (${opts.deltaBytes}B) exceeds max (${opts.maxBytes}B) → full`
    );
    return "full";
  }
  Logger.debug("decideMode: delta mode");
  return "delta";
}
