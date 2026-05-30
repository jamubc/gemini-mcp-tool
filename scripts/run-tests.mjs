#!/usr/bin/env node
// Discover and run every *.test.ts under src/ with the built-in node:test
// runner, using the tsx loader so the TypeScript sources run directly.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(scriptDir, "..", "src");

function findTests(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...findTests(full));
    else if (entry.endsWith(".test.ts")) found.push(full);
  }
  return found;
}

const tests = findTests(srcDir);
if (tests.length === 0) {
  console.log("No test files found.");
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...tests],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
