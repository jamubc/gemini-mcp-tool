# Migrating from Gemini CLI to Antigravity CLI (`agy`)

> **`agy` is the default backend from 2026-06-18.** On that date Google retired the Gemini CLI for free, Google AI Pro, and Google AI Ultra users. `gemini-mcp-tool` now runs on the Antigravity CLI (`agy`) by default and uses `gemini` only when you ask for it. Tracking: [discussion #90](https://github.com/jamubc/gemini-mcp-tool/discussions/90).

## Who this affects

`gemini-mcp-tool` is a thin wrapper: it shells out to a CLI and reads the answer back. When that CLI stops serving requests, every tool here (`ask-gemini`, `brainstorm`, changeMode edits, `@file` analysis) stops with it.

- **Free, Pro, Ultra, and individual Code Assist / GitHub-org users:** the Gemini CLI stopped answering on **2026-06-18**. Move to `agy` (it is already the default).
- **Enterprise / Standard-license and paid-API-key users:** your Gemini CLI access is unaffected. Set `GEMINI_MCP_BACKEND=gemini` to stay on it.

## Install agy

`agy` is a Go binary, separate from the old npm-installed `gemini`:

```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash   # macOS / Linux
```

It installs to `~/.local/bin` (or `%LOCALAPPDATA%\Antigravity\` on Windows). Run `agy` once to sign in. If it isn't on the server's PATH, set `AGY_CLI_PATH` to its full path. Full migration guide: [goo.gle/gemini-cli-migration](https://goo.gle/gemini-cli-migration).

## How `agy` differs, and what the tool does about it

`agy` is not a drop-in rename of `gemini`. It is agent-first and shares a runtime with the Antigravity desktop app, so a few things behave differently for a non-interactive caller like an MCP server. The tool smooths these over and tells you plainly when it can't.

### Model selection

Print mode is **Gemini 3.5 Flash only**. `agy` ignores `--model` there, so the tool drops the `model` argument (passing it can hang `agy`) and skips the old Pro-to-Flash quota fallback. You get a one-time notice rather than a silent downgrade.

### `@file` references

The Gemini CLI inlined `@path` files into the prompt itself. `agy` is agent-first and may not, so the tool reads referenced files itself, inside the project root, and embeds their contents. That keeps `@file` deterministic and keeps the CVE-2026-0755 project-root guard in the data path on every backend.

### Output recovery

`agy -p` in 1.0.x sometimes exits cleanly but prints nothing to stdout. The tool recovers the answer through a ladder, best option first:

1. **Clean JSON stdout**, when the installed `agy` advertises `--output-format json`.
2. **Plain stdout**, used whenever it is non-empty. The day `agy` prints reliably, the rest of the ladder simply stops running.
3. **Pseudo-terminal** (opt-in, `AGY_MCP_PTY=1`, POSIX): runs `agy` under a PTY so a TTY-only build still streams real output, without reading any private files.
4. **On-disk transcript**, as a last resort: reads `agy`'s own JSONL or SQLite transcript. Recovered replies are bounded to the current run, so a fast failure never returns a stale answer from an earlier conversation.

The tool probes `agy --help` once per process, so it climbs this ladder on its own as `agy` improves, with no update needed.

### Sandbox and approvals

In print mode `agy` runs filesystem and network operations with your privileges; `--sandbox` does not isolate them and there is no graded approval gate. The tool does not pretend otherwise: request `sandbox` on `agy` and you get a clear notice that print mode is not isolated.

### Sessions

`agy` resumes a thread by `--conversation <id>` or `--continue` (which is global, not per-workspace). The tool serializes `agy` calls and prefers an explicit id, but `agy`-backed sessions are best-effort and not safe to run concurrently across different workspaces.

### Errors

When `agy` itself fails (an exhausted quota, a dropped login), its own message is surfaced verbatim instead of an empty reply, so you and your agent can act on the real reason instead of guessing.

## Configuration

| Variable | Purpose |
| --- | --- |
| `GEMINI_MCP_BACKEND` | `gemini` or `agy`/`antigravity`. Unset uses the date-aware default: `gemini` before 2026-06-18, `agy` after. |
| `AGY_CLI_PATH` | Full path to the `agy` binary when it isn't on the server's PATH. |
| `GEMINI_MCP_TIMEOUT` | Overall CLI run timeout in minutes (default 45). `agy`'s `--print-timeout` derives from it. |
| `AGY_PRINT_TIMEOUT` | Override `agy`'s `--print-timeout` directly (a Go duration, e.g. `30m`). |
| `AGY_MCP_PTY` | `1` to enable the opt-in PTY output recovery described above (POSIX only). |

## Current limitations

`agy` support is **experimental** and tracks `agy` 1.0.x:

- Print mode is Flash only; model selection returns once `agy` honors `--model` in `-p`.
- Tool execution is not sandboxed in print mode.
- Sessions are best-effort and not concurrency-safe across workspaces.

As `agy` stabilizes its headless output and lets callers supply a conversation id ([antigravity-cli#7](https://github.com/google-antigravity/antigravity-cli/issues/7)), the tool will lean on stdout directly and retire the transcript fallback automatically.

## Sources

- [Google Developers Blog: Transitioning Gemini CLI to Antigravity CLI](https://goo.gle/gemini-cli-migration)
- [Antigravity CLI](https://antigravity.google/product/antigravity-cli)
- [Discussion #90](https://github.com/jamubc/gemini-mcp-tool/discussions/90)
