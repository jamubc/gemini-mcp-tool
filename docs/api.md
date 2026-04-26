# API

## Tools

### `ask-gemini`

Runs the installed Gemini CLI through `gemini -p <prompt>` and returns stdout to the MCP client. Authentication is provided by the Gemini CLI OAuth state on the host machine; this server does not require `GEMINI_API_KEY`.

Parameters:

- `prompt` (required): question or analysis request. Gemini CLI `@file` syntax is supported.
- `model` (optional): Gemini model passed to the CLI with `-m`.
- `sandbox` (optional): when true, passes `-s` to the Gemini CLI.
- `changeMode` (optional): requests structured edit output and post-processes Gemini's response.

### `ping`

Echoes a message and is useful for checking that the MCP server is reachable.

### `Help`

Runs `gemini -help` and returns the Gemini CLI help text.

## Runtime diagnostics

Tracing is disabled by default. Set `GEMINI_MCP_TRACE=1` to write lifecycle diagnostics to a temporary trace file, or set `GEMINI_MCP_TRACE_FILE` to choose the destination. Trace output omits raw tool arguments by default.

Progress notifications are disabled by default because some MCP clients mishandle long-running progress messages. Set `GEMINI_MCP_ENABLE_PROGRESS=1` to re-enable progress notifications for clients that support them correctly.

## Stability validation

Run the local verification script before registering the MCP server:

```bash
npm run verify
```

Then validate from Claude Code with `/mcp`, `mcp__gemini-cli__ping`, and repeated `mcp__gemini-cli__ask-gemini` calls.