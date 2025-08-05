# 🚀 Gemini MCP Tool - Windows Fixed Version Installation Guide

> **最新版本 v1.0.4** - 修复了 brainstorm 工具错误，设置默认模型为 2.5 系列

## 🆕 版本更新日志

### v1.0.4 (最新)

- 🔧 **修复 brainstorm 工具错误** - 解决了 `Cannot read properties of undefined` 错误
- 🚀 **默认模型升级** - 现在默认使用 `gemini-2.5-pro` 模型，性能更佳
- 🛡️ **增强错误处理** - 改进了参数验证和错误信息
- ✅ **向后兼容** - 保持与现有配置的完全兼容性

### v1.0.3
- ✅ **修复 PowerShell 执行错误** - 解决 `spawn powershell.exe ENOENT` 问题
- ✅ **改进 Windows 兼容性** - 自动检测可用的 PowerShell 版本
- ✅ **修复未定义变量错误** - 修复 `executeCommandWithPipedInput` 函数中的 `args` 变量问题
- ✅ **增强错误处理** - 更好的错误信息和调试输出

### v1.0.1
- 基础 Windows 兼容性修复

### v1.0.0
- 初始版本

## 📋 Prerequisites

1. **Node.js** (v16.0.0 or higher)
   ```powershell
   # Check version
   node --version
   npm --version
   ```

2. **Google Gemini CLI**
   ```powershell
   # Install Gemini CLI
   npm install -g @google/generative-ai-cli
   
   # Verify installation
   gemini --version
   ```

3. **Gemini API Key**
   - Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

## 🔧 Installation Methods

### Method 1: NPX (Recommended)

```powershell
# 使用最新版本 (推荐)
npx gemini-mcp-tool-windows-fixed@1.0.4

# 或者使用最新版本标签
npx -y gemini-mcp-tool-windows-fixed@latest
```

### Method 2: Global Installation

```powershell
# 安装最新版本
npm install -g gemini-mcp-tool-windows-fixed@1.0.4

# 测试工具
gemini-mcp-tool-windows-fixed
```

### Method 3: 更新现有安装

如果您之前安装了旧版本，请先更新：

```powershell
# 卸载旧版本
npm uninstall -g gemini-mcp-tool-windows-fixed

# 清除缓存
npm cache clean --force

# 安装最新版本
npm install -g gemini-mcp-tool-windows-fixed@1.0.3
```

## ⚙️ MCP Client Configuration

### For Claude Code (One-Line Setup)

```bash
# One-command setup for Claude Code
claude mcp add gemini-cli -- npx -y gemini-mcp-tool-windows-fixed@1.0.4
```

### For Development/Testing (Local Version)

如果你想使用本地开发版本进行测试，可以使用以下配置：

1. 首先确保你已经克隆了项目到本地
2. 使用提供的 `gemini-cli-test.json` 配置文件：

```json
{
  "mcpServers": {
    "gemini-cli-test": {
      "command": "node",
      "args": ["D:\\gemini\\lib\\fixed-mcp-tool.js"],
      "env": {
        "GEMINI_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**注意：** 请将路径 `D:\\gemini\\lib\\fixed-mcp-tool.js` 替换为你的实际项目路径。

**Verify Installation:**
Type `/mcp` inside Claude Code to verify the `gemini-cli` MCP is active. <mcreference link="https://github.com/jamubc/gemini-mcp-tool" index="1">1</mcreference>

### PowerShell Path Configuration (Optional)

如果你的系统中 PowerShell 路径不在标准位置，或者你想使用特定版本的 PowerShell，可以在调用工具时指定 `powershellPath` 参数：

**ask-gemini 工具示例：**
```json
{
  "prompt": "你的问题",
  "model": "gemini-pro",
  "powershellPath": "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
}
```

**brainstorm 工具示例：**
```json
{
  "topic": "你的主题",
  "count": 5,
  "powershellPath": "C:\\Program Files\\PowerShell\\7\\pwsh.exe"
}
```

**常见 PowerShell 路径：**
- Windows PowerShell 5.1: `C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
- PowerShell 7+: `C:\\Program Files\\PowerShell\\7\\pwsh.exe`
- 如果不指定此参数，系统会自动检测可用的 PowerShell 版本

