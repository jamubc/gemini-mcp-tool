# API Reference

## Tools

The MCP server exposes the following tools over stdio transport.

### ask-gemini

The primary tool for sending prompts to Gemini.

**Arguments:**

```typescript
{
  prompt: string;           // Required. Use @ to include files.
  model?: string;           // e.g. "gemini-2.5-flash"
  sandbox?: boolean;        // default false
  changeMode?: boolean;     // default false — structured edits
  approvalMode?: "default" | "auto_edit" | "yolo" | "plan";
  sessionId?: string;       // tag a session
  resume?: string;          // resume by id or "latest"
  chunkIndex?: number;      // 1-based chunk (changeMode)
  chunkCacheKey?: string;   // hex cache key (changeMode)
}
```

### brainstorm

Structured ideation with methodology frameworks.

**Arguments:**

```typescript
{
  prompt: string;           // Required. The challenge to brainstorm.
  model?: string;
  approvalMode?: "default" | "auto_edit" | "yolo" | "plan";
  methodology?: "divergent" | "convergent" | "scamper"
              | "design-thinking" | "lateral" | "auto";
  domain?: string;          // e.g. "software", "business"
  constraints?: string;
  existingContext?: string;
  ideaCount?: number;       // default 12
  includeAnalysis?: boolean; // default true
}
```

### ping

Echo test. Returns the input message.

```typescript
{ prompt?: string; }  // defaults to "Pong!"
```

### Help

Returns `gemini --help` output.

```typescript
{}  // no arguments
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_MODEL` | *(CLI default)* | Default model when a call omits `model` |
| `GEMINI_FLASH_MODEL` | `gemini-2.5-flash` | Model used for the quota fallback |
| `GEMINI_MCP_BACKEND` | `gemini` | Backend: `gemini` or `agy` (experimental) |
| `GEMINI_MCP_APPROVAL_MODE` | *(unset)* | Default approval mode for all calls |
| `GEMINI_MCP_TIMEOUT_MS` | `1800000` | Per-call timeout in ms; `0` disables |
| `GEMINI_CLI_PATH` | *(auto)* | Full path to the gemini executable (Windows) |

## Transport

The server uses **stdio** transport (MCP standard). It reads JSON-RPC from stdin and writes responses to stdout. No HTTP server, no ports.

```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "npx",
      "args": ["-y", "gemini-mcp-tool"]
    }
  }
}
```

## Backends

The `BackendProvider` interface is:

```typescript
interface Backend {
  readonly name: string;
  readonly supportsModelSelection: boolean;
  run(prompt: string, options: BackendRunOptions): Promise<string>;
}
```

Two implementations ship:
- **`geminiBackend`** — default, full feature support
- **`agyBackend`** — experimental, Flash-only, transcript-file recovery