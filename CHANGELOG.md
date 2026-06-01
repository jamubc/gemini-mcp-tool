# Changelog

## [1.1.8] - 2026-06-01

### Security
- Remove unused `inquirer` production dependency — closes CVE-2026-44705 (path traversal in `tmp` via `external-editor`, HIGH/CWE-22)
- Remove unused `ai` production dependency — closes CVE-2026-8769 (uncontrolled resource consumption in `@ai-sdk/provider-utils`, LOW/CWE-400)
- Upgrade `mermaid` dev dependency to `^11.15.0` — closes CVE-2026-41159, CVE-2026-41149, CVE-2026-41148 (CSS/HTML injection, MED) and auto-bumps `uuid` to ≥11.1.1 (CVE-2026-41907)
- Add `overrides` for `postcss ^8.5.10` (CVE-2026-41305) and `dompurify ^3.4.0` (CVE-2026-41238/41239/41240)

## [1.1.7] - 2026-05-31
Reliability patch plus the project's first automated test suite. Hardens cross-platform execution (the Windows fixes and a few robustness guards) and adds a categorized `node:test` suite that gates CI. **No runtime or default-config changes vs 1.1.6** — the only new knob is the opt-in `GEMINI_CLI_PATH`.

- **Windows: stdin prompt passing** — `changeMode` and `@file` prompts are sent to the Gemini CLI on **stdin** instead of the `-p` flag, sidestepping cmd.exe argument parsing and the OS command-line length limit; this also avoids the deprecated-`-p` positional-prompt conflict for those prompts (#48). Adds `windowsHide` to suppress the popup console window. (harvested from #27 via #77)
- **Windows: executable resolution** — honours `GEMINI_CLI_PATH`, otherwise resolves the real `gemini` shim via `where` (preferring `.cmd`), fixing "command not found" when the MCP server doesn't inherit your shell's PATH.
- **Clearer ENOENT guidance** when the executable isn't found, including the `GEMINI_CLI_PATH` hint.
- **stdin EPIPE / spawn-error hardening** — a child that closes stdin early no longer throws an uncaught error that could drop the long-lived server connection (candidate fix for the disconnects in #64).
- **`Help` tool** now invokes `gemini --help` instead of `-help`, which the Gemini CLI's yargs parser split into `-h -e -l -p`.
- **Test suite** — categorized `node:test` coverage under `test/`: **unit** (command quoting / Windows resolution / ENOENT, the `@file` guard, the changeMode parser/chunker/translator, the chunk cache, the tool registry, brainstorm prompt building), **integration** (the changeMode → `fetch-chunk` pipeline and the registry → tool contract, both hermetic), and **e2e** (the real gemini driven through the built MCP server; auto-skips without gemini). `npm test` runs unit+integration and now **gates CI** (Node 18/20/22); `npm run test:e2e` runs the live suite. Includes a regression test for the changeMode cache-miss path (#67).
- **Internal `doctor`** (work in progress) — `npm run doctor` reports node + the detected `gemini` install; `npm run doctor test` builds the server and runs the e2e suite (the automated replacement for manual MCP inspector or costly token burning tests and checks). Excluded from the npm package (`files`/`bin`).
- **LLM judge semantic test suite** (`test/judge/`) — Use DeepSeek or OpenRouter to evaluate tool outputs against validation rubrics. This is a work in progress.
- **Diagnostics logging** — E2E harness now logs the spawned server's working directory (`📂 SPAWNED CWD`) for easier local debugging.

## [1.1.6] - 2026-05-30
_Emergency security patch — CVE-2026-0755 fix only._
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
