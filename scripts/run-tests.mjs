#!/usr/bin/env node
// Category-aware test runner. Discovers *.test.ts under the selected category
// folders (test/unit, test/integration, test/e2e, test/judge) and runs them with the
// built-in node:test runner via the tsx loader, so the TypeScript sources run
// directly.
//
// Usage:
//   node scripts/run-tests.mjs                  # default: unit + integration (hermetic)
//   node scripts/run-tests.mjs unit             # one category
//   node scripts/run-tests.mjs integration e2e  # several
//   node scripts/run-tests.mjs judge            # semantic LLM judge tests
//   node scripts/run-tests.mjs all              # unit + integration + e2e + judge
//
// Categories:
//   unit         pure, single-module tests. No subprocess, no network, no real CLI.
//   integration  several real modules wired together. Still hermetic — never the real gemini CLI.
//   e2e          the real gemini CLI driven through the real MCP server over stdio. Opt-in (live).
//   judge        live Gemini CLI output evaluated by a second LLM judge. Opt-in (live).
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(scriptDir, "..", "test");

const KNOWN = ["unit", "integration", "e2e", "judge"];
const DEFAULT = ["unit", "integration"]; // the hermetic suite `npm test` runs and CI gates on

function resolveCategories(argv) {
  const args = argv.slice(2).map((a) => a.toLowerCase());
  if (args.length === 0) return DEFAULT;
  if (args.includes("all")) return KNOWN;
  const unknown = args.filter((a) => !KNOWN.includes(a));
  if (unknown.length > 0) {
    console.error(`Unknown test category: ${unknown.join(", ")}`);
    console.error(`Valid categories: ${KNOWN.join(", ")}, all`);
    process.exit(2);
  }
  // De-dupe while preserving the documented order.
  return KNOWN.filter((c) => args.includes(c));
}

function findTests(dir) {
  const found = [];
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...findTests(full));
    else if (entry.endsWith(".test.ts")) found.push(full);
  }
  return found;
}

const categories = resolveCategories(process.argv);
const tests = categories.flatMap((c) => findTests(path.join(testDir, c)));

if (tests.length === 0) {
  console.log(`No test files found for: ${categories.join(", ")}`);
  process.exit(0);
}

console.log(`Running ${tests.length} test file(s) [${categories.join(", ")}]`);

// tsx requires Node >= 18.19 which always supports --import.
// The older --loader flag is deprecated and breaks on CI (Node 18.19+/20/22).
const loaderArgs = ["--import", "tsx"];

// Mute routine [GMCPT] logging for the hermetic categories so the reporter
// output stays readable. The e2e suite keeps full server logs (its child
// server process inherits this env), which is useful for debugging live calls.
const env = { ...process.env };
if (!categories.includes("e2e")) env.NODE_ENV = "test";

// Run test files serially (--test-concurrency=1). The changeMode chunk cache is
// a single shared on-disk dir (os.tmpdir()/gemini-mcp-chunks); files that touch
// it (chunkCache, changeMode-pipeline) would otherwise race across parallel
// worker processes. Serial e2e also avoids hitting the gemini quota in parallel.
// The hermetic suite is tiny, so the cost is negligible. (Flag available on the
// Node 18.19+/20.10+/22 versions CI runs.)
const result = spawnSync(
  process.execPath,
  [...loaderArgs, "--test", "--test-concurrency=1", ...tests],
  { stdio: "inherit", env },
);
process.exit(result.status ?? 1);
