# Changelog

## [Unreleased]

## [1.1.4]
- Fixed token limit bug: gemini-2.5-pro returning 45k+ tokens for small prompts now automatically falls back to gemini-2.5-flash
- Added proper token counting (character-to-token estimation) instead of character length checking
- Enhanced MCP progress notifications every 25 seconds to mitigate connection timeouts during long operations
- **NEW: Stateful job system for large editing tasks** - No more "sorry too big" responses! Large changeMode responses are split into manageable jobs that can be continued with `continue job <id>`
- Intelligent chunking preserves OLD/NEW edit pairs across job boundaries
- Jobs expire after 1 hour and include automatic cleanup

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
