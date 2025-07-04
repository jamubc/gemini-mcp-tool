# Installation Guide

## TLDR: Claude + Google Gemini

**Goal:** Use Gemini's powerful analysis capabilities directly in Claude Code to save tokens and analyze large files.

### One-Line Setup

```bash
claude mcp add gemini-cli -- npx -y gemini-mcp-tool
```

### Verify Installation

Type `/mcp` inside Claude Code to verify the gemini-cli MCP is active.

Ready to start? Check out the [First Steps](/first-steps/) guide.

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

---

## Complete Installation Guide

### Prerequisites

Before using this tool, ensure you have:

1. **[Node.js](https://nodejs.org/)** (v16.0.0 or higher)
2. **[Google Gemini CLI](https://github.com/google-gemini/gemini-cli)** installed and configured

### Gemini CLI Setup
Install and configure Google's Gemini CLI:

```bash
# Install Gemini CLI
pip install google-generativeai-cli

# Configure with your API key
gemini config set api_key YOUR_API_KEY

# Verify installation
gemini --help
```

::: tip Getting Your API Key
Get your free Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
:::

## Installation Methods

### Method 1: Claude Code (Recommended)
**Best for:** Claude Code users, simplest setup

```bash
# Automatic MCP setup
claude mcp add gemini-cli -- npx -y gemini-mcp-tool

# Verify installation
# Type /mcp in Claude Code to see active MCPs
```

### Method 2: NPX with Claude Desktop
**Best for:** Claude Desktop users, no maintenance required

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

**Advantages:**
- Always uses latest version
- No disk space used
- No manual updates needed
- Works immediately

### Method 2: Global Installation
**Best for:** Frequent users, offline usage

```bash
# Install globally
npm install -g gemini-mcp-tool

# Verify installation
gemini-mcp --version
```

Configuration:
```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "gemini-mcp"
    }
  }
}
```

**Advantages:**
- Faster startup
- Works offline
- Consistent version control

### Method 3: Local Project Installation
**Best for:** Development, custom configurations

```bash
# In your project directory
npm install gemini-mcp-tool

# Use with relative path
node_modules/.bin/gemini-mcp --version
```

Configuration:
```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "./node_modules/.bin/gemini-mcp"
    }
  }
}
```

### Method 4: Claude Code Integration
**Best for:** Claude Code users

```bash
# Automatic MCP setup
claude mcp add gemini-cli -- npx -y gemini-mcp-tool

# Or with global installation
claude mcp add gemini-cli -- gemini-mcp
```

## Platform-Specific Instructions

### macOS
```bash
# Install prerequisites via Homebrew
brew install node python3

# Configuration file location
~/Library/Application\ Support/Claude/claude_desktop_config.json
```

### Windows
```powershell
# Install via Chocolatey
choco install nodejs python3

# Configuration file location
%APPDATA%\Claude\claude_desktop_config.json
```

### Linux (Ubuntu/Debian)
```bash
# Install prerequisites
sudo apt update
sudo apt install nodejs npm python3 python3-pip

# Configuration file location
~/.config/claude/claude_desktop_config.json
```

## Advanced Configuration

### Custom Arguments
```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "npx",
      "args": ["-y", "gemini-mcp-tool"],
      "env": {
        "GEMINI_MODEL": "gemini-pro",
        "GEMINI_TIMEOUT": "30000"
      }
    }
  }
}
```

### Multiple Model Configurations
```json
{
  "mcpServers": {
    "gemini-pro": {
      "command": "npx",
      "args": ["-y", "gemini-mcp-tool", "--model=gemini-pro"]
    },
    "gemini-flash": {
      "command": "npx", 
      "args": ["-y", "gemini-mcp-tool", "--model=gemini-1.5-flash"]
    }
  }
}
```

## Troubleshooting

### Common Issues

#### "Command not found: gemini"
```bash
# Reinstall Gemini CLI
pip install --upgrade google-generativeai-cli

# Check PATH
echo $PATH | grep -o '[^:]*python[^:]*'
```

#### "MCP server not responding"
1. Verify configuration file syntax with JSON validator
2. Check file permissions: `chmod 644 claude_desktop_config.json`
3. Restart Claude Desktop completely
4. Check logs in Claude Desktop → Help → Show Logs

#### "Permission denied" on macOS/Linux
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or use a Node version manager like nvm
```

#### "API key not configured"
```bash
# Reconfigure Gemini CLI
gemini config set api_key YOUR_NEW_API_KEY

# Verify configuration
gemini config get api_key
```

### Performance Optimization

#### Faster Startup with Global Install
Use Method 2 (global installation) for faster startup times.

#### Reduce Network Calls
Cache frequently used models locally:
```bash
# Pre-warm model cache
gemini generate "test" --model=gemini-pro
```

## Verification Steps

### 1. Test Basic Connectivity
```bash
# Direct CLI test
gemini generate "Hello, world!"
```

### 2. Test MCP Integration
In Claude Desktop/Code:
```
/gemini-cli:ping "Testing MCP connection"
```

### 3. Test File Analysis
```
/gemini-cli:analyze @package.json "What does this file do?"
```

## Next Steps

After successful installation:
- Read the [Getting Started](/getting-started/) guide for usage examples
- Explore [Commands](/usage/commands) for full command reference
- Check [Examples](/usage/examples) for real-world use cases
- Join our community for support and tips

::: warning Important
Always restart Claude Desktop completely after modifying the configuration file.
:::