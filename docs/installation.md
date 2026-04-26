# Installation

Multiple ways to install Gemini MCP Tool, depending on your needs.

## Prerequisites

- Node.js v16.0.0 or higher
- Claude Desktop or Claude Code with MCP support
- Gemini CLI installed (`npm install -g @google/gemini-cli`)

## Local fork installation

Build the fork locally:

```bash
cd /Users/jacob/Developer/src/github/jacobcxdev/gemini-mcp-tool
npm install
npm run build
```

Register it with Claude Code:

```bash
claude mcp remove gemini-cli -s user
claude mcp add gemini-cli -s user -- node /Users/jacob/Developer/src/github/jacobcxdev/gemini-mcp-tool/dist/index.js
```

For JSON-based MCP clients:

```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "node",
      "args": [
        "/Users/jacob/Developer/src/github/jacobcxdev/gemini-mcp-tool/dist/index.js"
      ]
    }
  }
}
```

This fork is documented as a local build until it is published under the `@jacobcxdev` npm scope.

See [Getting Started](/getting-started) for full setup instructions.