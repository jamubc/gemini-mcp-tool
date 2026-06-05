# Memory Tool

The `memory` tool provides a project-scoped, durable scratchpad. It stores and retrieves plain-text entries on disk so that working context survives context-window compaction, process restarts, and session resets — without making any Gemini calls.

## Overview

| Action   | Description                                  |
|----------|----------------------------------------------|
| `store`  | Persist a value under a key                  |
| `recall` | Retrieve a previously stored value           |
| `list`   | Show all entries (key, size, updated, label) |
| `delete` | Remove a single entry                        |
| `clear`  | Remove all entries                           |

## Storage location

Entries are stored as JSON files under:

```
<project-root>/.gemini-mcp/memory/
```

Override with the `GEMINI_MCP_MEMORY_DIR` environment variable.

The directory is created lazily on first write and is listed in `.gitignore` by default so no working notes are accidentally committed.

## Limits

| Constraint         | Value   |
|--------------------|---------|
| Max entry size     | 256 KiB |
| Max total entries  | 200     |
| Key character set  | `^[A-Za-z0-9._-]{1,128}$` |

## Usage examples

### Store a value

```json
{
  "action": "store",
  "key": "refactor-plan",
  "content": "Phase 1: extract service layer. Phase 2: update controllers.",
  "label": "Refactor notes",
  "tags": ["refactor", "architecture"]
}
```

### Recall a value

```json
{
  "action": "recall",
  "key": "refactor-plan"
}
```

Returns the stored text prefixed with metadata. Returns a `❌` message if the key is not found.

### List all entries

```json
{ "action": "list" }
```

Returns a markdown table:

| Key | Bytes | Updated | Label | Tags |
|-----|-------|---------|-------|------|
| `refactor-plan` | 62 | 2025-06-05T… | Refactor notes | refactor, architecture |

### Delete one entry

```json
{
  "action": "delete",
  "key": "refactor-plan"
}
```

### Clear the entire store

```json
{ "action": "clear" }
```

## Wiring to a pre-compaction hook

The memory tool is designed for use in the MCP client's compaction flow. A common pattern:

**Before compaction** — invoke `memory` with `action: store` to checkpoint the most important working notes.

```json
{
  "action": "store",
  "key": "session-context",
  "content": "<summary of current task state, open questions, and next steps>"
}
```

**After compaction** — invoke `memory` with `action: recall` to restore context into the new session.

```json
{
  "action": "recall",
  "key": "session-context"
}
```

Because the memory store is pure local I/O, these calls complete in milliseconds and do not consume any Gemini quota.

## Key naming conventions

Keys must match `^[A-Za-z0-9._-]{1,128}$`. Suggested conventions:

- `session-context` — general session state
- `task.<name>` — per-task notes, e.g. `task.auth-refactor`
- `decision.<topic>` — architectural decisions, e.g. `decision.db-choice`

Path separators (`/`, `\`), traversal sequences (`..`), home-dir shortcuts (`~`), and absolute paths are all rejected.
