# API

## Tools

### `ask-gemini`

Runs the installed Gemini CLI through `gemini -p <prompt>` and returns stdout to the MCP client. Authentication is provided by the Gemini CLI OAuth state on the host machine; this fork does not require `GEMINI_API_KEY`.

Parameters:

- `prompt` (required): question or analysis request. Gemini CLI `@file` syntax is supported.
- `model` (optional): Gemini model passed to the CLI with `-m`.
- `sandbox` (optional): when true, passes `-s` to the Gemini CLI.
- `changeMode` (optional): requests structured edit output and post-processes Gemini's response.

### `ping`

Echoes a message and is useful for checking that the MCP server is reachable.

### `Help`

Runs `gemini -help` and returns the Gemini CLI help text.

## Stability validation

Run the local verification script before registering the MCP server:

```bash
npm run verify
```

Then validate from Claude Code with `/mcp`, `mcp__gemini-cli__ping`, and repeated `mcp__gemini-cli__ask-gemini` calls.