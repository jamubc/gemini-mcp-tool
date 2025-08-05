# 终端配置指南

本指南提供了在不同终端环境中配置 Gemini MCP 工具的详细步骤，确保工具能够被正确检测和使用。

## 配置检测提示

成功配置后，您应该能在终端中看到类似以下的提示：

```
[GMCPT] Gemini MCP Tool (Windows Fixed) v1.0.21 started
[GMCPT] GEMINI_API_KEY loaded from environment
[GMCPT] Server listening on port 3000
[GMCPT] Available tools: ask-gemini, ping, Help, brainstorm, fetch-chunk, timeout-test
```

## 通用配置步骤

### 1. 安装 Node.js

确保您已安装 Node.js v16.0.0 或更高版本：

```powershell
node --version  # 应该是 v16+
```

### 2. 设置 Gemini API 密钥

```powershell
# 临时（当前会话）
$env:GEMINI_API_KEY = "your-actual-api-key"

# 永久（用户级别）
[Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "your-actual-api-key", "User")

# 验证
echo $env:GEMINI_API_KEY
```

## 特定终端配置

### Trae AI

1. 打开: `%APPDATA%\Trae\User\mcp.json`
2. 添加以下配置:

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

1. 打开: `%APPDATA%\Claude\claude_desktop_config.json`
2. 添加以下配置:

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

### Claude Code

使用以下命令一键设置:

```bash
claude mcp add gemini-cli -- npx -y gemini-mcp-tool-windows-fixed@1.0.21
```

### CherryStudio

1. 打开 CherryStudio 配置文件
2. 添加以下配置:

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

## 故障排除

如果您在配置后看不到检测提示或工具无法正常工作，请尝试以下步骤：

1. 确认 Node.js 已正确安装并添加到 PATH 环境变量
2. 验证 GEMINI_API_KEY 环境变量已正确设置
3. 尝试重启终端或应用程序
4. 检查网络连接是否正常
5. 确保使用最新版本 (v1.0.21) 的工具

如果问题仍然存在，请在 GitHub 仓库提交 issue。