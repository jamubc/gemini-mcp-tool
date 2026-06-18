# apply-edits

Apply a multi-file changeMode edit set transactionally — validate every OLD block, preview the changes as a unified diff, then write all files at once with automatic rollback on failure.

## Overview

When you ask Gemini to refactor a large codebase using `ask-gemini` with `changeMode:true`, the response contains one or more OLD/NEW edit blocks. `apply-edits` takes that raw text and applies every edit atomically: either all files are updated or none are (if any write fails, already-written files are restored from their original content).

## Workflow

`apply-edits` is intentionally a two-step process to prevent accidental destructive writes.

### Step 1 — Preview (dry run, default)

Call `apply-edits` with only the `edits` parameter (or with `dryRun:true`). No files are written. The tool:

1. Parses all OLD/NEW blocks from the changeMode text.
2. Reads each target file and verifies every OLD block appears **exactly once** (zero or multiple occurrences are reported as errors).
3. Applies all replacements in memory and renders a unified diff preview.

```
apply-edits(
  edits: "<paste the changeMode output from ask-gemini here>"
)
```

If any OLD block cannot be located or is ambiguous, the tool returns an `❌` error listing every problem. No files are modified.

### Step 2 — Apply

Once you are satisfied with the diff preview, re-call with `dryRun:false` and `confirm:true`:

```
apply-edits(
  edits: "<same changeMode text>",
  dryRun: false,
  confirm: true
)
```

All files are written in a single pass. If a write fails partway through (e.g., a permissions error), all previously written files are restored to their original content and the error is surfaced with context.

## Parameters

| Parameter | Type    | Default | Description |
|-----------|---------|---------|-------------|
| `edits`   | string  | —       | **Required.** The raw changeMode OLD/NEW text produced by `ask-gemini` with `changeMode:true`. |
| `dryRun`  | boolean | `true`  | When true, only validate and preview — no files are written. |
| `confirm` | boolean | `false` | Safety gate. Must be `true` (together with `dryRun:false`) to write files. |

## Producing edits with ask-gemini

Run `ask-gemini` with `changeMode:true` to obtain structured edit blocks:

```
ask-gemini(
  prompt: "Rename all occurrences of UserService to AccountService across @src/",
  changeMode: true
)
```

The response will contain blocks like:

```
**FILE: src/services/user.service.ts:1**
` `` `
OLD:
export class UserService {
NEW:
export class AccountService {
` `` `
```

Copy the entire response and pass it as the `edits` parameter to `apply-edits`.

## Error conditions

| Condition | Behaviour |
|-----------|-----------|
| No OLD/NEW blocks found in `edits` | Returns `❌` immediately; nothing is read or written. |
| OLD block not found in file | Returns `❌` with the filename and the first line of the missing OLD block. |
| OLD block found more than once | Returns `❌` flagging the ambiguous match; add more surrounding context lines to the OLD block to make it unique. |
| Path escapes project root (`../`, absolute, `~`) | Returns `❌`; all paths must be relative to the project root. |
| Write fails partway through | Rolls back already-written files, then returns `❌` with full context. |

## Security

All target file paths are resolved relative to the current working directory and confined to it. Absolute paths, `~`-prefixed paths, and `..`-escaping paths are rejected before any file is read or written.

## Example session

```
# 1. Generate edits
ask-gemini(
  prompt: "Replace console.log with Logger.log across @src/",
  changeMode: true
)

# 2. Preview (dry run)
apply-edits(edits: "<output from above>")

# 3. Review the diff, then apply
apply-edits(
  edits: "<same output>",
  dryRun: false,
  confirm: true
)
```