### Alternative: Import from Claude Desktop
If you already have it configured in Claude Desktop:

1. Add to your Claude Desktop config (see below)
2. Import to Claude Code:
   ```bash
   claude mcp add-from-claude-desktop
   ```

### For Trae AI

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
        "gemini-mcp-tool-windows-fixed@1.0.4"
      ],
      "env": {
        "GEMINI_API_KEY": "YOUR_ACTUAL_API_KEY_HERE"
      },
      "isActive": true,
      "providerUrl": "https://github.com/your-username/gemini-mcp-tool-windows-fixed"
    }
  }
}
```

### For Claude Desktop

1. Open: `%APPDATA%\Claude\claude_desktop_config.json`
2. Add this configuration:

```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "npx",
      "args": ["-y", "gemini-mcp-tool-windows-fixed@1.0.4"],
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

## 🧪 Testing Installation

### 1. Test Gemini CLI

```powershell
gemini -p "Hello, how are you?"
```

### 2. Test MCP Tool

```powershell
# Test with NPX
npx -y gemini-mcp-tool-windows-fixed

# Should show: [GMCPT] Gemini CLI MCP Server (Fixed) started
```

### 3. Test MCP Integration

After configuring your MCP client:

1. Restart your MCP client (Trae AI, Claude Desktop)
2. Try asking: "Use gemini to explain what MCP is"
3. Check for successful responses

## 🐛 Troubleshooting

### Common Issues

#### 1. "Command not found: gemini"

```powershell
# Reinstall Gemini CLI
npm uninstall -g @google/generative-ai-cli
npm install -g @google/generative-ai-cli

# Check PATH
echo $env:PATH
```

#### 2. "API key not found"

```powershell
# Check if API key is set
echo $env:GEMINI_API_KEY

# If empty, set it
$env:GEMINI_API_KEY = "your-api-key"
```

#### 3. "Permission denied"

```powershell
# Run as Administrator
# Or check execution policy
Get-ExecutionPolicy
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### 4. "Module not found"

```powershell
# Clear npm cache
npm cache clean --force

# Reinstall
npm install -g gemini-mcp-tool-windows-fixed@1.0.3
```

#### 5. "spawn powershell.exe ENOENT" 错误

这个错误在 v1.0.3 中已修复。如果仍然遇到此错误：

```powershell
# 确保使用最新版本
npm uninstall -g gemini-mcp-tool-windows-fixed
npm cache clean --force
npm install -g gemini-mcp-tool-windows-fixed@1.0.3

# 或使用 npx
npx gemini-mcp-tool-windows-fixed@1.0.3
```

**原因：** 旧版本 (v1.0.0, v1.0.1) 存在 PowerShell 执行路径问题
**解决方案：** 更新到 v1.0.4 或更高版本

#### 6. PowerShell 版本兼容性

工具会自动检测可用的 PowerShell 版本：
- Windows PowerShell (powershell.exe)
- PowerShell Core (pwsh)

如果遇到问题，请确保至少安装了其中一个版本。

### Debug Mode

Enable debug logging:

```json
"env": {
  "GEMINI_API_KEY": "your-key",
  "DEBUG": "true"
}
```

## 📞 Support

If you encounter issues:

1. Check the [troubleshooting section](#troubleshooting)
2. Verify all prerequisites are installed
3. Test each component individually
4. Open an issue with:
   - Windows version
   - PowerShell version
   - Node.js version
   - Complete error logs

## 🎯 Usage Examples

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

## 🎉 Success!

Once everything is working, you should be able to:

- Ask Gemini questions through your MCP client
- Analyze files using `@filename` syntax
- Use sandbox mode for safe code execution
- Leverage Gemini's large context window for complex analysis

---

**Happy coding! 🚀**