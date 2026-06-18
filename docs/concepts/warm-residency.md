# Warm Repo Residency

## Overview

The `warm-analyze` tool implements *warm repo residency*: rather than shipping
the entire repository to Gemini on every call, it tracks a **baseline** commit
SHA and, on follow-up calls, sends only the incremental `git diff` since that
baseline.

This pattern is well-suited to iterative review sessions—think code-review
rounds, refactoring feedback loops, or CI-integrated quality gates—where
re-sending the full workspace on every call wastes both tokens and time.

---

## How it works

### 1. Baseline pass (first call or `reset: true`)

When no baseline is stored, or when `reset: true` is supplied, `warm-analyze`:

1. Records the current `HEAD` SHA as the baseline in `.gemini-mcp/residency.json`.
2. Runs Gemini over the full workspace using the supplied prompt (identical to
   `ask-gemini` behaviour).
3. Returns the analysis with a note confirming the baseline was recorded.

### 2. Delta pass (subsequent calls)

On subsequent calls `warm-analyze`:

1. Reads the stored baseline SHA.
2. Checks whether that ref is still reachable in the local history.
3. Runs `git diff <base>..HEAD` and `git status --porcelain` to identify
   changed files and produce a unified diff.
4. Applies the **mode decision** (see below).

#### Mode decision

| Condition | Mode |
|---|---|
| No baseline stored | `full` |
| Baseline ref not reachable | `full` |
| Diff size exceeds `GEMINI_MCP_MAX_DELTA_BYTES` | `full` |
| Otherwise | `delta` |

- **`delta` mode** — builds a focused prompt containing only the changed-file
  list and the unified diff, appends the user's question, and calls Gemini.
- **`full` mode** — falls back to full-workspace analysis, updates the
  baseline, and notes the reason in the response.

---

## Configuration

| Environment variable | Default | Description |
|---|---|---|
| `GEMINI_MCP_STATE_DIR` | `.gemini-mcp` | Directory (relative to project root) where `residency.json` is stored. |
| `GEMINI_MCP_MAX_DELTA_BYTES` | `200000` | Maximum diff size in bytes before falling back to full-workspace mode. |

Both variables are resolved relative to `process.cwd()` and are confined to
the project root—values that escape the root are rejected.

---

## Storage format

`<GEMINI_MCP_STATE_DIR>/residency.json` contains:

```json
{
  "baseSha": "abc123...",
  "createdAt": "2026-06-05T10:00:00.000Z"
}
```

The file is created lazily on the first `setBaseline` call. Add
`<GEMINI_MCP_STATE_DIR>/` (default `.gemini-mcp/`) to `.gitignore` to avoid
committing session state.

---

## Tool parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `prompt` | `string` | Yes | Analysis question or review request. |
| `reset` | `boolean` | No | Force a new baseline pass even if one exists. |
| `model` | `string` | No | Override the Gemini model (e.g. `gemini-2.5-flash`). |

---

## Security notes

- All path resolution is anchored at `process.cwd()`.  A `GEMINI_MCP_STATE_DIR`
  value that resolves outside the project root is rejected with an error.
- Git commands are executed via `spawnSync` with `shell: false`; no shell
  string is constructed from user input.
- `@file` references in prompts still pass through the existing
  `assertSafeFileReferences` check in the Gemini executor.
