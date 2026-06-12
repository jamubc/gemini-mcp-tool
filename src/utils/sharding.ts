import * as fs from 'node:fs';
import * as path from 'node:path';

/** A single shard: an ordered list of files to be analyzed together. */
export interface Shard {
  files: Array<{ path: string; bytes: number }>;
}

/**
 * Greedy bin-packs `files` into shards so that each shard stays as close to
 * `targetBytesPerShard` as possible without splitting individual files.
 *
 * Rules:
 * - Empty input → []
 * - A file that is larger than `targetBytesPerShard` on its own becomes its own shard.
 * - `maxFilesPerShard`, when provided, caps the number of files per shard.
 * - Input order is preserved within and across shards.
 */
export function planShards(
  files: Array<{ path: string; bytes: number }>,
  targetBytesPerShard: number,
  maxFilesPerShard?: number,
): Shard[] {
  if (files.length === 0) return [];

  const shards: Shard[] = [];
  let currentShard: Shard = { files: [] };
  let currentBytes = 0;

  for (const file of files) {
    const wouldExceedBytes = currentBytes + file.bytes > targetBytesPerShard;
    const wouldExceedFiles =
      maxFilesPerShard !== undefined && currentShard.files.length >= maxFilesPerShard;

    // If the current shard already has files and adding this one would exceed limits,
    // close the current shard and open a new one.
    if (currentShard.files.length > 0 && (wouldExceedBytes || wouldExceedFiles)) {
      shards.push(currentShard);
      currentShard = { files: [] };
      currentBytes = 0;
    }

    currentShard.files.push(file);
    currentBytes += file.bytes;
  }

  if (currentShard.files.length > 0) {
    shards.push(currentShard);
  }

  return shards;
}

/** Directories and patterns to skip when walking the workspace. */
const DEFAULT_IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.gemini-mcp',
  '.tmptest',
]);

export interface CollectFilesOptions {
  ignoreDirs?: Set<string>;
}

/**
 * Recursively collects all files under `root`, skipping ignored directories,
 * and returns their absolute paths + byte sizes.
 *
 * Security: `root` must resolve within `process.cwd()`.  Symlinks that escape
 * the root are not followed (readdir uses `withFileTypes`; stat is called on
 * the resolved entry, not the symlink target, because we just want the size).
 */
export function collectFiles(
  root: string,
  opts?: CollectFilesOptions,
): Array<{ path: string; bytes: number }> {
  const cwd = process.cwd();
  const resolvedRoot = path.resolve(root);

  // Confine to cwd.
  const normalizedCwd = path.resolve(cwd);
  const escapesRoot =
    resolvedRoot !== normalizedCwd &&
    !resolvedRoot.startsWith(normalizedCwd + path.sep);
  if (escapesRoot) {
    throw new Error(
      `collectFiles: root "${root}" resolves to "${resolvedRoot}" which is outside the working directory "${normalizedCwd}".`,
    );
  }

  const ignoreDirs = opts?.ignoreDirs ?? DEFAULT_IGNORE_DIRS;
  const results: Array<{ path: string; bytes: number }> = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // inaccessible directory — skip silently
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (ignoreDirs.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        const fullPath = path.join(dir, entry.name);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          continue; // unreadable — skip
        }
        results.push({ path: fullPath, bytes: stat.size });
      }
      // Symlinks: skip (don't follow, avoids escape vectors)
    }
  }

  walk(resolvedRoot);
  return results;
}
