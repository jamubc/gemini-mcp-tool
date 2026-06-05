/**
 * Transactional applier for structured (changeMode) edit sets.
 *
 * All IO is injected so the module stays pure and fully testable without
 * touching the real filesystem.  The execute() in apply-edits.tool.ts wires in
 * the real fs calls.
 */

import * as path from 'path';
import { type ChangeModeEdit } from './changeModeParser.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FilePlan {
  /** Absolute, root-confined path to the target file. */
  path: string;
  originalContent: string;
  newContent: string;
  /** Number of edits applied to this file. */
  editCount: number;
}

export interface ApplyPlan {
  files: FilePlan[];
  /** Validation/confinement errors — if non-empty, nothing has been (or will be) written. */
  errors: string[];
}

export interface PlanApplyOptions {
  readFile: (absPath: string) => string;
  /** The root directory.  All edit filenames must resolve inside it. */
  root: string;
}

export interface CommitPlanOptions {
  writeFile: (absPath: string, content: string) => void;
}

// ---------------------------------------------------------------------------
// Path confinement
// ---------------------------------------------------------------------------

/**
 * Resolves `filename` relative to `root` and asserts it stays inside `root`.
 * Rejects absolute paths, `~`-prefixed paths, and `..`-escaping paths.
 *
 * Throws with a descriptive message on violation (same policy as
 * assertSafeFileReferences in geminiExecutor.ts).
 */
