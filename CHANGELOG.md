# Changelog

## [Unreleased]

## [1.1.4]
- **CRITICAL FIX: MCP Protocol Enforcement** - Solves the core issue where Claude wasn't using `changeMode: true` for edit requests
- **NEW: Intelligent Edit Detection** - Automatically detects edit intent in prompts and enables changeMode without relying on documentation
- **MCP Schema Validation** - Protocol-level parameter validation prevents incorrect tool usage
- **Auto-Enable ChangeMode** - When `allFiles: true` or edit patterns detected, `changeMode` is automatically enabled
- **MAJOR REWRITE: MCP-Native Batching System** - Replaced custom job system with proper MCP progress notifications and cursor-based pagination
- **NEW: Batch Processing Strategies** - Added `batchStrategy` parameter with options: "single", "parallel", "sequential", "smart"
  - `parallel`: Process different file types simultaneously (TypeScript, JavaScript, Python, etc.)
  - `sequential`: Process by importance (core files → components → utilities)
  - `smart`: Critical files first, then remaining files
- **Enhanced allFiles Parameter** - Now properly passes original prompts to Gemini without modification, respecting AI's @ syntax choices
- **MCP Progress Notifications** - Real-time progress updates during long-running batch operations (every 25 seconds to prevent timeouts)
- **Cursor-Based Continuation** - Use `cursor: <id>` to continue batch results, following MCP pagination spec
- Fixed token limit bug: gemini-2.5-pro returning 45k+ tokens now automatically falls back to gemini-2.5-flash
- Added proper token counting (character-to-token estimation) for better response management
- Removed redundant job continuation system - replaced with standard MCP patterns
- Automatic cleanup of expired batch states (1 hour expiration)
- **Breaking Change**: Old `continue job <id>` syntax replaced with MCP cursor-based continuation

## [1.1.3]
- "gemini reads, claude edits"
- Added `changeMode` parameter to ask-gemini tool for structured edit responses using claude edit diff.
- Testing intelligent parsing and chunking for large edit responses (>25k characters). I recommend you provide a focused prompt, although large (2000+) line edits have had success in testing.
- Added structured response format with Analysis, Suggested Changes, and Next Steps sections
- Improved guidance for applying edits using Claude's Edit/MultiEdit tools, avoids reading...
- Testing token limit handling with continuation support for large responses

## [1.1.2]
- Gemini-2.5-pro quota limit exceeded now falls back to gemini-2.5-flash automatically. Unless you ask for pro or flash, it will default to pro.

## [1.1.1]

- Public
- Basic Gemini CLI integration
- Support for file analysis with @ syntax
- Sandbox mode support
