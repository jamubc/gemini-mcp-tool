# Changelog

## [Unreleased]

## [1.1.4] - "Gemini Reads, Claude Edits" Complete Implementation
- **CRITICAL FIX: File Reference Extraction** - System now respects user's actual file requests instead of ignoring them
  - When users specify `@ts/utils/`, Gemini now receives `@ts/utils/` (not hardcoded `@index.*` patterns)
  - Eliminates the core issue where Gemini couldn't access requested files
- **CRITICAL FIX: Directive Response Format** - Claude no longer wastes time reading files after Gemini analysis
  - Concise "DO NOT READ FILES" instructions with clear edit commands
  - Prevents unnecessary file reading that wastes time and money
- **NEW: One-Time Hook Configuration** - Added `/mcp__gemini-cli__configure-hooks` slash command
  - **Run once, works forever**: Single setup permanently eliminates "File has not been read yet" errors
  - Once configured, Claude can directly implement Gemini's edits without reading files first
  - Preserves diff view and approval process - you still see changes before they're applied
  - No need to run again - hooks persist across all future sessions
- **Reasonable Token Limits** - Fixed excessive limits that caused failures
  - Reduced from 1M tokens to 25k threshold with 20k batch sizes
  - Conservative file pattern estimation prevents token limit errors
- **MCP-Compliant Batching** - Clean implementation using proper MCP protocol
  - Uses user's actual file references for batching (not hardcoded assumptions)
  - MCP progress notifications and cursor-based continuation
  - Removed old batch system for cleaner, faster execution
- **Auto-Enable ChangeMode** - Automatically detects edit intent and enables structured responses
- **Enhanced allFiles Support** - Properly handles large codebases with intelligent batching
- **Performance Improvements** - Faster execution with realistic token limits and clean architecture
- **Breaking Change**: Batch strategies now respect user's file references instead of using hardcoded patterns

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
