# 🚀 Gemini MCP Tool - Windows Fixed Version

[![npm version](https://badge.fury.io/js/gemini-mcp-tool-windows-fixed.svg)](https://badge.fury.io/js/gemini-mcp-tool-windows-fixed)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Latest Version v1.0.21** - Fixed cross-terminal compatibility issues and fetch-chunk format errors

A **Windows-compatible** Model Context Protocol (MCP) server that enables AI assistants to interact with Google's Gemini CLI. This is a fixed version specifically designed to work seamlessly on Windows environments with PowerShell support.

> **Note**: This is an enhanced version of the [original gemini-mcp-tool](https://github.com/jamubc/gemini-mcp-tool) with Windows-specific fixes and improvements.

## 🆕 Latest Updates (v1.0.21)

- 🔧 **Fixed Cross-Terminal Compatibility** - Resolved Node.js path not found issues in different terminal environments
- 📦 **Fixed fetch-chunk Format Error** - Fixed MCP protocol format mismatch in chunked responses
- 🛡️ **Enhanced PATH Environment Variable Handling** - Automatically adds common Node.js installation paths
- ✅ **Full Compatibility with All Terminals** - Supports PowerShell, CMD, VS Code Terminal, Trae AI, CherryStudio, etc.
- 🚀 **Improved Error Handling** - Better error messages and debug output

### v1.0.3 Updates

- 🆕 **PowerShell Path Parameter Support** - Added optional `powershellPath` parameter allowing users to customize PowerShell executable path
- ✅ **Fixed PowerShell Execution Error** - Resolved `spawn powershell.exe ENOENT` issue
- ✅ **Improved Windows Compatibility** - Automatic detection of available PowerShell versions
- ✅ **Fixed Undefined Variable Error** - Fixed `args` variable issue in `executeCommandWithPipedInput` function
- ✅ **Enhanced Error Handling** - Better error messages and debug output
- ✅ **Backward Compatibility** - Existing configurations require no modification, automatically uses default detection logic

## ✨ Features

- **🪟 Windows Compatible**: Full PowerShell support with Windows-specific path handling
- **📊 Large Context Window**: Leverage Gemini's massive token window for analyzing entire codebases
- **📁 File Analysis**: Analyze files using `@filename` syntax
- **🔒 Sandbox Mode**: Safe code execution environment
- **🔗 MCP Integration**: Seamless integration with MCP-compatible AI assistants (Trae AI, Claude Desktop)
- **⚡ NPX Ready**: Easy installation and usage with NPX
- **🔧 Environment Variable Support**: Flexible API key configuration

This Windows-fixed version resolves:
- PowerShell parameter passing issues
- Character encoding problems with Chinese/Unicode text
- Command line argument escaping on Windows
- Environment variable handling
  
## 📋 Prerequisites

Before using this tool, ensure you have:

1. **[Node.js](https://nodejs.org/)** (v16.0.0 or higher)
   ```powershell
   node --version  # Should be v16+
   ```
2. **[Google Gemini CLI](https://github.com/google-gemini/gemini-cli)** installed and **configured**
   ```powershell
   npm install -g @google/generative-ai-cli
   
   # Verify installation
   gemini --version
   ```
3. **API Key**: Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

## 📦 Installation

### Quick Start with NPX (Recommended)

```powershell
# Use latest version (recommended)
npx gemini-mcp-tool-windows-fixed@1.0.21

# Or use latest version tag
npx -y gemini-mcp-tool-windows-fixed@latest
```

### Global Installation

```powershell
# Install latest version
npm install -g gemini-mcp-tool-windows-fixed@1.0.21

# Run the tool
gemini-mcp-tool-windows-fixed
```

### Updating Existing Installation

If you previously installed an older version:

```powershell
# Uninstall old version and install latest
npm uninstall -g gemini-mcp-tool-windows-fixed
npm cache clean --force
npm install -g gemini-mcp-tool-windows-fixed@1.0.21
```

## ⚙️ MCP Client Configuration

### Claude Code (One-Line Setup)

```bash
# One-command setup for Claude Code
claude mcp add gemini-cli -- npx -y gemini-mcp-tool-windows-fixed@1.0.21
```

**Verify Installation:**
Type `/mcp` inside Claude Code to verify the `gemini-cli` MCP is active. <mcreference link="https://github.com/jamubc/gemini-mcp-tool" index="1">1</mcreference>

### Alternative: Import from Claude Desktop
If you already have it configured in Claude Desktop:

1. Add to your Claude Desktop config (see below)
2. Import to Claude Code:
   ```bash
   claude mcp add-from-claude-desktop
   ```

### Trae AI (Recommended)

1. Open: `%APPDATA%\Trae\User\mcp.json`
2. Add this configuration:

```json
{
  "mcpServers": {
    "gemini-cli": {
      "name": "gemini-cli",
      "description": "Windows-compatible Gemini MCP Tool",
      "baseUrl": "",
      "command": "npx",
      "args": [
        "-y",
        "gemini-mcp-tool-windows-fixed@1.0.21"
      ],
      "env": {
        "GEMINI_API_KEY": "YOUR_ACTUAL_API_KEY_HERE"
      },
      "isActive": true,
      "providerUrl": "https://github.com/orzcls/gemini-mcp-tool-windows-fixed"
    }
  }
}
```

### Claude Desktop

1. Open: `%APPDATA%\Claude\claude_desktop_config.json`
2. Add this configuration:

```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "npx",
      "args": ["-y", "gemini-mcp-tool-windows-fixed@1.0.21"],
      "env": {
        "GEMINI_API_KEY": "YOUR_ACTUAL_API_KEY_HERE"
      }
    }
  }
}
```

## 🔑 API Key Configuration

### Option 1: MCP Configuration (Recommended)

Replace `YOUR_ACTUAL_API_KEY_HERE` in the configuration above with your actual API key.

### Option 2: Environment Variable

```powershell
# Temporary (current session)
$env:GEMINI_API_KEY = "your-actual-api-key"

# Permanent (user level)
[Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "your-actual-api-key", "User")

# Verify
echo $env:GEMINI_API_KEY
```

### Configuration File Locations

**Claude Desktop:**
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`

**Trae AI:**
- **Windows**: `%APPDATA%\Trae\User\mcp.json`

## 🛠️ Available Tools

This MCP server provides the following tools for AI assistants:

### 1. `ask-gemini`
Interact with Google Gemini for analysis and questions.

**Parameters:**
- `prompt` (required): The analysis request. Use `@` syntax for file references
- `model` (optional): Gemini model to use (default: `gemini-2.5-pro`)
- `sandbox` (optional): Enable sandbox mode for safe code execution
- `changeMode` (optional): Enable structured change mode
- `chunkIndex` (optional): Chunk index for continuation
- `chunkCacheKey` (optional): Cache key for continuation

### 2. `brainstorm`
Generate creative ideas using various brainstorming frameworks.

**Parameters:**
- `prompt` (required): Brainstorming challenge or question
- `model` (optional): Gemini model to use
- `methodology` (optional): Framework (`divergent`, `convergent`, `scamper`, `design-thinking`, `lateral`, `auto`)
- `domain` (optional): Domain context (`software`, `business`, `creative`, etc.)
- `constraints` (optional): Known limitations or requirements
- `existingContext` (optional): Background information
- `ideaCount` (optional): Number of ideas to generate (default: 12)
- `includeAnalysis` (optional): Include feasibility analysis (default: true)

### 3. `fetch-chunk`
Retrieve cached chunks from changeMode responses.

**Parameters:**
- `cacheKey` (required): Cache key from initial response
- `chunkIndex` (required): Chunk index to retrieve (1-based)

### 4. `timeout-test`
Test timeout prevention mechanisms.

**Parameters:**
- `duration` (required): Duration in milliseconds (minimum: 10ms)

### 5. `ping`
Test connection to the server.

**Parameters:**
- `prompt` (optional): Message to echo back

### 6. `Help`
Display help information about available tools.

## 🎯 Usage Examples

Once configured, you can use the following tools through your MCP client:

### Natural Language Examples <mcreference link="https://github.com/jamubc/gemini-mcp-tool" index="2">2</mcreference>

**With File References (using @ syntax):**
- "ask gemini to analyze @src/main.js and explain what it does"
- "use gemini to summarize @. the current directory"
- "analyze @package.json and tell me about dependencies"

**General Questions (without files):**
- "ask gemini to search for the latest tech news"
- "use gemini to explain div centering"
- "ask gemini about best practices for React development related to @file_im_confused_about"
- "use gemini to explain index.html"
- "understand the massive project using gemini"
- "ask gemini to search for latest news"

**Using Gemini CLI's Sandbox Mode (-s):** <mcreference link="https://github.com/jamubc/gemini-mcp-tool" index="2">2</mcreference>
The sandbox mode allows you to safely test code changes, run scripts, or execute potentially risky operations in an isolated environment.
- "use gemini sandbox to create and run a Python script that processes data"
- "ask gemini to safely test @script.py and explain what it does"
- "use gemini sandbox to install numpy and create a data visualization"
- "test this code safely: Create a script that makes HTTP requests to an API"

### Slash Commands (for Claude Code Users) <mcreference link="https://github.com/jamubc/gemini-mcp-tool" index="2">2</mcreference>

You can use these commands directly in Claude Code's interface (compatibility with other clients has not been tested):

- **/analyze**: Analyzes files or directories using Gemini, or asks general questions
  - `prompt` (required): The analysis prompt. Use @ syntax to include files (e.g., `/analyze prompt:@src/ summarize this directory`) or ask general questions (e.g., `/analyze prompt:Please use a web search to find the latest news stories`)

- **/sandbox**: Safely tests code or scripts in Gemini's sandbox environment
  - `prompt` (required): Code testing request (e.g., `/sandbox prompt:Create and run a Python script that processes CSV data` or `/sandbox prompt:@script.py Test this script safely`)

- **/help**: Displays the Gemini CLI help information
- **/ping**: Tests the connection to the server
  - `message` (optional): A message to echo back

### Available Tools

- **ask-gemini**: Send prompts to Gemini
  ```
  "Explain how MCP works"
  ```

- **analyze-file**: Analyze specific files using `@filename` syntax
  ```
  "Analyze @package.json and suggest improvements"
  ```

- **sandbox-mode**: Execute code in a safe environment
  ```
  "Run this Python code in sandbox mode: print('Hello World')"
  ```

## 🔧 Windows-Specific Fixes

This version includes the following Windows-specific improvements:

1. **PowerShell Parameter Handling**: Fixed argument passing to avoid parameter splitting
2. **Character Encoding**: Proper UTF-8 handling for Chinese and Unicode characters
3. **Quote Escaping**: Correct escaping of quotes in command arguments
4. **Environment Variables**: Improved `.env` file loading and environment variable handling
5. **Path Resolution**: Windows-compatible path handling

## 🧪 Testing Installation

### 1. Test Gemini CLI
```powershell
gemini -p "Hello, how are you?"
```

### 2. Test MCP Tool
```powershell
npx -y gemini-mcp-tool-windows-fixed
# Should show: [GMCPT] Gemini CLI MCP Server (Fixed) started
```

### 3. Test MCP Integration
1. Restart your MCP client (Trae AI, Claude Desktop)
2. Try asking: "Use gemini to explain what MCP is"
3. Check for successful responses

## 🐛 Troubleshooting

### Common Issues

#### "Command not found: gemini"
```powershell
npm install -g @google/generative-ai-cli
```

#### "API key not found"
```powershell
# Check if API key is set
echo $env:GEMINI_API_KEY

# Set if empty
$env:GEMINI_API_KEY = "your-api-key"
```

#### "Permission denied"
```powershell
# Check execution policy
Get-ExecutionPolicy
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

For detailed troubleshooting, see [INSTALL-GUIDE.md](./INSTALL-GUIDE.md).

## 🔧 Windows-Specific Fixes

This version includes several Windows-specific improvements:

- **PowerShell Integration**: Native PowerShell command execution
- **Path Handling**: Proper Windows path resolution
- **Environment Variables**: Enhanced environment variable support
- **Error Handling**: Better error messages for Windows environments
- **Dependency Management**: Simplified dependency structure

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Test on Windows environments
4. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Original project: [jamubc/gemini-mcp-tool](https://github.com/jamubc/gemini-mcp-tool)
- Google Gemini CLI team
- Model Context Protocol (MCP) community

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/your-username/gemini-mcp-tool-windows-fixed/issues) page
2. Create a new issue with detailed information about your problem
3. Include your Windows version, Node.js version, and error messages

---

**Made with ❤️ for Windows developers**

**Note**: This is a Windows-optimized fork of the original gemini-mcp-tool. For other platforms, consider using the [original version](https://github.com/jamubc/gemini-mcp-tool).




