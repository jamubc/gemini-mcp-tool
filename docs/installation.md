# Installation

Multiple ways to install Gemini MCP Tool, depending on your needs.

## Prerequisites

- Node.js v16.0.0 or higher
- Claude Desktop or Claude Code with MCP support
- Gemini CLI installed (`npm install -g @google/gemini-cli`)

## Method 1: NPX (Recommended)

No installation needed - runs directly:

```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "npx",
      "args": ["-y", "gemini-mcp-tool", "--", "--target-model", "gemini"]
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
      "command": "gemini-mcp",
      "args": ["--target-model", "gemini"]
    }
  }
}
```

## Server Configuration

You can configure the server's behavior using command-line arguments or environment variables.

### Command-Line Arguments

Arguments are passed after the main command. When using `npx`, you must add `--` before the arguments.

- `--target-model <name>`: Sets the compatibility mode for the tool schemas. This is crucial for ensuring tools work correctly with specific models.
  - **Example**:
    ```bash
    npx gemini-mcp-tool --target-model gemini
    ```
  - **Default**: `default`

**Example `args` in `mcp-config.json`:**
```json
{
  "args": ["-y", "gemini-mcp-tool", "--", "--target-model", "gemini"]
}
```

### Environment Variables

You can also use environment variables to configure the server.

- `MCP_TARGET_MODEL=<name>`: Same function as the `--target-model` flag.
  - **Example**:
    ```bash
    export MCP_TARGET_MODEL=gemini
    npx gemini-mcp-tool
    ```

::: tip
Command-line arguments take precedence over environment variables.
:::

## Method 3: Local Project

```bash
npm install gemini-mcp-tool
```

See [Getting Started](/getting-started) for full setup instructions.