import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";
import { Logger } from "../utils/logger.js";

// node:sqlite has no ESM export on current Node; reach it via createRequire so
// the lazy, guarded load below works under "type": "module".
const nodeRequire = createRequire(import.meta.url);

/**
 * Recovers `agy` model replies from its on-disk transcript.
 *
 * Why this exists: `agy -p` (print mode) in 1.0.x returns exit 0 but writes
 * nothing to stdout — the reply only lands in agy's own transcript files. This
 * module is the deliberately-isolated "private contract" reader so the rest of
 * the backend doesn't bake in agy's internal layout. See
 * docs/migration/antigravity-cli.md (§1) for the full rationale and the upstream
 * fix (antigravity-cli#7) that will let us delete it.
 *
 * agy 1.0.5 already dual-writes a `.db` alongside the `.jsonl`; when JSONL stops
 * being generated we need the SQLite path. Both live behind readResponse().
 */

const AGY_BASE = path.join(os.homedir(), ".gemini", "antigravity-cli");
const LAST_CONVERSATIONS = path.join(AGY_BASE, "cache", "last_conversations.json");
const logsDir = (id: string) =>
  path.join(AGY_BASE, "brain", id, ".system_generated", "logs");
const jsonlPath = (id: string) => path.join(logsDir(id), "transcript.jsonl");
const brainDir = path.join(AGY_BASE, "brain");
// agy 1.0.x dual-writes a SQLite `.db`; observed locations vary by build — either
// alongside the JSONL in the logs dir, or under a separate conversations/ dir.
const conversationDbPath = (id: string) => path.join(AGY_BASE, "conversations", `${id}.db`);

export interface TranscriptEntry {
  source?: string;
  type?: string;
  status?: string;
  content?: string;
}

/** Map the current workspace directory to its most recent agy conversation id. */
export function conversationIdForCwd(cwd: string): string | undefined {
  try {
    const map = JSON.parse(readFileSync(LAST_CONVERSATIONS, "utf8")) as Record<string, string>;
    return map[cwd] ?? map[path.resolve(cwd)];
  } catch (e) {
    Logger.warn(`agy: could not read last_conversations.json: ${(e as Error).message}`);
    return undefined;
  }
}

/**
 * Fallback discovery: the newest conversation directory whose logs were written
 * at or after `sinceMs`. Bounding by start time stops us returning a stale reply
 * from a previous run when last_conversations.json lookup misses or races.
 */
export function newestConversationSince(sinceMs: number): string | undefined {
  let best: { id: string; mtime: number } | undefined;
  let ids: string[];
  try {
    ids = readdirSync(brainDir);
  } catch {
    return undefined;
  }
  for (const id of ids) {
    const dir = logsDir(id);
    let mtime: number;
    try {
      mtime = statSync(dir).mtimeMs;
    } catch {
      continue;
    }
    if (mtime + 1 < sinceMs) continue; // +1ms slack for coarse fs timestamps
    if (!best || mtime > best.mtime) best = { id, mtime };
  }
  return best?.id;
}

/** Whether conversation `id`'s transcript was (re)written at or after `sinceMs`. */
export function conversationFreshSince(id: string, sinceMs: number): boolean {
  try {
    return statSync(logsDir(id)).mtimeMs + 1 >= sinceMs;
  } catch {
    return false;
  }
}

/** Extract DONE planner replies that follow the last user input. */
export function extractReplies(entries: TranscriptEntry[]): string {
  let lastUserIdx = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].type === "USER_INPUT") {
      lastUserIdx = i;
      break;
    }
  }
  const replies = entries
    .slice(lastUserIdx + 1)
    .filter(
      (e) =>
        e.source === "MODEL" &&
        e.type === "PLANNER_RESPONSE" &&
        e.status === "DONE" &&
        typeof e.content === "string",
    )
    .map((e) => e.content as string);
  return replies.join("\n\n").trim();
}

function readJsonlResponse(id: string): string {
  const lines = readFileSync(jsonlPath(id), "utf8").split(/\r?\n/).filter(Boolean);
  const entries: TranscriptEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as TranscriptEntry);
    } catch {
      /* skip malformed lines */
    }
  }
  return extractReplies(entries);
}

/** Locate the SQLite transcript for a conversation across known agy layouts. */
function findSqlite(id: string): string | undefined {
  // (a) alongside the JSONL in the logs dir...
  try {
    const file = readdirSync(logsDir(id)).find((f) => f.endsWith(".db"));
    if (file) return path.join(logsDir(id), file);
  } catch {
    /* logs dir may not exist */
  }
  // (b) ...or the separate conversations/<id>.db some builds use.
  const conv = conversationDbPath(id);
  return existsSync(conv) ? conv : undefined;
}

/**
 * SQLite reader for when agy drops JSONL in favour of its dual-written `.db`.
 * The schema isn't publicly documented, so this is best-effort: it scans every
 * table for rows that JSON-parse into transcript entries and reuses the same
 * extraction. If `node:sqlite` is unavailable (Node < 22.5) or nothing parses,
 * it throws an actionable error rather than returning a wrong answer.
 */
function readSqliteResponse(dbPath: string): string {
  let DatabaseSync: new (p: string, opts?: object) => {
    prepare(sql: string): { all(...params: unknown[]): Array<Record<string, unknown>> };
    close(): void;
  };
  try {
    // Lazy, guarded: node:sqlite is experimental and only present on newer Node.
    ({ DatabaseSync } = nodeRequire("node:sqlite"));
  } catch {
    throw new Error(
      `agy: transcript is SQLite-only (${dbPath}) but node:sqlite is unavailable. ` +
        `Upgrade to Node >= 22.5, or wait for the agy '-p' stdout fix (antigravity-cli#7).`,
    );
  }

  const db = new DatabaseSync(dbPath, { readOnly: true } as object);
  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => String(r.name));

    const entries: TranscriptEntry[] = [];
    for (const table of tables) {
      let rows: Array<Record<string, unknown>>;
      try {
        rows = db.prepare(`SELECT * FROM "${table}"`).all();
      } catch {
        continue;
      }
      for (const row of rows) {
        for (const value of Object.values(row)) {
          if (typeof value !== "string") continue;
          const trimmed = value.trim();
          // Skip non-JSON cells without paying for a thrown exception each.
          if (trimmed[0] !== "{" && trimmed[0] !== "[") continue;
          try {
            const parsed = JSON.parse(trimmed) as TranscriptEntry;
            if (parsed && (parsed.type || parsed.source)) entries.push(parsed);
          } catch {
            /* not a JSON cell */
          }
        }
      }
    }

    const text = extractReplies(entries);
    if (!text) {
      throw new Error(
        `agy: found a SQLite transcript (${dbPath}) but could not extract a model reply ` +
          `from its schema. Please report this with the agy version (the schema is not yet public).`,
      );
    }
    return text;
  } finally {
    db.close();
  }
}

/**
 * Read the model's reply for a conversation, preferring JSONL and falling back
 * to SQLite. Throws with a clear message if neither yields a reply.
 */
export function readTranscriptResponse(id: string): string {
  if (existsSync(jsonlPath(id))) {
    try {
      const text = readJsonlResponse(id);
      if (text) return text;
    } catch (e) {
      // TOCTOU/permissions: fall through to the SQLite reader rather than throw.
      Logger.warn(`agy: JSONL read failed for ${id}, trying SQLite: ${(e as Error).message}`);
    }
  }
  const db = findSqlite(id);
  if (db) return readSqliteResponse(db);
  throw new Error(
    `agy: no model response found for conversation ${id} (looked for ` +
      `${jsonlPath(id)} and a .db fallback).`,
  );
}
