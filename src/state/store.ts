import * as fs from 'fs';
import * as path from 'path';
import { ENV } from '../constants.js';

/**
 * Regular expression that keys must match.
 * Rejects empty strings, path-separator sequences, and any character that
 * could be used for path traversal or shell injection.
 */
const KEY_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Assert that a key is safe to use as a file name and map key.
 * Explicit checks for absolute paths and traversal sequences are included
 * in addition to the allowlist pattern so the intent is clear to reviewers.
 */
function assertSafeKey(key: string): void {
  if (!key || key.includes('/') || key.includes('\\') || key.includes('..')) {
    throw new Error(
      `Invalid state key "${key}": keys must match ${KEY_PATTERN} ` +
      `and must not contain path separators or traversal sequences.`,
    );
  }
  if (path.isAbsolute(key)) {
    throw new Error(`Invalid state key "${key}": absolute paths are not permitted.`);
  }
  if (!KEY_PATTERN.test(key)) {
    throw new Error(
      `Invalid state key "${key}": only [A-Za-z0-9._-] (1-128 chars) are allowed.`,
    );
  }
}

/**
 * A minimal key-value store interface.
 */
export interface StateStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  delete(key: string): void;
  keys(): string[];
}

/**
 * In-memory store backed by a plain Map.
 * Values are not persisted across process restarts.
 */
export class MemoryStore implements StateStore {
  private readonly _data = new Map<string, unknown>();

  get<T>(key: string): T | undefined {
    assertSafeKey(key);
    return this._data.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    assertSafeKey(key);
    this._data.set(key, value);
  }

  delete(key: string): void {
    assertSafeKey(key);
    this._data.delete(key);
  }

  keys(): string[] {
    return [...this._data.keys()];
  }
}

/**
 * File-backed store that persists each key as a JSON file under a directory.
 *
 * The storage directory defaults to `.gemini-mcp` inside the current working
 * directory but can be overridden via the GEMINI_MCP_STATE_DIR environment
 * variable. The directory is created lazily on first write.
 *
 * All file paths are confined to the storage directory; key validation
 * prevents traversal.
 */
export class JsonFileStore implements StateStore {
  private readonly _dir: string;

  constructor(dir?: string) {
    this._dir = path.resolve(
      dir ??
      process.env[ENV.GEMINI_MCP_STATE_DIR] ??
      path.join(process.cwd(), '.gemini-mcp'),
    );
  }

  private _filePath(key: string): string {
    assertSafeKey(key);
    const filePath = path.join(this._dir, `${key}.json`);
    // Double-check confinement after path.join resolution
    if (!filePath.startsWith(this._dir + path.sep) && filePath !== this._dir) {
      throw new Error(
        `Refusing to access "${filePath}": resolved path escapes the state directory "${this._dir}".`,
      );
    }
    return filePath;
  }

  private _ensureDir(): void {
    if (!fs.existsSync(this._dir)) {
      fs.mkdirSync(this._dir, { recursive: true });
    }
  }

  get<T>(key: string): T | undefined {
    const filePath = this._filePath(key);
    if (!fs.existsSync(filePath)) return undefined;
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  set<T>(key: string, value: T): void {
    const filePath = this._filePath(key);
    this._ensureDir();
    fs.writeFileSync(filePath, JSON.stringify(value), 'utf8');
  }

  delete(key: string): void {
    const filePath = this._filePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  keys(): string[] {
    if (!fs.existsSync(this._dir)) return [];
    return fs
      .readdirSync(this._dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5)); // strip .json suffix
  }
}
