# Changelog

## [Unreleased]

## [1.1.4]
- **CRITICAL FIX: MCP Protocol Enforcement** - Solves the core issue where Claude wasn't using `changeMode: true` for edit requests
- **CRITICAL FIX: Directive Response Format** - Fixed the core issue where Claude was reading files instead of implementing Gemini's edits directly
- **CRITICAL FIX: File Reference Extraction** - Fixed fundamental flaw where system ignored user's actual file requests (e.g., `@ts`) and used hardcoded patterns instead
  - Now extracts and respects user's actual `@` file references from prompts
  - Eliminates hardcoded assumptions about project structure (`@index.*`, `@main.*`, etc.)
  - Ensures Gemini receives exactly what user requested instead of generic patterns
- **NEW: Intelligent Edit Detection** - Automatically detects edit intent in prompts and enables changeMode without relying on documentation
- **Enhanced "Gemini Reads, Claude Edits" Workflow** - Response format now uses imperative language to force direct implementation
  - Added explicit "DO NOT READ FILES" directives in structured responses
  - Included step-by-step implementation instructions that override Claude's natural "read first" behavior
  - Added trust anchoring language ("no verification needed", "Gemini has already done the reading")
- **Reasonable Token Limits** - Fixed excessive token limits that were still causing failures
  - Reduced batch size from 1M tokens to 20k tokens (reasonable size with buffer)
  - Input batching threshold lowered from 1M to 25k tokens for practical use
  - Conservative 5k tokens per file pattern estimation (down from 150k)
- **User-Centric File Batching** - Completely redesigned batching to respect user intent
  - Added `extractFileReferences()` function to parse user's `@` patterns from prompts
  - Batching now preserves user's original file requests instead of substituting them
  - Single file references (e.g., `@ts`) used directly when under token limits
  - Multiple references batched intelligently while maintaining user's specific paths
- **MCP Schema Validation** - Protocol-level parameter validation prevents incorrect tool usage
- **Auto-Enable ChangeMode** - When `allFiles: true` or edit patterns detected, `changeMode` is automatically enabled
- **MAJOR REWRITE: MCP-Native Batching System** - Replaced custom job system with proper MCP progress notifications and cursor-based pagination
- **Completed MCP Batch System Cleanup** - Removed all old batch system code for clean implementation
  - Eliminated `createFileBatches`, `startBatchedAnalysis`, `activeBatches` (old system)
  - Kept only MCP-compliant functions: `createMCPFileBatches`, `startMCPBatchedAnalysis`, `activeMCPBatches`
  - Updated cleanup function to `cleanupExpiredMCPBatches`
- **Enhanced allFiles Parameter** - Now properly passes original prompts to Gemini without modification, respecting AI's @ syntax choices
- **MCP Progress Notifications** - Real-time progress updates during long-running batch operations using MCP protocol
- **Cursor-Based Continuation** - Use `cursor: <id>` to continue batch results, following MCP pagination spec
- Fixed token limit bug: gemini-2.5-pro returning 45k+ tokens now automatically falls back to gemini-2.5-flash
- Added proper token counting (character-to-token estimation) for better response management
- Removed redundant job continuation system - replaced with standard MCP patterns
- Automatic cleanup of expired batch states (1 hour expiration)
- **Performance Improvements** - Faster execution with single MCP-compliant implementation and realistic token limits
- **Breaking Change**: Old `continue job <id>` syntax replaced with MCP cursor-based continuation
- **Breaking Change**: Batch strategies no longer use hardcoded file patterns - they respect user's actual file references

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
