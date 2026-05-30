# Configuration <Badge text="1.2.0" type="tip" />

All configuration is done via environment variables in your MCP client config. No config files to manage.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_MCP_APPROVAL_MODE` | *(unset)* | Default approval mode for all calls |
| `GEMINI_MCP_BACKEND` | `gemini` | CLI backend: `gemini` or `agy` |
| `GEMINI_MCP_TIMEOUT_MS` | `1800000` (30 min) | Per-call timeout; `0` disables |
| `GEMINI_CLI_PATH` | *(auto-detect)* | Explicit path to the gemini executable |

### Setting Environment Variables

#### Claude Code
```bash
claude mcp add gemini-cli -e GEMINI_MCP_APPROVAL_MODE=plan -- npx -y gemini-mcp-tool
```

#### Claude Desktop / Other Clients
```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "npx",
      "args": ["-y", "gemini-mcp-tool"],
      "env": {
        "GEMINI_MCP_APPROVAL_MODE": "plan",
        "GEMINI_MCP_TIMEOUT_MS": "1800000"
      }
    }
  }
}
```

---

## Approval Mode

Controls how much autonomy Gemini has when processing a request. Maps directly to `gemini --approval-mode`.

| Mode | Behaviour | Use Case |
|------|-----------|----------|
| *(unset)* | No flag passed — Gemini behaves as normal Q&A | Default; best for analysis and questions |
| `default` | Gemini's own default mode | Same as unset |
| `plan` | Read-only autonomous planner | "Gemini reads, Claude edits" |
| `auto_edit` | Auto-approve file edits, prompt for other tools | Combine with `sandbox` for safe edits |
| `yolo` | Auto-approve everything | CI scripts, fully trusted operations |

::: warning
In headless mode (`-p`), `plan` turns Gemini into an autonomous planner that may ignore simple questions. Leave unset for plain Q&A.
:::

### Per-call Override

The `approvalMode` tool argument overrides the environment variable:

```
Ask gemini to review this codebase with approvalMode: "plan"
```

---

## Backends

The MCP server can use different CLI backends to talk to Google's models.

### Gemini CLI (default)

The standard `gemini` command. Supports model selection, approval modes, sandbox, and native sessions.

```json
{
  "env": {
    "GEMINI_MCP_BACKEND": "gemini"
  }
}
```

### Antigravity CLI (experimental) <Badge text="experimental" type="warning" />

Google's Antigravity CLI (`agy`) is the successor to `gemini` (Gemini CLI is retired June 18, 2026 for free/Pro/Ultra tiers). Set `GEMINI_MCP_BACKEND=agy` to opt in.

```json
{
  "env": {
    "GEMINI_MCP_BACKEND": "agy"
  }
}
```

**Caveats:**
- Print mode (`agy -p`) is hardcoded to **Gemini 3.5 Flash** — model selection is ignored
- The `agy -p` stdout bug (exit 0, empty output) is worked around by reading agy's transcript files on disk
- Only `yolo` maps to agy's `--dangerously-skip-permissions`; graded approval modes are not supported
- Calls are serialised to avoid transcript id collision

::: tip
You don't need to do anything today. Gemini CLI still works for headless/automation use. This backend is here so you're ready when the transition happens.
:::

---

## Timeout

A per-call timeout protects against hung CLI processes. If the timeout fires, the child is sent `SIGTERM`, then `SIGKILL` after 2 seconds.

| Value | Behaviour |
|-------|-----------|
| `1800000` (default) | 30-minute timeout |
| Any positive number | Timeout in milliseconds |
| `0` | Disabled — wait forever |

```json
{
  "env": {
    "GEMINI_MCP_TIMEOUT_MS": "600000"
  }
}
```

::: tip
Large codebase analyses can legitimately run for many minutes. The 30-minute default is deliberately generous — it exists to release genuinely hung processes, not to cap normal work.
:::

---

## Native Sessions <Badge text="1.2.0" type="tip" />

Multi-turn conversations use the Gemini CLI's own session system — no local transcript storage.

### Starting a session
Pass `sessionId` to tag a conversation:
```
ask-gemini with sessionId: "my-review" — review the auth module
```

### Resuming a session
Pass `resume` with the session id (or `"latest"`) to continue:
```
ask-gemini with resume: "my-review" — now suggest improvements
```

The response includes a `[session: <id>]` footer so you can track which session is active.

::: info
Sessions are backed by `gemini --session-id` / `--resume` on the Gemini backend, and `agy --conversation` / `--continue` on the agy backend.
:::

---

## Windows Executable Resolution

On Windows, the MCP server often runs without your interactive PATH. The tool resolves the `gemini` command by:

1. Checking `GEMINI_CLI_PATH` (if set)
2. Running `where gemini` and preferring the `.cmd` shim
3. Falling back to `gemini.cmd`

If you get "command not found" errors on Windows, set `GEMINI_CLI_PATH` to the full path:

```json
{
  "env": {
    "GEMINI_CLI_PATH": "C:\\Users\\you\\AppData\\Roaming\\npm\\gemini.cmd"
  }
}
```
