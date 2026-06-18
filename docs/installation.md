# Installation

Multiple ways to install Gemini MCP Tool, depending on your needs.

## Prerequisites

- Node.js v16.0.0 or higher
- Claude Desktop or Claude Code with MCP support
- A backend CLI. The **Antigravity CLI** (`agy`) is the default since 2026-06-18 (`curl -fsSL https://antigravity.google/cli/install.sh | bash`); Enterprise and paid-API-key users can stay on the **Gemini CLI** with `GEMINI_MCP_BACKEND=gemini`. See the [migration guide](/migration/antigravity-cli)

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
claude mcp add gemini-cli -- npx -y gemini-mcp-tool
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