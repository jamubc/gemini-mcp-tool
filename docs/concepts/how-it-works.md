# How It Works

## Key Components

### 1. MCP Server
- Implements Model Context Protocol
- Handles communication with Claude and other MCP Clients
- Manages tool registration and execution

### 2. Gemini CLI Integration
- Executes `gemini` commands via subprocess
- Handles file paths and context

## Request Flow

1. **User Input** → Claude Desktop receives slash command or natural language
2. Claude sends request to MCP server → **MCP Protocol**
3. **Tool Execution** → Gemini responds → **MCP Protocol**
5. **Response** → Results to Claude
