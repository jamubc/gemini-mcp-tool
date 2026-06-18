# Migrating from Gemini CLI to Antigravity CLI (`agy`)

> Status: **Active**. The migration from the Gemini CLI (`gemini`) to the Antigravity CLI
> (`agy`) ships in `gemini-mcp-tool` 1.1.8. The `agy` backend becomes the default on
> **2026-06-18**, the day Google retires the Gemini CLI for free, Pro, and Ultra users.
> Tracking: [discussion #90](https://github.com/jamubc/gemini-mcp-tool/discussions/90).

## Why this exists

On **2026-06-18**, Google retires the Gemini CLI for the free, Google AI Pro, and Google
AI Ultra tiers. After that date the `gemini` command stops serving requests for those
accounts — no grace period, no warning at call time. Standard/Enterprise Code Assist
licenses and paid Cloud API keys are unaffected, but the majority of this project's users
run on exactly the tiers that lose access.

`gemini-mcp-tool` is, at its core, a thin, hardened wrapper that shells out to the
`gemini` binary (see `src/utils/geminiExecutor.ts` and `src/utils/commandExecutor.ts`).
When that binary stops answering, every tool we expose — `ask-gemini`, `brainstorm`,
changeMode edits, `@file` analysis — stops working for free/Pro/Ultra users on the same
day. The official successor is the **Antigravity CLI**, invoked as **`agy`**. This is our
plan to get there without breaking the people still on the old CLI before the cutoff.

## TL;DR of what changes

`agy` is not a drop-in rename of `gemini`. It is a Go-based, agent-first CLI that shares a
runtime with the Antigravity desktop app. The surface we depend on differs in ways that
matter for a *non-interactive, programmatic* caller like an MCP server:

| Concern | Gemini CLI (today) | Antigravity CLI (`agy`) | Impact on us |
| --- | --- | --- | --- |
| Command | `gemini` | `agy` | Low — one constant |
| One-shot prompt | `-p/--prompt` (also positional), prints to stdout | `-p/--print` exists but **frequently writes nothing to stdout in 1.0.x** (reported in non-TTY/headless and Windows contexts) | **High** — our entire contract is "read stdout" |
| Model select | `-m gemini-2.5-pro` etc. | `--model` exists, but `-p` is **hardcoded to Gemini 3.5 Flash**; switching model in `-p` hangs | **High** — breaks our Pro/Flash strategy + quota fallback |
| `@file` inlining | CLI inlines `@path` file contents into the prompt | Not confirmed to exist; agent reads files via its own tools | **High** — `@file` is our headline feature |
| Sandbox | `-s/--sandbox` | `--sandbox` exists but tool execution is effectively unsandboxed in `-p` | **High** — security posture changes |
| Approval modes | `--approval-mode {default,auto_edit,yolo,plan}` | only `--dangerously-skip-permissions`, and it's a **no-op** in `-p` | **Medium/High** |
| Sessions | `--session-id <id>`, `--resume` | `--conversation <id>`, `--continue` (continue is **global**, not per-workspace) | **Medium** — concurrency hazard |
| Output format | `--output-format json` (structured) | `--output-format json` not reliably present in 1.0.x | **Medium** |
| Auth | gemini OAuth / API key | OS credential store; log in once via `agy -i` | **Low/Medium** |
| Transcript on disk | n/a (stdout is the source of truth) | JSONL transcripts under `~/.gemini/antigravity-cli/brain/...` (dual-writing `.db` now) | We currently depend on this; it's fragile |

The headline: **our integration assumes a clean, synchronous "prompt in → answer on
stdout" CLI. `agy` in its current form does not provide that.** Most of the work is
recovering that contract on top of an agent-first tool that wasn't designed for it.

---

## Deep dive: where the two CLIs diverge

### 1. The output contract is broken (`agy -p` empty stdout)

Everything in `executeCommand()` (`src/utils/commandExecutor.ts`) is built around the
child process writing the answer to stdout, which we accumulate and `resolve()` on a clean
exit. In `agy` 1.0.x — at least in the non-TTY/headless contexts an MCP server runs in, and
reported on Windows — `agy -p` authenticates, talks to the model, gets the answer back…
and then **exits 0 without printing it**. A zero exit with empty stdout currently looks
like "success, empty answer" to us.

Our workaround is to stop trusting stdout and read `agy`'s own transcript directly from its
observable on-disk format (the path PR #78's experimental backend also takes):

1. Map the current working directory to a conversation id via
   `~/.gemini/antigravity-cli/cache/last_conversations.json`.
2. Read the JSONL transcript at
   `~/.gemini/antigravity-cli/brain/<conv-id>/.system_generated/logs/transcript.jsonl`.
3. Take the entries after the last `USER_INPUT` where
   `source = MODEL, type = PLANNER_RESPONSE, status = DONE` and join their `content`.

(Our implementation prefers a conversation id we set explicitly via `--conversation`, then
the cwd→id map above, then the newest recently-written conversation — see Phase 2.)

This works, but it's a reverse-engineered private contract:

- **Format risk.** `agy` 1.0.5 already dual-writes a `.db` (SQLite) — reported both
  alongside the JSONL and under a separate `~/.gemini/antigravity-cli/conversations/<id>.db`,
  so the reader must probe both. When JSONL generation stops, the transcript reader breaks
  and we need the SQLite path.
- **Discovery risk.** `last_conversations.json` is keyed by workspace path. If the schema,
  key normalization, or directory layout changes, discovery silently fails.
- **Concurrency risk.** Each run rewrites `last_conversations.json`, so two concurrent
  runs read each other's ids back. PR #78 serializes all `agy` calls behind a promise
  queue to avoid this — correct, but it removes parallelism.

**Proposed solutions**
- **S1 (short term):** Keep the transcript-recovery path, but treat it as a *fallback*:
  prefer stdout when non-empty (a future `agy` may fix `-p`), and only fall back to the
  transcript when stdout is empty.
- **S1b (the fix we'd rather own — no private formats):** The empty-stdout behaviour looks
  like `agy`'s non-TTY output path. Drive `agy -p` under an allocated **pseudo-terminal** so
  it believes it's interactive and streams to a pipe we capture — recovering the real stdout
  contract without reading any of `agy`'s internal files at all. This is the approach to own
  long-term; the transcript reader is the dependency-free interim while we evaluate the PTY
  cost. *We solve this ourselves by observing `agy`'s actual behaviour — not by importing
  anyone else's wrapper.*
- **S2:** Harden the reader: detect JSONL vs SQLite by what exists on disk and add a
  SQLite reader behind the same interface so a future `agy` update doesn't break us.
- **S3:** Capture the process start time and only accept transcript entries newer than it,
  so we never return a stale answer from a previous run if discovery races.
- **S4 (upstream):** Track [antigravity-cli#7](https://github.com/google-antigravity/antigravity-cli/issues/7)
  (emit/accept a conversation id for headless callers). A caller-supplied
  `--conversation <uuid>` would let us *know the id up front* and read the right transcript
  deterministically instead of guessing via `last_conversations.json`. This is the clean
  fix; everything above is scaffolding until it lands.

### 2. Model selection is gone in print mode

Our current value proposition leans on model choice: `ask-gemini` takes a `model` arg,
defaults to Pro, and `executeGeminiCLI()` implements a **quota fallback from Pro → Flash**
on `RESOURCE_EXHAUSTED` (`src/utils/geminiExecutor.ts`, `src/utils/commandExecutor.ts`).

In `agy`, print mode is hardcoded to Gemini 3.5 Flash (High). `--model` exists for the
interactive TUI but is ignored — worse, passing a non-active model label in `-p` causes
the call to **hang** past 60s (verified on `agy` 1.0.5). So:

- The `model` arg becomes a no-op (or a hazard) on the `agy` backend.
- The Pro→Flash quota fallback is meaningless when Flash is the only option.
- Cost/latency change: reports indicate Gemini 3.5 Flash consumes notably more tokens per
  task than the old Flash, so "Flash is the cheap fast one" no longer holds the same way.

**Proposed solutions**
- **S5:** Make model support a backend capability, not a global assumption. PR #78 already
  adds `supportsModelSelection` to the `Backend` interface (`src/backends/types.ts`) and
  sets it `false` for `agy`. Build on that: when `supportsModelSelection === false`, the
  tool layer should **not** forward `model`, should surface a one-time notice that the
  backend is Flash-only, and should **skip the Pro→Flash fallback entirely** rather than
  letting it look like a silent downgrade.
- **S6:** Never pass `--model` to `agy -p` until upstream fixes the hang. Gate it behind a
  capability + a version check so we can light it up later without a code change.
- **S7:** Document the cost/latency delta in `docs/concepts/models.md` so users aren't
  surprised by token consumption after the switch.

### 3. `@file` — our headline feature — may not survive as-is

The single most-used feature of this tool is `@file` analysis: a user writes
`@src/huge.ts explain this` and the Gemini CLI **inlines the file contents** into the
prompt, leveraging Gemini's large context window. We deliberately keep that behavior and
*guard* it — `assertSafeFileReferences()` rejects `@` references that escape the project
root (CVE-2026-0755). changeMode also rewrites `file:` → `@` to lean on the same mechanism.

`agy` is agent-first: rather than the CLI textually inlining `@path`, the **agent decides**
to read files using its own tools during a multi-step run. That's a different contract:

- The inlining we rely on (and sanitize) may not happen at all, or may happen via a
  different syntax. Our `@`-token rewriting and our security guard both assume the gemini
  inlining model.
- If the agent reads files itself, our path-traversal guard no longer sits in the data
  path — the agent could read outside the project root unless `agy`'s own sandboxing
  prevents it (and see §4: in `-p` it largely doesn't).
- Determinism drops: "inline exactly these files" becomes "the agent will probably read
  these files," which is worse for a programmatic tool that wants reproducible output.

**Proposed solutions**
- **S8:** Treat `@file` handling as backend-specific. For `agy`, **resolve and read the
  referenced files ourselves** (inside the project root, reusing
  `assertSafeFileReferences()`), then construct a prompt that embeds the contents
  explicitly — so we keep both the determinism and the security guard regardless of what
  the agent would do on its own.
- **S9:** Keep `assertSafeFileReferences()` as a hard gate on the *input* prompt on every
  backend, even if the downstream CLI changes how it consumes references. The guard is
  cheap and the exfiltration primitive it blocks is backend-independent.
- **S10:** Add a focused test that an `@file` prompt on the `agy` backend produces output
  that actually reflects the file contents — this is the regression we most need to catch.

### 4. Security posture: sandbox and approval flags are weaker than they look

Today we forward `-s/--sandbox` and (in PR #78) `--approval-mode {default,auto_edit,yolo,plan}`.
On `agy`:

- `--sandbox` exists, but in `-p` the agent **auto-runs filesystem and network operations
  with the user's privileges** regardless. Tool execution is effectively unsandboxed.
- There are no graded approval modes — only `--dangerously-skip-permissions`, which is a
  **no-op in `-p`** because there's no interactive approval gate to skip in the first
  place. The agent already executes tools autonomously.

So a user who passes `sandbox: true` expecting isolation, or who avoids `yolo` expecting a
confirmation gate, gets neither on the `agy` backend. That's a meaningful and surprising
change in safety semantics for anyone scripting this tool.

**Proposed solutions**
- **S11:** Map approval modes per backend (PR #78 already maps only `yolo` →
  `--dangerously-skip-permissions`). Go further: when the requested guarantee can't be
  honored, **say so** — e.g. if `sandbox: true` is requested on `agy`, emit a clear notice
  that print-mode `agy` does not sandbox tool execution, rather than silently pretending.
- **S12:** Consider making `agy`-backed tools **read-only by default** from our side: for
  the analysis use cases this tool is built for (explain/summarize large files), we don't
  need the agent to run tools at all. If `agy` later exposes a "no tools / planner-only"
  print mode, prefer it. Until then, document the exposure loudly.
- **S13:** Keep the `@file` project-root guard (S9) as the one sandbox property we *can*
  still enforce ourselves on the input side.

### 5. Sessions and concurrency

We forward `--session-id`/`--resume` (gemini) which PR #78 maps to
`--conversation`/`--continue` (agy). Two gaps:

- `agy --continue` resumes the **most recent conversation globally**, not per-workspace.
  Concurrent callers in different repos can resume each other's threads.
- There's no way to **capture** an auto-assigned conversation id from a `-p` run
  ([antigravity-cli#7](https://github.com/google-antigravity/antigravity-cli/issues/7)),
  which is also why we fall back to scraping `last_conversations.json`.

**Proposed solutions**
- **S14:** Prefer explicit `--conversation <id>` over `--continue` whenever we have an id;
  avoid relying on global "most recent" semantics.
- **S15:** If upstream adds caller-supplied ids (S4), generate a UUID per logical session
  on our side and pass it in, making both the resume and the transcript-read deterministic.
- **S16:** Until then, keep PR #78's serialized `agy` queue, and document that `agy`-backed
  sessions are best-effort and not safe to run concurrently across workspaces.

### 6. Packaging, auth, and detection

- `agy` is a Go binary installed to `~/.local/bin/` (Unix) or `%LOCALAPPDATA%\Antigravity\`
  (Windows) — not an npm global like `@google/gemini-cli`. Our Windows PATH-resolution
  logic in `commandExecutor.ts` (`resolveCommandForExecution`, the `where`-based shim
  lookup) is gemini-specific and won't find `agy` the same way.
- Auth is via the OS credential store after a one-time `agy -i` login, versus gemini's
  OAuth/API-key flow.
- Our error messaging (`buildEnoentErrorMessage`) hard-codes
  `npm install -g @google/gemini-cli` guidance.

**Proposed solutions**
- **S17:** Generalize executable resolution to also locate `agy` (its known install dirs +
  an `AGY_CLI_PATH`-style override, mirroring `GEMINI_CLI_PATH`).
- **S18:** Make `buildEnoentErrorMessage` backend-aware so an `agy` user gets `agy`-correct
  install/login guidance (including `agy -i`), not a gemini npm command.
- **S19:** Extend the existing **setup doctor** (`scripts/doctor.mjs`) to detect both CLIs,
  report versions, and warn when the active backend's binary is missing or unauthenticated.
  The doctor is the right place to make all of this legible to users.

---

## Migration phases

Status legend: ✅ implemented in this PR · 🔜 follow-up · ⏳ blocked on upstream.

**Phase 0 — Backend seam. ✅**
Pluggable backends under `src/backends/` (`Backend` interface + `getBackend()` +
`runWithBackend()`), selected with `GEMINI_MCP_BACKEND`. Capability flags
(`supportsModelSelection`, `sandboxIsolatesToolExecution`) describe each CLI honestly.
`ask-gemini` and `brainstorm` now run through the seam; the default stays `gemini`.
(Naming mirrors the experimental backend in #78 so the two reconcile mechanically.)

**Phase 1 — Make `agy` honest. ✅**
- Model selection is capability-gated: on `agy` the `model` arg is dropped, the Pro→Flash
  quota fallback is skipped, and a notice explains why (S5/S6). We never pass `--model` to
  `agy -p` (it hangs).
- `@file` is handled per backend: `inlineFileReferences()` reads referenced files
  ourselves for `agy`, keeping determinism **and** the CVE-2026-0755 project-root guard in
  the data path (S8/S9).
- Sandbox is truthful: requesting `sandbox` on `agy` returns a notice that print-mode does
  not isolate tool execution, instead of implying isolation (S11/S12).
- Detection is backend-aware: `AGY_CLI_PATH` override + known-install-dir/`where`
  resolution, and `agy`-correct ENOENT guidance (install + `agy -i`), not the gemini npm
  hint (S17/S18).

**Phase 2 — Harden the recovery path. ✅**
- `agyTranscript.ts` reads JSONL **and** detects/reads the dual-written SQLite `.db` behind
  one `readTranscriptResponse()` interface (S2).
- Discovery is start-time-bounded (`newestConversationSince`) so we never return a stale
  reply, and explicit `--conversation` ids are read back deterministically (S3/S14).

**Phase 3 — Converge on stdout; self-retire the scrape. ✅**
Output recovery is now a capability-aware ladder (`agyCapabilities.ts`, `agyOutput.ts`),
ordered best → last-resort, in `agyBackend.run`:
1. **Clean JSON stdout** — `probeAgyCapabilities()` reads `agy --help` once per process; if
   the build advertises `--output-format json`, we pass it and parse the reply off stdout
   (`parseAgyJsonResponse`). No transcript touched (S4).
2. **Plain stdout** — used whenever non-empty, so the day `agy -p` prints reliably the
   fallback simply stops running.
3. **PTY recovery (opt-in, `AGY_MCP_PTY=1`, POSIX)** — runs `agy` under a pseudo-terminal via
   `script(1)` so a TTY-only build still streams real stdout, with **no** private files read
   (S1b). Best-effort: absent `script`/output, it falls through. Args are POSIX-quoted, so the
   non-PTY path's injection safety is preserved.
4. **Transcript scrape** — the Phase 2 last resort.

Because step 1 is driven by `agy --help`, the backend climbs the ladder on its own as
upstream fixes print-mode — no code change needed. Caller-supplied conversation ids
(antigravity-cli#7) slot into the same probe when they land.

Hardening (post-review):
- **stdin routing** — changeMode/`@file` prompts carry whole inlined files, so they ride on
  stdin exactly like the gemini path (#27/#77) instead of blowing the OS argv limit via `-p`.
- **Error-tolerant ladder** — a non-zero exit from `agy -p` (another known 1.0.x failure
  mode) descends the ladder instead of aborting the run; only ENOENT aborts immediately.
- **Bounded runs** — `executeCommand` now has a 20-minute default timeout, so a hung CLI can
  never wedge the serialized agy queue (or the server) permanently.
- **Symlink guard everywhere** — `assertSafeFileReferences` itself now realpath-checks
  in-root symlinks, closing the CVE-2026-0755 hole on the gemini path too (previously only
  agy's self-inlining had the re-check).

**Phase 4 — Date-aware cutover. ✅**
`resolveDefaultBackend()` in `src/backends/index.ts` returns `gemini` until **2026-06-18** and
`agy` from then on — because once gemini is retired, `agy` is the only live option, so the
default flips automatically (no release required on the day). `GEMINI_MCP_BACKEND` always
overrides. `backendSelection()` surfaces a notice on the post-retirement auto-switch and a
one-time nudge to test `agy` in the final `RETIREMENT.WARN_WITHIN_DAYS` countdown. Standard/
Enterprise/API-key users who retain `gemini` access just set `GEMINI_MCP_BACKEND=gemini`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `GEMINI_MCP_BACKEND` | `gemini` or `agy`/`antigravity`; unset uses the date-aware default (Phase 4) |
| `AGY_CLI_PATH` | Full path to the `agy` binary when it isn't on the server's PATH |
| `AGY_MCP_PTY` | `1` to enable opt-in PTY stdout recovery for `agy -p` (POSIX only, Phase 3) |
| `GEMINI_MCP_TIMEOUT` | Overall CLI run timeout in minutes (default 45); `agy`'s `--print-timeout` derives from it |
| `AGY_PRINT_TIMEOUT` | Override `agy`'s `--print-timeout` directly (Go duration, e.g. `30m`) |

`agy` is **experimental**: print-mode is Gemini 3.5 Flash-only, output is recovered via the
Phase 3 ladder (clean JSON stdout → plain stdout → opt-in PTY → transcript), and tool
execution is not sandboxed in `-p`. The tool surfaces a notice whenever a requested `model`
or `sandbox` can't be honored. When `agy` itself fails (an exhausted quota, a dropped
login), its own error text is surfaced verbatim instead of an empty reply.

## Open questions

1. Does any `agy` version inline `@file`-style references, or must we always read files
   ourselves (S8)? This decides how much of changeMode's `file:`→`@` rewrite we keep.
2. Is there a planner-only / no-tools print mode we can target for safe read-only analysis
   (S12)? That would resolve most of §4 cleanly.
3. What is the real, supported headless output contract once `-p` stdout and
   `--output-format json` are fixed? Phase 3 hinges on it.
4. Will `agy` be open source (gemini-cli is Apache-2.0)? That affects how aggressively we
   can rely on internal file formats vs. wait for a public contract.

## Sources

- [Google Developers Blog — Transitioning Gemini CLI to Antigravity CLI](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)
- [google-gemini/gemini-cli Discussion #27274 — official transition announcement](https://github.com/google-gemini/gemini-cli/discussions/27274)
- [google-antigravity/antigravity-cli Issue #7 — conversation ids for headless callers](https://github.com/google-antigravity/antigravity-cli/issues/7)
- [Antigravity CLI usage docs](https://antigravity.google/docs/cli-using)
- This repo: [PR #78 (v1.2.0)](https://github.com/jamubc/gemini-mcp-tool/pull/78) ·
  [Discussion #90](https://github.com/jamubc/gemini-mcp-tool/discussions/90)
