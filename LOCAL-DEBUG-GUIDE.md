# 本地调试配置指南

## 方案一：使用最新NPM包（推荐）

### 1. 更新到最新版本
```bash
npm uninstall -g gemini-mcp-tool-windows-fixed
npm install -g gemini-mcp-tool-windows-fixed@1.0.6
```

### 2. 重新配置MCP
在你的MCP配置文件中更新版本：
```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "npx",
      "args": ["gemini-mcp-tool-windows-fixed@1.0.6"]
    }
  }
}
```

## 方案二：本地开发调试

### 1. 克隆或下载项目
```bash
git clone <repository-url>
cd gemini-mcp-tool-windows-fixed
npm install
```

### 2. 配置环境变量
在 `lib/.env` 文件中设置你的API密钥：
```
GEMINI_API_KEY=your_actual_api_key_here
```

### 3. 本地MCP配置
在你的MCP配置文件中使用本地路径：
```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "node",
      "args": ["D:/gemini/index.js"],
      "cwd": "D:/gemini"
    }
  }
}
```

### 4. 启动本地调试
```bash
# 在项目目录下
node index.js
```

## 方案三：NPM Link方式

### 1. 在项目目录下创建全局链接
```bash
cd D:/gemini
npm link
```

### 2. 在MCP配置中使用链接
```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "gemini-mcp-tool-windows-fixed"
    }
  }
}
```

**注意：** 如果遇到 `'gemini-mcp-tool-windows-fixed' 不是内部或外部命令` 的错误，请确保：
1. 已正确执行 `npm link`
2. Node.js 的全局 bin 目录在系统 PATH 中
3. 可以通过 `npm config get prefix` 查看全局安装路径

## 调试技巧

### 1. 查看日志
- 服务器启动日志会显示API密钥加载状态
- 使用 `console.error` 输出的调试信息

### 2. 测试基本功能
```javascript
// 测试ping
{
  "tool": "ping",
  "args": {"prompt": "test"}
}

// 测试基本ask-gemini
{
  "tool": "ask-gemini",
  "args": {
    "prompt": "Hello",
    "changeMode": false
  }
}
```

### 3. 常见问题排查

#### API密钥问题
- 确保 `.env` 文件在 `lib/` 目录下
- 检查API密钥格式是否正确
- 查看启动日志中的 "GEMINI_API_KEY loaded" 状态

#### PowerShell路径问题
- 工具会自动检测PowerShell路径
- 可以通过 `powershellPath` 参数指定自定义路径

#### ChangeMode问题
- 当前版本已修复MCP协议兼容性问题
- 添加了类型检查和调试信息
- 如果仍有问题，查看服务器日志中的详细错误信息

## 版本更新说明

### v1.0.6 更新内容
- 修复了changeMode功能的MCP协议兼容性问题
- 添加了详细的调试日志
- 改进了类型检查和错误处理
- 优化了PowerShell参数转义逻辑

### 推荐使用方式
1. **生产环境**：使用NPM包 `gemini-mcp-tool-windows-fixed@1.0.6`
2. **开发调试**：使用本地路径配置
3. **快速测试**：使用npm link方式

## 联系支持
如果遇到问题，请提供：
1. 使用的配置方式（NPM包/本地/link）
2. 完整的错误日志
3. MCP配置文件内容
4. 操作系统和PowerShell版本信息