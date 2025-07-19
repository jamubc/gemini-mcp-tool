## New Feature: Read with Gemini, Edit with Claude + Diffs

<div align="center">
  <img width="400" alt="screenshot 2025-07-13 at 07 09 45"
       src="https://github.com/user-attachments/assets/5fccba53-71ce-4546-8aed-b1095c5a1ca8" />
</div>

---
> 🚀 **Share your experience!** [Tell us how it went](https://github.com/jamubc/gemini-mcp-tool/discussions/2) and help the community grow!

> 📚 [Thorough documentation](https://github.com/jamubc/gemini-mcp-tool/wiki) is available with searching.
> 

# Gemini MCP Tool

<div align="center">

[![GitHub Release](https://img.shields.io/github/v/release/jamubc/gemini-mcp-tool?logo=github&label=GitHub)](https://github.com/jamubc/gemini-mcp-tool/releases)
[![npm version](https://img.shields.io/npm/v/gemini-mcp-tool)](https://www.npmjs.com/package/gemini-mcp-tool)
[![npm downloads](https://img.shields.io/npm/dt/gemini-mcp-tool)](https://www.npmjs.com/package/gemini-mcp-tool)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Open Source](https://img.shields.io/badge/Open%20Source-❤️-red.svg)](https://github.com/jamubc/gemini-mcp-tool)

</div>

<a href="https://glama.ai/mcp/servers/@jamubc/gemini-mcp-tool">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@jamubc/gemini-mcp-tool/badge" alt="Gemini Tool MCP server" />
</a>

> 📚 **[View Full Documentation](https://jamubc.github.io/gemini-mcp-tool/)** - Search me!, Examples, FAQ, Troubleshooting, Best Practices

This is a simple Model Context Protocol (MCP) server that allows AI assistants to interact with the [Gemini CLI](https://github.com/google-gemini/gemini-cli). It enables the AI to leverage the power of Gemini's massive token window for large analysis, especially with large files and codebases using the `@` syntax for direction.


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

## Available Commands

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

- **`ask-gemini`**: Asks Google Gemini for its perspective. Can be used for general questions or complex analysis of files.
  - **`prompt`** (required): The analysis request. Use the `@` syntax to include file or directory references (e.g., `@src/main.js explain this code`) or ask general questions (e.g., `Please use a web search to find the latest news stories`).
  - **`model`** (optional): The Gemini model to use. Defaults to `gemini-2.5-pro`.
  - **`sandbox`** (optional): Set to `true` to run in sandbox mode for safe code execution.
- **`sandbox-test`**: Safely executes code or commands in Gemini's sandbox environment. Always runs in sandbox mode.
  - **`prompt`** (required): Code testing request (e.g., `Create and run a Python script that...` or `@script.py Run this safely`).
  - **`model`** (optional): The Gemini model to use.
- **`Ping`**: A simple test tool that echoes back a message.
- **`Help`**: Shows the Gemini CLI help text.

### Slash Commands (for the User)

You can use these commands directly in Claude Code's interface (compatibility with other clients has not been tested).

- **/analyze**: Analyzes files or directories using Gemini, or asks general questions.
  - **`prompt`** (required): The analysis prompt. Use `@` syntax to include files (e.g., `/analyze prompt:@src/ summarize this directory`) or ask general questions (e.g., `/analyze prompt:Please use a web search to find the latest news stories`).
- **/sandbox**: Safely tests code or scripts in Gemini's sandbox environment.
  - **`prompt`** (required): Code testing request (e.g., `/sandbox prompt:Create and run a Python script that processes CSV data` or `/sandbox prompt:@script.py Test this script safely`).
- **/help**: Displays the Gemini CLI help information.
- **/ping**: Tests the connection to the server.
  - **`message`** (optional): A message to echo back.

## Contributing

Contributions are welcome! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on how to submit pull requests, report issues, and contribute to the project.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

**Disclaimer:** This is an unofficial, third-party tool and is not affiliated with, endorsed, or sponsored by Google.
