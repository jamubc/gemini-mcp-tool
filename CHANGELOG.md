# Changelog

## [Unreleased]

### Removed
- **BREAKING CHANGE**: Completely removed `changeMode` parameter and all structured edit functionality
  - Removed `changeMode` parameter from `ask-gemini` tool
  - Removed `fetch-chunk` tool and chunking system
  - Removed change mode parsing, translation, and caching utilities
  - Simplified codebase by removing complex structured editing features
  - Tests now use `gemini-2.5-flash` as default model for cost efficiency

### Improved
- Simplified MCP server architecture by removing changeMode complexity
- Improved reliability by eliminating problematic structured editing features
- Better error handling without changeMode edge cases

## [1.1.5]
- Bump version to 1.1.5

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
