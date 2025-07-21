# CLAUDE.md

MCP complexity is protocol compliance, not over-engineering.
# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

## Project Structure

### Core Files

**`src/index.ts`** - Main MCP server entry point
- Sets up the MCP server instance and stdio transport
- Handles all MCP protocol requests (ListTools, CallTool, ListPrompts, GetPrompt)
- Contains `executeGeminiCLI()` - orchestrates gemini-cli execution with Pro→Flash fallback logic
- Implements changeMode prompt engineering for structured edits
- Routes tool calls to appropriate handlers (ask-gemini, Ping, Help)
- Integrates changeMode parsing and translation pipeline

**`src/utils/commandExecutor.ts`** - Safe command execution utility
- Spawns child processes with security settings (shell: false)
- Monitors stderr in real-time for quota errors and fails fast
- Provides progress updates every 5 seconds during long-running commands
- Returns stdout on success, throws detailed errors on failure
- Focus: Process safety and error detection

**`src/utils/jsonFormat.ts`** - Tool and prompt definitions
- Centralizes all tool schemas with descriptions and input schemas
- Defines prompts for slash commands (/ask-gemini, /help, /ping)
- Exports as typed arrays compatible with MCP SDK types
- Single source of truth for all tool/prompt metadata

**`src/utils/logger.ts`** - Centralized logging utility
- Provides consistent log formatting with [Gemini MCP] prefix
- Methods for different log types: error, debug, toolInvocation, commandExecution
- All logs use console.warn (except errors) for stderr output
- Tracks command timing and progress updates

**`src/constants.ts`** - Centralized string constants
- Error messages (quota exceeded, tool not found, etc.)
- Status messages for UI notifications
- Model names (gemini-2.5-pro, gemini-2.5-flash)
- MCP protocol constants (roles, content types, status codes)
- CLI flags and command names

### changeMode Implementation Files

**`src/utils/changeModeParser.ts`** - Parses Gemini's structured edit output
- Supports two formats: markdown style (`**FILE:**`) and original (`/old/` `\new\`)
- Extracts file names, line numbers, and code blocks
- Validates edit integrity
- Returns structured ChangeModeEdit objects

**`src/utils/changeModeTranslator.ts`** - Translates parsed edits to Claude's format
- Converts ChangeModeEdit objects to Claude's str_replace_based_edit_tool format
- Creates properly formatted tool calls
- Handles formatting for changeMode responses

**`src/utils/changeModeChunker.ts`** - Intelligent chunking for large edit sets
- Splits large edit responses to fit within Claude's token limits
- Keeps file edits together when possible
- Configurable chunk size (default 180k characters)

### Supporting Files

**`src/interfaces.ts`** - TypeScript type definitions
- ToolArguments: Input parameter types for all tools
- Single, unified interface for tool arguments

### Dynamic Tool System (Optional)

**`src/tools/index.ts`** - Tool loader for dynamic tool loading
- Loads .tool.js/.tool.ts files from tools directory
- Validates tool structure (name, description, inputSchema, execute)
- Provides getTools() and getTool() methods
- Currently not integrated but available for future use

**`src/tool-integration.ts`** - Example integration code
- Shows how to integrate dynamic tool loading
- Preserves all existing built-in tools
- Demonstrates minimal changes needed
- Currently not active in main codebase

## Key Architectural Patterns

### Error Handling Flow
1. **commandExecutor**: Detects errors in real-time from stderr
2. **executeGeminiCLI**: Catches errors and implements fallback strategies
3. **MCP handlers**: Return structured errors to the protocol

### Separation of Concerns
- **Command execution**: Safety and monitoring (commandExecutor)
- **Business logic**: Gemini-specific features and fallbacks (index.ts)
- **Data definitions**: Schemas and constants (jsonFormat, constants)
- **Cross-cutting**: Logging and formatting utilities

### MCP Protocol Compliance
- All tools return `list[types.TextContent]`
- Proper error handling with isError flag
- Structured responses with behavioral metadata
- Support for both tools and slash commands




### changeMode System

The changeMode feature enables Gemini's 2M token capacity to read large codebases and output structured edits that Claude can apply without reading files. When `changeMode: true` is passed:

1. **Prompt Engineering**: Gemini receives explicit instructions to output edits in OLD/NEW format
2. **Format Support**: Parser handles both markdown (`**FILE:**`) and original (`/old/` `\new\`) formats
3. **Translation Pipeline**: Edits are parsed → chunked → translated to Claude's tool format
4. **Token Management**: Large edit sets are intelligently chunked to fit Claude's limits

This achieves the goal of "Gemini reads, Claude edits" - leveraging each model's strengths.