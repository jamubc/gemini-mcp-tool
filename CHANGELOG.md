# Changelog

## [1.1.6] - 2026-05-30
_Emergency security patch — the CVE-2026-0755 fix only, ahead of the larger 1.2.0 release._
- Security fix: OS command-injection / `@file` exfiltration via prompt quoting in `geminiExecutor.ts` (CVE-2026-0755, CWE-78). Fixes #73 (and the literal-quote corruption in #66).
  - Removed the broken double-quote wrapping from both the primary and fallback paths. With `spawn` running `shell: false`, those quotes were passed as literal characters — they provided no protection and corrupted `@file` references. Windows `.cmd` argument quoting is hardened separately (see below).
  - Added `assertSafeFileReferences()`, which rejects any `@file` reference that resolves outside the project working directory (absolute paths, `~` home references, and `../` traversal), closing the arbitrary-file-read exfiltration vector while preserving legitimate in-project `@file` usage.
  - Hardened the Windows `shell: true` path in `commandExecutor.ts`: every argument is now quoted (previously only those containing whitespace), so cmd metacharacters (`& | < > ^ ( )`) in spaceless tokens such as `a&calc` can no longer break out into command injection. Affected every tool that shells out (`ask-gemini`, `brainstorm`, `ping`).
- Fixed `spawn EINVAL` error on Windows with Node 22+ when launching `.cmd` shims (PR #69).

## [1.1.5]
- Security fix: prevent path-traversal READ and DELETE of arbitrary `.json` files via `cacheKey` parameter (CWE-22).
  - The `cacheKey` is now validated against the expected format (`/^[a-f0-9]{8}$/`) inside `getChunks()` itself, so all callers are protected.
  - Added matching format validation to the `ask-gemini` tool's `chunkCacheKey` parameter, which was previously unguarded and bypassed the `fetch-chunk` regex entirely.
  - Added defense-in-depth path-containment check (`path.resolve` + `startsWith`) in the cache layer.
  - Removed the silent `fs.unlinkSync` on parse errors — it previously created a DELETE primitive outside `CACHE_DIR`.
  - Rewrote the path-traversal test to import and validate the real source functions instead of local reimplementations.

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
