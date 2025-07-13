# Installation

Multiple ways to install Gemini MCP Tool v1.1.2, depending on your needs.

<div style="background: var(--vp-c-bg-soft); padding: 12px; border-radius: 6px; border: 1px solid var(--vp-c-divider); margin-bottom: 20px;">
  <strong>Current Version:</strong> 1.1.2 with enhanced reliability and automatic fallback support
</div>

## Prerequisites

- Node.js v16.0.0 or higher
- Claude Desktop or Claude Code with MCP support
- Gemini CLI installed (`pip install google-generativeai-cli`)

## Method 1: NPX (Recommended)

No installation needed - runs directly:

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

## Method 2: Global Installation

```bash
npm install -g gemini-mcp-tool
```

Then configure:
```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "gemini-mcp"
    }
  }
}
```

## Method 3: Local Project

```bash
npm install gemini-mcp-tool
```

See [Getting Started](/getting-started) for full setup instructions.