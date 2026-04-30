# Changelog

## [Unreleased]

## [1.2.0] - 2026-04-30

### Added
- `--no-fallback` CLI flag: when set, quota exceeded (429) errors from the underlying
  `gemini` CLI are propagated unchanged instead of silently falling back to `gemini-flash`.
- `GEMINI_MCP_NO_FALLBACK=1` environment variable: equivalent to `--no-fallback`.
  Useful for process-level opt-out without changing CLI invocation.

Admonish users: the Admonish extract adapter always passes `--no-fallback`; no
configuration needed on your end. Requires `@jacobcxdev/gemini-mcp-tool >= 1.2.0`.

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
