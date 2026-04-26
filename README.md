
# Gemini MCP Tool

<div align="center">

[![GitHub](https://img.shields.io/badge/GitHub-jacobcxdev%2Fgemini--mcp--tool-blue?logo=github)](https://github.com/jacobcxdev/gemini-mcp-tool)
[![Fork](https://img.shields.io/badge/Forked%20from-jamubc%2Fgemini--mcp--tool-lightgrey?logo=github)](https://github.com/jamubc/gemini-mcp-tool)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

</div>

This fork focuses on Claude Code stability while preserving the original Gemini CLI OAuth behaviour from `jamubc/gemini-mcp-tool`.

This is a simple Model Context Protocol (MCP) server that allows AI assistants to interact with the [Gemini CLI](https://github.com/google-gemini/gemini-cli). It enables the AI to leverage the power of Gemini's massive token window for large analysis, especially with large files and codebases using the `@` syntax for direction.

Authentication is handled by the installed `gemini` CLI. This server does not require `GEMINI_API_KEY` and does not call the Google GenAI SDK directly.

- Ask gemini natural questions, through claude or Brainstorm new ideas in a party of 3!

## TLDR: [![Claude](https://img.shields.io/badge/Claude-D97757?logo=claude&logoColor=fff)](#) + [![Google Gemini](https://img.shields.io/badge/Google%20Gemini-886FBF?logo=googlegemini&logoColor=fff)](#)


**Goal**: Use Gemini's powerful analysis capabilities directly in Claude Code to save tokens and analyze large files.

## Prerequisites

Before using this tool, ensure you have:

1. **[Node.js](https://nodejs.org/)** (v16.0.0 or higher)
2. **[Google Gemini CLI](https://github.com/google-gemini/gemini-cli)** installed and configured


### Local Setup

Build the fork locally:

```bash
cd /Users/jacob/Developer/src/github/jacobcxdev/gemini-mcp-tool
npm install
npm run build
```

Register the local build with Claude Code:

```bash
claude mcp remove gemini-cli -s user
claude mcp add gemini-cli -s user -- node /Users/jacob/Developer/src/github/jacobcxdev/gemini-mcp-tool/dist/index.js
```

### Verify Installation

Before configuring MCP, verify the Gemini CLI OAuth path works:

```bash
gemini -p ping
```

Type `/mcp` inside Claude Code to verify the gemini-cli MCP is active.

---

## Configuration

Register the MCP server with your MCP client:

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

The fork is intentionally documented as a local build until it is published under the `@jacobcxdev` npm scope.

**Configuration File Locations:**

- **Claude Desktop**:
  - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
  - **Linux**: `~/.config/claude/claude_desktop_config.json`

After updating the configuration, restart your terminal session.

## Stability smoke test

Run this before registering the MCP server:

```bash
npm run verify
```

Then test through Claude Code:

1. Run `/mcp` and confirm `gemini-cli` is connected.
2. Call `mcp__gemini-cli__ping`.
3. Call `mcp__gemini-cli__ask-gemini` several times with short prompts.
4. Run `/mcp` again and confirm the server stayed connected.

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
