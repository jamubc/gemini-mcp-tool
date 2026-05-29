
# Gemini MCP Tool

<div align="center">

[![GitHub Release](https://img.shields.io/github/v/release/jamubc/gemini-mcp-tool?logo=github&label=GitHub)](https://github.com/jamubc/gemini-mcp-tool/releases)
[![npm version](https://img.shields.io/npm/v/gemini-mcp-tool)](https://www.npmjs.com/package/gemini-mcp-tool)
[![npm downloads](https://img.shields.io/npm/dt/gemini-mcp-tool)](https://www.npmjs.com/package/gemini-mcp-tool)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Open Source](https://img.shields.io/badge/Open%20Source-❤️-red.svg)](https://github.com/jamubc/gemini-mcp-tool)

</div>

> 📚 **[View Full Documentation](https://jamubc.github.io/gemini-mcp-tool/)** - Search me!, Examples, FAQ, Troubleshooting, Best Practices

This is a simple Model Context Protocol (MCP) server that allows AI assistants to interact with the [Gemini CLI](https://github.com/google-gemini/gemini-cli). It enables the AI to leverage the power of Gemini's massive token window for large analysis, especially with large files and codebases using the `@` syntax for direction.

- Ask gemini natural questions, through claude or Brainstorm new ideas in a party of 3!

<a href="https://glama.ai/mcp/servers/@jamubc/gemini-mcp-tool">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@jamubc/gemini-mcp-tool/badge" alt="Gemini Tool MCP server" />
</a>

## TLDR: [![Claude](https://img.shields.io/badge/Claude-D97757?logo=claude&logoColor=fff)](#) + [![Google Gemini](https://img.shields.io/badge/Google%20Gemini-886FBF?logo=googlegemini&logoColor=fff)](#)


**Goal**: Use Gemini's powerful analysis capabilities directly in Claude Code to save tokens and analyze large files.

## Prerequisites

Before using this tool, ensure you have:

1. **[Node.js](https://nodejs.org/)** (v16.0.0 or higher)
2. **[Google Gemini CLI](https://github.com/google-gemini/gemini-cli)** installed and configured


### One-Line Setup

```bash
claude mcp add gemini-cli -- npx -y gemini-mcp-tool
```

### Verify Installation

Type `/mcp` inside Claude Code to verify the gemini-cli MCP is active.

---

### Alternative: Import from Claude Desktop

If you already have it configured in Claude Desktop:

1. Add to your Claude Desktop config:
```json
"gemini-cli": {
  "command": "npx",
  "args": ["-y", "gemini-mcp-tool"]
}
```

2. Import to Claude Code:
```bash
claude mcp add-from-claude-desktop
```

## Configuration

Register the MCP server with your MCP client:

### For NPX Usage (Recommended)

Add this configuration to your Claude Desktop config file:

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

### For Global Installation

If you installed globally, use this configuration instead:

```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "gemini-mcp"
    }
  }
}
```

**Configuration File Locations:**

- **Claude Desktop**:
  - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
  - **Linux**: `~/.config/claude/claude_desktop_config.json`

After updating the configuration, restart your terminal session.

## Example Workflow

- **Natural language**: "use gemini to explain index.html", "understand the massive project using gemini", "ask gemini to search for latest news"
- **Claude Code**: Type `/gemini-cli` and commands will populate in Claude Code's interface.

## Usage Examples

### With File References (using @ syntax)

- `ask gemini to analyze @src/main.js and explain what it does`
- `use gemini to summarize @. the current directory`
- `analyze @package.json and tell me about dependencies`

### General Questions (without files)

- `ask gemini to search for the latest tech news`
- `use gemini to explain div centering`
- `ask gemini about best practices for React development related to @file_im_confused_about`

### Using Gemini CLI's Sandbox Mode (-s)

The sandbox mode allows you to safely test code changes, run scripts, or execute potentially risky operations in an isolated environment.

- `use gemini sandbox to create and run a Python script that processes data`
- `ask gemini to safely test @script.py and explain what it does`
- `use gemini sandbox to install numpy and create a data visualization`
- `test this code safely: Create a script that makes HTTP requests to an API`

### Tools (for the AI)

These tools are designed to be used by the AI assistant.

- **`ask-gemini`**: Execute Gemini CLI with full feature support including advanced flags, caching, and change mode.
  - **`prompt`** (required): The analysis request. Use the `@` syntax to include file or directory references (e.g., `@src/main.js explain this code`) or ask general questions (e.g., `Please use a web search to find the latest news stories`).
  - **`model`** (optional): The Gemini model to use. Defaults to `gemini-2.5-pro`. Use `gemini-2.5-flash` for faster responses.
  - **`sandbox`** (optional): Set to `true` to run in sandbox mode for safe code execution.
  - **`changeMode`** (optional): Enable structured change mode for edit suggestions that Claude can apply directly.
  - **`yolo`** (optional): Auto-accept all actions (YOLO mode). Use with caution.
  - **`approvalMode`** (optional): Fine-grained approval control: `default`, `auto_edit`, or `yolo`.
  - **`outputFormat`** (optional): Control output format: `text`, `json`, or `stream-json`.
  - **`includeDirectories`** (optional): Additional directories to include in workspace.
  - **`debug`** (optional): Enable verbose logging for troubleshooting.
  - **`promptInteractive`** (optional): Execute prompt and continue in interactive mode.
  - **`extensions`** (optional): Filter specific file extensions.
  - **`resume`** (optional): Resume previous session (use `latest` or session number).

- **`brainstorm`**: Generate creative ideas with structured methodologies and domain context.
  - **`prompt`** (required): Brainstorming challenge or question to explore.
  - **`model`** (optional): The Gemini model to use.
  - **`methodology`** (optional): Framework to use: `divergent`, `convergent`, `scamper`, `design-thinking`, `lateral`, or `auto` (default).
  - **`domain`** (optional): Domain context (e.g., 'software', 'business', 'creative', 'research').
  - **`constraints`** (optional): Known limitations or requirements.
  - **`ideaCount`** (optional): Number of ideas to generate (default: 12).
  - **`includeAnalysis`** (optional): Include feasibility and impact analysis (default: true).

- **`fetch-chunk`**: Retrieve cached chunks from large changeMode responses.
  - **`cacheKey`** (required): Cache key from initial changeMode response.
  - **`chunkIndex`** (required): Chunk number to retrieve (1-based index).

- **`ping`**: Echo test message to verify server connection.
  - **`prompt`** (optional): Message to echo back.

- **`Help`**: Display Gemini CLI help information.

### Slash Commands (for the User)

You can use these commands directly in Claude Code's interface (compatibility with other clients has not been tested).

- **/ask-gemini**: Execute Gemini CLI with advanced features and caching.
  - **Example**: `/ask-gemini prompt:@src/ summarize this directory`
  - **With sandbox**: `/ask-gemini prompt:@script.py test this safely sandbox:true`
  - **With change mode**: `/ask-gemini prompt:Refactor this code changeMode:true`
  - **Supports all flags**: yolo, approvalMode, outputFormat, debug, etc.

- **/brainstorm**: Generate structured ideas with creative methodologies.
  - **Example**: `/brainstorm prompt:How can we improve user onboarding? methodology:design-thinking domain:software`
  - **Quick use**: `/brainstorm prompt:Ideas for a mobile app feature`

- **/fetch-chunk**: Retrieve next chunk of a large changeMode response.
  - **Example**: `/fetch-chunk cacheKey:abc123 chunkIndex:2`

- **/Help**: Display Gemini CLI help information.
  - **Example**: `/Help`

- **/ping**: Test the MCP server connection.
  - **Example**: `/ping prompt:Hello server!`

## Performance Features

This MCP server includes several performance optimizations:

- **LRU Response Cache**: Near-instant responses for repeated queries with 30-minute TTL and 10MB max size
- **Efficient Command Execution**: O(n) array buffer performance for large outputs
- **Smart Chunking**: Large changeMode responses are automatically chunked for better handling
- **Progress Notifications**: Real-time progress updates during long-running operations

## Contributing

Contributions are welcome! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on how to submit pull requests, report issues, and contribute to the project.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

**Disclaimer:** This is an unofficial, third-party tool and is not affiliated with, endorsed, or sponsored by Google.
