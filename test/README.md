# Tests

The suite is split into three categories by **how much of the real world they touch**. Each lives in its own folder and runs with the built-in [`node:test`](https://nodejs.org/api/test.html) runner via the `tsx` loader (no extra test framework).

| Category | Folder | Touches the real gemini CLI? | Runs in CI? | Command |
|---|---|---|---|---|
| **unit** | `test/unit/` | No | Yes (gates merges) | `npm run test:unit` |
| **integration** | `test/integration/` | No | Yes (gates merges) | `npm run test:integration` |
| **e2e** | `test/e2e/` | **Yes — the real CLI** | No (opt-in, local) | `npm run test:e2e` |

```bash
npm test              # unit + integration (the hermetic, CI-gating suite)
npm run test:unit
npm run test:integration
npm run test:e2e      # builds, then drives the REAL gemini CLI through the MCP server
node scripts/run-tests.mjs all   # everything (unit + integration + e2e)
```

## What goes where

### `unit/` — pure, single-module
Fast, deterministic tests of one module's logic. **No subprocess, no network, no real CLI.**
Mirrors `src/` (`test/unit/utils/...`, `test/unit/backends/...`, `test/unit/tools/...`).
Examples: argument builders, model/approval/timeout resolution, the changeMode
parser/chunker/translator, the chunk cache, the registry's schema/prompt helpers,
brainstorm prompt construction.

### `integration/` — several real modules wired together
Still **hermetic** — it never invokes the real gemini CLI. The "Gemini output" is a
fixture string fed into the real downstream pipeline. Covers the cross-module flows a
user actually hits:
- the full **changeMode pipeline**: response string → parse → validate → chunk → cache →
  `fetch-chunk` retrieval of later chunks;
- the **registry → tool contract**: argument validation surfaced as friendly errors, and
  every tool guard/error branch that resolves *without* calling Gemini.

> Integration tests must **not** spawn the gemini CLI. Anything that needs a real model
> response belongs in `e2e/`.

### `e2e/` — the real product, end to end
Spawns the **built MCP server** (`dist/index.js`) over stdio and connects with the MCP
SDK client — exactly how Claude / mcpjam do. Tool calls exercise the whole path:
protocol → registry → tool → backend → spawned **gemini** CLI. This is the automated
replacement for manual mcpjam testing.

- Gemini-dependent tests **auto-skip** when the `gemini` CLI is not on `PATH`, so the
  suite degrades gracefully. The non-gemini tools (`ping`, `timeout-test`, `fetch-chunk`,
  `tools/list`, `prompts/list`) always run.
- `npm run test:e2e` builds first, so it tests exactly what ships.
- Live model calls are slow and use your gemini quota; the model is pinned to
  `gemini-2.5-flash` and each test has a generous timeout.
- Every E2E MCP response is printed as a `node:test` diagnostic by default, so
  passing results still show the exact raw response that each assertion checked.
- Shared setup (spawning/closing the server, `gemini` detection, reading tool text) lives
  in `test/e2e/harness.ts`.

## Adding a test

1. Pick the category by the table above. If it needs a real model answer, it's `e2e`.
2. Create `test/<category>/<area>.test.ts` (e2e files are named `*.e2e.test.ts`).
3. Use `node:test` + `node:assert/strict`:

   ```ts
   import { test } from "node:test";
   import assert from "node:assert/strict";
   import { thing } from "../../../src/utils/thing.js"; // unit: 3 levels up to src/

   test("does the thing", () => {
     assert.equal(thing(1), 2);
   });
   ```

   For e2e, drive the server via the harness:

   ```ts
   import { startServer, textOf, GEMINI_SKIP } from "./harness.js";
   // ...callTool, then assert on textOf(result)
   ```

4. Keep `unit`/`integration` hermetic. Run `npm test` (and `npm run lint` to type-check).

## Notes
- `npm test` sets `NODE_ENV=test`, which mutes routine `[GMCPT]` logging (errors still
  print) so the reporter output stays readable. The e2e run keeps full server logs.
- `npm run lint` type-checks `src/` **and** `test/` via `tsconfig.test.json`.
