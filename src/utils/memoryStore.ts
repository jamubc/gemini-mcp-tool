import fs from "node:fs";
import path from "node:path";
import { ENV } from "../constants.js";
import { Logger } from "./logger.js";

/** Maximum allowed size for a single entry (256 KiB). */
const MAX_ENTRY_BYTES = 256 * 1024;

/** Maximum number of entries allowed across all keys. */
const MAX_ENTRIES = 200;

/** Valid key pattern: printable, URL-safe characters only. */
const KEY_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export interface EntryMetadata {
  createdAt: string;
  updatedAt: string;
  bytes: number;
  label?: string;
  tags?: string[];
}

export interface MemoryEntry {
  content: string;
  meta: EntryMetadata;
}

export interface EntryListItem {
  key: string;
  bytes: number;
  updatedAt: string;
  label?: string;
  tags?: string[];
}

// ---------- path helpers ----------

function getMemoryDir(): string {
  const envDir = process.env[ENV.GEMINI_MCP_MEMORY_DIR];
  if (envDir) {
    return path.resolve(envDir);
  }
  return path.join(process.cwd(), ".gemini-mcp", "memory");
}

/**
 * Resolves the absolute path for a key file and verifies that the result
 * stays inside the memory directory (defence against traversal).
 */
function entryPath(memDir: string, key: string): string {
  const resolved = path.resolve(memDir, `${key}.json`);
  if (!resolved.startsWith(memDir + path.sep) && resolved !== memDir) {
    throw new Error(`Path traversal detected for key: ${key}`);
  }
  return resolved;
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    Logger.debug(`memoryStore: created directory ${dir}`);
  }
}

// ---------- validation ----------

function validateKey(key: string): void {
  if (!key || typeof key !== "string") {
    throw new Error("Memory key must be a non-empty string.");
  }
  // Reject absolute paths, home-dir shortcuts, and traversal attempts before
  // the regex check so the error message is maximally helpful.
  if (
    path.isAbsolute(key) ||
    key.startsWith("~") ||
    key.includes("..") ||
    key.includes("/") ||
    key.includes("\\")
  ) {
    throw new Error(
      `Invalid memory key "${key}": keys must match ^[A-Za-z0-9._-]{1,128}$ and may not contain path separators or traversal sequences.`
    );
  }
  if (!KEY_PATTERN.test(key)) {
    throw new Error(
      `Invalid memory key "${key}": must match ^[A-Za-z0-9._-]{1,128}$.`
    );
  }
}

// ---------- public API ----------

/**
 * Persist `content` under `key`. Overwrites any previous value.
 * Throws on key/size violations or when the entry cap is reached.
 */
export function saveEntry(
  key: string,
  content: string,
  meta?: Partial<Pick<EntryMetadata, "label" | "tags">>
): void {
  validateKey(key);

  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > MAX_ENTRY_BYTES) {
    throw new Error(
      `Entry "${key}" is ${bytes} bytes, which exceeds the 256 KiB limit.`
    );
  }

  const memDir = getMemoryDir();
  ensureDir(memDir);

  // Enforce max-entries cap unless we are updating an existing key.
  const filePath = entryPath(memDir, key);
  const isNew = !fs.existsSync(filePath);
  if (isNew) {
    const current = listEntries().length;
    if (current >= MAX_ENTRIES) {
      throw new Error(
        `Memory store is full (${MAX_ENTRIES} entries). Delete entries before adding new ones.`
      );
    }
  }

  const now = new Date().toISOString();
  let createdAt = now;

  if (!isNew) {
    try {
      const existing: MemoryEntry = JSON.parse(fs.readFileSync(filePath, "utf8"));
      createdAt = existing.meta.createdAt ?? now;
    } catch {
      // If we can't read the old file, use now as createdAt.
    }
  }

  const entry: MemoryEntry = {
    content,
    meta: {
      createdAt,
      updatedAt: now,
      bytes,
      ...(meta?.label !== undefined ? { label: meta.label } : {}),
      ...(meta?.tags !== undefined ? { tags: meta.tags } : {}),
    },
  };

  fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf8");
  Logger.debug(`memoryStore: saved "${key}" (${bytes} bytes)`);
}

/**
 * Retrieve the full entry for `key`, or `undefined` if it does not exist.
 */
export function getEntry(key: string): MemoryEntry | undefined {
  validateKey(key);

  const memDir = getMemoryDir();
  const filePath = entryPath(memDir, key);

  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as MemoryEntry;
  } catch (err) {
    Logger.error(`memoryStore: failed to read "${key}": ${err}`);
    throw new Error(`Failed to read memory entry "${key}".`);
  }
}

/**
 * Return summary metadata for every stored key, sorted by `updatedAt` descending.
 */
export function listEntries(): EntryListItem[] {
  const memDir = getMemoryDir();
  if (!fs.existsSync(memDir)) {
    return [];
  }

  const items: EntryListItem[] = [];

  for (const file of fs.readdirSync(memDir)) {
    if (!file.endsWith(".json")) continue;
    const key = file.slice(0, -5); // strip ".json"
    const filePath = path.join(memDir, file);
    try {
      const entry: MemoryEntry = JSON.parse(fs.readFileSync(filePath, "utf8"));
      items.push({
        key,
        bytes: entry.meta.bytes,
        updatedAt: entry.meta.updatedAt,
        ...(entry.meta.label !== undefined ? { label: entry.meta.label } : {}),
        ...(entry.meta.tags !== undefined ? { tags: entry.meta.tags } : {}),
      });
    } catch {
      // Skip corrupt files silently.
    }
  }

  items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return items;
}

/**
 * Remove the entry for `key`. Returns `true` if deleted, `false` if not found.
 */
export function deleteEntry(key: string): boolean {
  validateKey(key);

  const memDir = getMemoryDir();
  const filePath = entryPath(memDir, key);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  Logger.debug(`memoryStore: deleted "${key}"`);
  return true;
}

/**
 * Remove every entry in the memory directory. Does not delete the directory itself.
 */
export function clearAll(): number {
  const memDir = getMemoryDir();
  if (!fs.existsSync(memDir)) {
    return 0;
  }

  let count = 0;
  for (const file of fs.readdirSync(memDir)) {
    if (!file.endsWith(".json")) continue;
    fs.unlinkSync(path.join(memDir, file));
    count++;
  }
  Logger.debug(`memoryStore: cleared ${count} entries`);
  return count;
}