function resolveConfined(filename: string, root: string): string {
  if (path.isAbsolute(filename)) {
    throw new Error(
      `Refusing absolute path in edit filename: "${filename}". ` +
      `All paths must be relative to the project root.`
    );
  }
  if (filename.startsWith('~')) {
    throw new Error(
      `Refusing home-directory path in edit filename: "${filename}". ` +
      `All paths must be relative to the project root.`
    );
  }

  const normalizedRoot = path.resolve(root);
  const resolved = path.resolve(normalizedRoot, filename);

  const escapesRoot =
    resolved !== normalizedRoot &&
    !resolved.startsWith(normalizedRoot + path.sep);

  if (escapesRoot) {
    throw new Error(
      `Refusing path that escapes project root: "${filename}" → "${resolved}". ` +
      `All paths must remain within ${normalizedRoot}.`
    );
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// planApply
// ---------------------------------------------------------------------------

/**
 * Validates every edit in `edits` and builds an in-memory apply plan.
 *
 * Each edit's `oldCode` is located inside the current file content and must
 * occur EXACTLY ONCE.  If it is absent or ambiguous the edit is recorded as
 * an error and planning continues (so all problems surface in one pass).
 *
 * Returns `{ files, errors }`.  When `errors` is non-empty the caller MUST
 * NOT call `commitPlan`.
 */
export function planApply(
  edits: ChangeModeEdit[],
  opts: PlanApplyOptions
): ApplyPlan {
  const { readFile, root } = opts;
  const errors: string[] = [];

  // Group edits by resolved absolute path so per-file content is read once and
  // edits are applied in order.
  const fileEdits = new Map<
    string,
    { filename: string; edit: ChangeModeEdit }[]
  >();

  for (const edit of edits) {
    let absPath: string;
    try {
      absPath = resolveConfined(edit.filename, root);
    } catch (err) {
      errors.push((err as Error).message);
      continue;
    }
    const bucket = fileEdits.get(absPath) ?? [];
    bucket.push({ filename: edit.filename, edit });
    fileEdits.set(absPath, bucket);
  }

  const filePlans: FilePlan[] = [];

  for (const [absPath, entries] of fileEdits) {
    let originalContent: string;
    try {
      originalContent = readFile(absPath);
    } catch (err) {
      errors.push(
        `Cannot read "${entries[0].filename}": ${(err as Error).message}`
      );
      continue;
    }

    let currentContent = originalContent;
    let fileErrors = 0;

    for (const { filename, edit } of entries) {
      const { oldCode, newCode } = edit;

      // Count occurrences of oldCode in the current (already-partially-edited) content.
      const occurrences = countOccurrences(currentContent, oldCode);

      if (occurrences === 0) {
        errors.push(
          `Edit not found in "${filename}": ` +
          `OLD block starting with ${JSON.stringify(firstLine(oldCode))} was not found.`
        );
        fileErrors++;
        continue;
      }

      if (occurrences > 1) {
        errors.push(
          `Ambiguous edit in "${filename}": ` +
          `OLD block starting with ${JSON.stringify(firstLine(oldCode))} ` +
          `matches ${occurrences} locations. ` +
          `Add more surrounding context to make it unique.`
        );
        fileErrors++;
        continue;
      }

      // Exactly one occurrence — apply in-memory.
      currentContent = currentContent.replace(oldCode, () => newCode);
    }

    if (fileErrors === 0) {
      filePlans.push({
        path: absPath,
        originalContent,
        newContent: currentContent,
        editCount: entries.length,
      });
    }
  }

  return { files: filePlans, errors };
}

// ---------------------------------------------------------------------------
// renderDiff
// ---------------------------------------------------------------------------

/**
 * Returns a unified-diff-style preview of the plan.  No external deps — uses
 * a simple line-based algorithm with `---`/`+++` headers and `+`/`-` prefixes.
 */
export function renderDiff(plan: ApplyPlan): string {
  if (plan.files.length === 0) {
    return '(no changes)';
  }

  const parts: string[] = [];

  for (const file of plan.files) {
    parts.push(`--- ${file.path}`);
    parts.push(`+++ ${file.path}`);

    const oldLines = file.originalContent.split('\n');
    const newLines = file.newContent.split('\n');

    // Compute a simple diff: find changed regions with a line-by-line scan.
    const hunks = computeHunks(oldLines, newLines);
    for (const hunk of hunks) {
      parts.push(hunk);
    }
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// commitPlan
// ---------------------------------------------------------------------------

/**
 * Writes every file in the plan.  Requires `plan.errors` to be empty.
 *
 * If a write throws partway through, all already-written files are restored
 * to their `originalContent` before re-throwing.
 */
export function commitPlan(plan: ApplyPlan, opts: CommitPlanOptions): void {
  if (plan.errors.length > 0) {
    throw new Error(
      `commitPlan called with a plan that has errors:\n${plan.errors.join('\n')}`
    );
  }

  const { writeFile } = opts;
  const written: FilePlan[] = [];

  for (const file of plan.files) {
    try {
      writeFile(file.path, file.newContent);
      written.push(file);
    } catch (writeErr) {
      // Rollback all previously written files.
      const rollbackErrors: string[] = [];
      for (const prev of written) {
        try {
          writeFile(prev.path, prev.originalContent);
        } catch (rollbackErr) {
          rollbackErrors.push(
            `Failed to restore "${prev.path}": ${(rollbackErr as Error).message}`
          );
        }
      }

      const base = `Write failed for "${file.path}": ${(writeErr as Error).message}`;
      const suffix =
        rollbackErrors.length > 0
          ? `\nAdditional rollback failures:\n${rollbackErrors.join('\n')}`
          : `\n${written.length} previously written file(s) restored to original content.`;

      throw new Error(base + suffix);
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Count non-overlapping occurrences of `needle` in `haystack`. */
function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}

/** Return the first line of a potentially multi-line string. */
function firstLine(s: string): string {
  const idx = s.indexOf('\n');
  return idx === -1 ? s : s.slice(0, idx);
}

// ---------------------------------------------------------------------------
// Diff internals
// ---------------------------------------------------------------------------

interface DiffOp {
  type: 'equal' | 'add' | 'remove';
  line: string;
}

/**
 * Iterative O(n·m) LCS-based line diff.  No recursion, no stack overflow.
 * Produces a minimal edit script using the standard DP table approach.
 */
function diffLines(a: string[], b: string[]): DiffOp[] {
  const m = a.length;
  const n = b.length;

  // Build LCS length table.
  // dp[i][j] = LCS length of a[0..i-1] vs b[0..j-1]
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = new Array(n + 1).fill(0);
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Back-track to build the edit sequence.
  const ops: DiffOp[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ type: 'equal', line: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'add', line: b[j - 1] });
      j--;
    } else {
      ops.push({ type: 'remove', line: a[i - 1] });
      i--;
    }
  }
  ops.reverse();
  return ops;
}

/**
 * Produce unified-diff hunk strings from two line arrays.
 * Uses a simple context-window approach after building the full edit sequence.
 */
function computeHunks(oldLines: string[], newLines: string[]): string[] {
  const CONTEXT = 3;
  const ops = diffLines(oldLines, newLines);

  if (ops.every(o => o.type === 'equal')) return [];

  const result: string[] = [];

  // Find changed op indices.
  const changedAt = ops
    .map((o, idx) => ({ o, idx }))
    .filter(x => x.o.type !== 'equal')
    .map(x => x.idx);

  if (changedAt.length === 0) return [];

  // Merge nearby changed regions into hunks (within 2*CONTEXT of each other).
  const regions: Array<{ lo: number; hi: number }> = [];
  let lo = Math.max(0, changedAt[0] - CONTEXT);
  let hi = Math.min(ops.length - 1, changedAt[0] + CONTEXT);

  for (let k = 1; k < changedAt.length; k++) {
    const next = changedAt[k];
    const nextHi = Math.min(ops.length - 1, next + CONTEXT);
    if (next - CONTEXT <= hi + 1) {
      hi = nextHi;
    } else {
      regions.push({ lo, hi });
      lo = Math.max(0, next - CONTEXT);
      hi = nextHi;
    }
  }
  regions.push({ lo, hi });

  // Compute line numbers and emit each region as a hunk.
  for (const region of regions) {
    const hunkOps = ops.slice(region.lo, region.hi + 1);

    // Line numbers: count non-add ops before region.lo for old; non-remove for new.
    const oldLineNum =
      ops.slice(0, region.lo).filter(o => o.type !== 'add').length + 1;
    const newLineNum =
      ops.slice(0, region.lo).filter(o => o.type !== 'remove').length + 1;
    const oldCount = hunkOps.filter(o => o.type !== 'add').length;
    const newCount = hunkOps.filter(o => o.type !== 'remove').length;

    result.push(`@@ -${oldLineNum},${oldCount} +${newLineNum},${newCount} @@`);
    for (const op of hunkOps) {
      if (op.type === 'equal') result.push(` ${op.line}`);
      else if (op.type === 'remove') result.push(`-${op.line}`);
      else result.push(`+${op.line}`);
    }
  }

  return result;
}
