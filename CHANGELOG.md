# Changelog

## [1.2.0] - 2026-05-30
First feature release after the 1.1.6 security patch. Hardens cross-platform execution, adds an opt-in safety control and native multi-turn sessions, makes the CLI backend pluggable (ahead of Gemini CLI's retirement), and adds a real test suite. **With no environment variables set, behaviour is identical to 1.1.6** — every new knob (backend, model, approval mode, timeout, executable path) is off/unset by default and only changes behaviour when you opt in.

### Added
- **Approval mode** — optional `approvalMode` argument on `ask-gemini`/`brainstorm` (and `GEMINI_MCP_APPROVAL_MODE` env), forwarding Gemini's `--approval-mode` (`default` / `auto_edit` / `yolo` / `plan`). Opt-in: when unset, behaviour is unchanged. Use `yolo` / `auto_edit` with `sandbox` to let Gemini run or edit; `plan` runs Gemini as an autonomous read-only planner.
- **Native multi-turn sessions** — `sessionId` and `resume` arguments forward Gemini's `--session-id` / `--resume`; the active session id is surfaced in the response so a follow-up call can continue the conversation. Builds on #50; uses the CLI's own sessions rather than local transcript storage.
- **Pluggable backends** — the executor is now backend-agnostic. The Gemini CLI stays the default; set `GEMINI_MCP_BACKEND=agy` to use the **experimental** Antigravity CLI (`agy`) backend, ahead of Gemini CLI's 2026-06-18 retirement for free/Pro/Ultra tiers. (agy print-mode is Flash-only, and its reply is recovered from agy's transcript files to work around the upstream `agy -p` empty-stdout bug.)
- **Per-command timeout (opt-in)** — set `GEMINI_MCP_TIMEOUT_MS` to a positive number of milliseconds to terminate a hung CLI call (SIGTERM → SIGKILL). **Disabled by default** to match 1.1.6, which waited indefinitely; unset or `0` keeps that behaviour.
- **Windows executable resolution** — honours `GEMINI_CLI_PATH`, otherwise resolves the real `gemini` shim via `where` (preferring `.cmd`), fixing "command not found" when the MCP server doesn't inherit your shell's PATH.
- **Configurable default model** — `GEMINI_MODEL` sets the model used when a call doesn't pass one, so the assistant can't silently fall back to an older model (#49); `GEMINI_FLASH_MODEL` overrides the quota-fallback target. Precedence: per-call `model` arg → `GEMINI_MODEL` → Gemini CLI default.
- **`.env` support** — the server loads recognised `GEMINI_*` keys from a `.env` file (package root, then cwd) at startup as global per-install defaults. Opt-in: only known keys are read, an already-set shell export or MCP-client env always wins, and no `.env` means no change (1.1.6 parity).
- **Test suite** — `node:test` coverage for the `@file` security guard, Windows quoting/resolution, approval-mode and session argument building, backend selection, and timeout parsing (`npm test`).

### Changed
- `engines.node` raised to `>=18`.
- The server version and the documentation navbar badge are now read from `package.json` dynamically, instead of hardcoded strings that had drifted to `1.1.4`.
- Installing from a Git checkout now builds automatically via a `prepare` script.

### Fixed
- The `Help` tool now invokes `gemini --help` instead of `-help`, which yargs mis-parsed as `-h -e -l -p`.
- Clearer, platform-aware guidance when the executable is not found (ENOENT), including the `GEMINI_CLI_PATH` hint.
- Windows robustness: complex prompts (`changeMode` / `@file`) are sent to the Gemini CLI on **stdin** instead of the `-p` flag, sidestepping cmd.exe argument parsing and the OS command-line length limit; added `windowsHide` to suppress the popup console window. (#27, #77)

### Internal
- **Per-call timeout default flipped to off** — `GEMINI_MCP_TIMEOUT_MS` now defaults to disabled (waits forever, exactly like 1.1.6) instead of 30 minutes; the timeout is strictly opt-in. `resolveTimeoutMs` returns `0` when unset/blank.
- **Setup doctor kept as an unpublished dev tool** — `scripts/doctor.mjs` (run via `npm run doctor`) prints the live system state relevant to the MCP server — active backend, detected `gemini`/`agy` installs (path + version), effective model/approval/timeout config, and every related env var — for debugging and at-a-glance awareness. Intentionally removed from the npm `bin` and published `files`, so it ships with the repo but **not** the package; may be released publicly later.
  - Reports the source of each setting: a **global** value (this shell's env or the loaded `.env`, shown in gold as `(set globally)`) affects every client, vs a **per-client** value read from each Claude Code MCP server's `env` block in `~/.claude.json`.
  - Adds `npm run doctor setup` — an interactive wizard that walks each option (showing the current value + recommended default; skip / set / pick-from-list, with a curated model list per backend and model selection skipped for `agy`) and applies the result to the `.env` file and/or a chosen Claude Code server (backing up `~/.claude.json` first).

## [1.1.6] - 2026-05-30
_Emergency security patch — the CVE-2026-0755 fix only, ahead of this 1.2.0 release._
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
