# Security Report — gemini-mcp-tool

- **Date:** 2026-05-28
- **Repository:** `jamubc/gemini-mcp-tool`
- **Branch reviewed:** `security/cve-2026-0755` (PR #75)
- **Scope:** All hand-written source under `src/`, plus declared npm dependencies.
- **Method:** Manual code review + sink analysis (`child_process` / `fs` / network / `eval`), `npm audit` with runtime-vs-dev tree attribution, and a cross-check of open GitHub issues.

> No security issue was filed today (2026-05-28). The most recent security report is **#73 (CVE-2026-0755)**, which is fixed on this branch (PR #75).

---

## Executive summary

| Area         | Critical | High | Moderate | Low / Info |
|--------------|:--------:|:----:|:--------:|:----------:|
| Code         | 1 (fixed)| 0    | 0        | 4          |
| Dependencies | 0        | 8*   | 15       | 2          |

\* Only **2 of the 8 dependency HIGHs reach the published/runtime tree** (`@modelcontextprotocol/sdk`, and `tmp` via the unused `inquirer` dep). The other 6 HIGHs live exclusively in the docs/build toolchain (`vitepress`, `mermaid`, `archiver`) and are never installed for end users.

---

## Code findings

### C1 — CVE-2026-0755: OS command-injection / `@file` exfiltration — **Critical — FIXED (PR #75)**
`geminiExecutor.ts` wrapped any prompt containing `@` in literal `"` before passing it to `spawn` (`shell: false`), which injected literal quote characters and corrupted `@file` references, while leaving an arbitrary-file-read vector through the Gemini CLI's `@file` parser.

**Fix (this branch):** removed the broken quoting from the primary and fallback paths; added `assertSafeFileReferences()` which rejects `@file` references that resolve outside the project working directory (absolute, `~`, and `../` traversal). The guard runs on the fully-processed prompt, so it also protects the `brainstorm` and `changeMode` code paths.

### C2 — Windows `cmd.exe` variable expansion in prompts — **Low (Windows-only)**
`commandExecutor.ts` uses `shell: true` on Windows and wraps whitespace/quote args in `"..."` (escaping `"`→`""`). `cmd.exe` still expands `%VAR%` **inside** double quotes, so a prompt containing e.g. `%USERNAME%` / `%PATH%` is substituted before reaching `gemini`. This is not a command-execution break-out, but it is a correctness + minor information-substitution issue. Unix is unaffected (`shell: false`).
**Recommendation:** adopt the issue #62 approach — spawn `process.execPath` with the resolved `gemini.js` path and `shell: false` on Windows too — eliminating the shell (and the quoting fragility) entirely.

### C3 — Verbose logging of full tool arguments / prompts — **Low / Informational**
`logger.ts` logs raw args via `JSON.stringify` on every invocation (`Logger.toolInvocation`), and `Logger.debug` is wired to `console.warn`, so prompt bodies are written to stderr **regardless of any debug flag**. Prompts may contain pasted file contents or secrets; on shared hosts or captured MCP logs this is a disclosure risk.
**Recommendation:** gate full-argument logging behind an explicit debug env var; avoid logging full prompt bodies at the default level.

### C4 — Raw `error.message` returned to client — **Informational**
`index.ts` returns `Error executing ${tool}: ${error.message}`. CLI/`fs` errors may embed absolute local paths. Low impact for a local stdio server; noted for completeness.

### C5 — Unbounded lazy regex over model output — **Informational**
`changeModeParser.ts` uses `[\s\S]*?` groups. Input is Gemini's *response* (model-controlled, not direct attacker network input), so ReDoS exposure is low. Acceptable today; revisit if these inputs ever become untrusted.

### Positives observed
- `commandExecutor.ts` uses `spawn` with `shell: false` on Unix and an args array — no shell injection.
- #72 path-traversal hardening on `cacheKey` is solid: format regex (`/^[a-f0-9]{8}$/`) + `path.resolve` containment + removal of the silent `unlink` primitive.
- All tool arguments are validated through `zod` before execution.
- The server is **stdio-only** — there is no network listener by default.

---

## Dependency findings

`npm audit`: **25 vulnerabilities (8 high, 15 moderate, 2 low)**. The published package ships only `dist/`, but its `dependencies` are installed transitively for every end user, so the runtime-vs-dev split below is what actually matters.

### D1 — `@modelcontextprotocol/sdk@0.5.0` — **High — runtime, USED**
- Advisories: ReDoS (high); "DNS-rebinding protection not enabled by default" (high).
- **DNS rebinding does not apply** here: this server uses `StdioServerTransport`, not the Streamable-HTTP transport the advisory concerns.
- ReDoS applies to SDK message handling; with a trusted local stdio client, exposure is limited but real.
- `0.5.0` is far behind the current `1.x` line. **Upgrading is recommended but is a breaking API change** and will require edits to `index.ts`.

### D2 — `inquirer@9.3.7` → `external-editor` → `tmp@0.0.33` — **High path traversal — runtime, UNUSED**
- `inquirer`, `ai`, `chalk`, `d3-shape`, and `prismjs` are declared as runtime `dependencies` but are **not imported anywhere in `src/`**. They are still installed for every user, and `inquirer` drags in the HIGH `tmp` path-traversal advisory.
- **Recommendation (high value, low effort):** remove these unused runtime deps. This eliminates the only runtime-tree HIGH besides the SDK and significantly shrinks install/attack surface. (Note: `package.json` references a `contribute` script at `src/contribute.ts` which does not exist in the tree — confirm nothing relies on these before removal.)

### D3 — Docs/build toolchain HIGHs — **Not shipped, lower priority**
All remaining HIGHs are confined to `devDependencies` and are not installed for end users or used by the running server:
- `archiver` → `glob`, `minimatch`, `lodash`
- `vitepress` → `rollup`, `vite`, `esbuild`, `preact`
- `mermaid` → `dompurify`

Patch opportunistically with `npm audit fix`, but these do not affect deployed MCP servers.

---

## Additional observations (full source-tree read)

These do **not** affect the published npm package or the running MCP server (the docs site is built/deployed separately to GitHub Pages), but are noted for completeness:

- **Docs site loads a third-party ad script.** `docs/.vitepress/theme/components/AdBanner.vue` injects `//cdn.carbonads.com/carbon.js` into the page `<head>`. It is currently an inert placeholder (`serve=YOUR_CARBON_ID`), but any third-party script on the docs origin is a supply-chain/privacy consideration. *(Informational — docs site only.)*
- **`v-html` in `CodeBlock.vue`.** Renders Prism-highlighted output via `v-html`. Input is build-time-authored doc content and Prism escapes HTML, so this is not an exploitable XSS today. *(Informational — docs site only.)*
- **Dead / duplicate files.** `src/utils/timeoutManager.ts` is effectively empty (1 line) and imported nowhere; `src/scripts/deploy-wiki.sh` is a byte-for-byte duplicate of `scripts/deploy-wiki.sh`. Housekeeping, not security — safe to remove.

## Prioritized recommendations

1. **Merge PR #75** — CVE-2026-0755 fix. *(Critical — done, pending merge.)*
2. **Remove unused runtime deps** (`ai`, `chalk`, `d3-shape`, `inquirer`, `prismjs`) — removes the `tmp` HIGH from the shipped tree. *(High, low effort.)*
3. **Plan `@modelcontextprotocol/sdk` 0.5 → 1.x upgrade.** *(High, breaking — needs code changes.)*
4. **Gate verbose prompt/argument logging** behind a debug flag. *(Low.)*
5. **Windows:** drop `shell: true` in favor of the node + `gemini.js` approach (issue #62) to remove `%VAR%` expansion and quoting fragility. *(Low.)*
6. **`npm audit fix`** for the docs/build toolchain. *(Low.)*
