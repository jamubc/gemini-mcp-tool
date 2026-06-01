#!/usr/bin/env node
// gemini-mcp-tool doctor — INTERNAL dev / diagnostic + test tool.
//
// Not published: deliberately excluded from package.json "bin" and "files", so
// it ships with the repo but NOT the npm package. Run it from a checkout:
//
//   npm run doctor        → report the live system state for the MCP server
//   npm run doctor test    → preflight + run the e2e suite (the automated MCP
//                            test that replaces manual mcpjam clicking)
//
// This is the 1.1.7 seed: it reports what 1.1.7 actually has (node, the gemini
// CLI, GEMINI_CLI_PATH) and runs the test suite. Later feature PRs grow it with
// backend / model / approval / timeout diagnostics.
// Self-contained: pure Node, no build step or dependencies.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ENV = {
  GEMINI_CLI_PATH: "GEMINI_CLI_PATH", // explicit path to the gemini executable
};

const isWindows = process.platform === "win32";
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const c = {
  bold: (s) => paint("1", s),
  dim: (s) => paint("2", s),
  green: (s) => paint("32", s),
  yellow: (s) => paint("33", s),
  red: (s) => paint("31", s),
  cyan: (s) => paint("36", s),
};
const OK = c.green("✓");
const WARN = c.yellow("⚠");
const BAD = c.red("✗");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function heading(title) {
  console.log("\n" + c.bold(title));
  console.log(c.dim("─".repeat(Math.max(title.length, 16))));
}

function runCmd(cmd, args) {
  try {
    const executable = isWindows && /\s/.test(cmd) ? `"${cmd.replace(/"/g, '""')}"` : cmd;
    const r = spawnSync(executable, args, { encoding: "utf8", timeout: 20000, shell: isWindows, windowsHide: true });
    if (r.error) return { ok: false, err: r.error.message };
    return { ok: r.status === 0, status: r.status, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
  } catch (e) {
    return { ok: false, err: e instanceof Error ? e.message : String(e) };
  }
}

function locate(cmd) {
  const r = runCmd(isWindows ? "where" : "which", [cmd]);
  if (!r.ok || !r.out) return [];
  return r.out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

// Mirror commandExecutor's resolution: honour GEMINI_CLI_PATH, else PATH.
function detectGemini() {
  const override = (process.env[ENV.GEMINI_CLI_PATH] || "").trim();
  const pathCandidates = locate("gemini");
  const candidates = override ? [override, ...pathCandidates.filter((p) => p !== override)] : pathCandidates;
  let primary = override || null;
  if (!primary && candidates.length > 0) {
    if (isWindows) {
      const byExt = (ext) => candidates.find((c) => c.toLowerCase().endsWith(ext));
      primary = byExt(".cmd") || byExt(".exe") || byExt(".bat") || candidates[0];
    } else {
      primary = candidates[0];
    }
  }
  const found = override ? existsSync(override) : candidates.length > 0;
  let version = null;
  if (found && primary) {
    const v = runCmd(primary, ["--version"]);
    if (v.ok && v.out) version = v.out.split(/\r?\n/)[0].trim();
  }
  return { found: !!found, primary, candidates, override: override || null, version };
}

// ── report ───────────────────────────────────────────────────────────────────
function runReport() {
  const problems = [];

  heading("System");
  console.log(`  node      ${process.version}`);
  console.log(`  platform  ${process.platform} (${process.arch})`);

  heading("Gemini CLI");
  const gemini = detectGemini();
  if (gemini.found) {
    console.log(`  ${OK} found${gemini.override ? " (via " + ENV.GEMINI_CLI_PATH + ")" : ""}`);
    console.log(`     path     ${gemini.primary}`);
    console.log(`     version  ${gemini.version ? c.cyan(gemini.version) : c.yellow("(could not read --version)")}`);
    if (gemini.candidates.length > 1) console.log(c.dim(`     also on PATH: ${gemini.candidates.slice(1).join(", ")}`));
  } else {
    console.log(`  ${BAD} ${gemini.override ? ENV.GEMINI_CLI_PATH + " path not found" : "not found on PATH"}`);
    problems.push(
      gemini.override
        ? `${ENV.GEMINI_CLI_PATH} is set to ${gemini.override}, but that path does not exist.`
        : `Gemini CLI not found. Install it (npm i -g @google/gemini-cli) or set ${ENV.GEMINI_CLI_PATH} to its full path.`
    );
  }

  heading("Summary");
  if (problems.length === 0) {
    console.log(`  ${OK} ${c.green("No problems detected.")}`);
  } else {
    console.log(`  ${BAD} ${c.red(`${problems.length} issue(s) found:`)}`);
    for (const p of problems) console.log(`     - ${p}`);
  }
  console.log(c.dim(`\n  Tips:`));
  console.log(c.dim(`    \`npm run doctor test\`    → build + run live e2e tests`));
  console.log(c.dim(`    \`npm run doctor judge\`   → build + run semantic LLM judge tests`));
  console.log("");
  process.exit(problems.length === 0 ? 0 : 1);
}

// ── test (automated MCP test, replaces manual mcpjam) ──────────────────────────
function runTest() {
  heading("Preflight");
  const gemini = detectGemini();
  if (gemini.found) {
    console.log(`  ${OK} gemini ${gemini.version ? c.cyan(gemini.version) : ""} ${c.dim("(" + gemini.primary + ")")}`);
  } else {
    console.log(`  ${WARN} gemini not on PATH — live model tests will skip; only the gemini-independent server tests run.`);
  }

  heading("Build");
  const build = spawnSync(isWindows ? "npm.cmd" : "npm", ["run", "build"], {
    stdio: "inherit",
    cwd: repoRoot,
    shell: isWindows,
  });
  if (build.status !== 0) {
    console.log(`  ${BAD} ${c.red("build failed — aborting.")}`);
    process.exit(build.status ?? 1);
  }
  console.log(`  ${OK} build succeeded`);

  heading("E2E suite (real gemini through the MCP server)");
  const runner = path.join(repoRoot, "scripts", "run-tests.mjs");
  const e2e = spawnSync(process.execPath, [runner, "e2e"], { stdio: "inherit", cwd: repoRoot });
  if (e2e.status === 0) {
    console.log(`\n  ${OK} ${c.green("e2e suite passed — the MCP server works end-to-end.")}`);
  } else {
    console.log(`\n  ${BAD} ${c.red("e2e suite failed.")}`);
  }
  process.exit(e2e.status ?? 1);
}

// ── judge (semantic evaluation) ────────────────────────────────────────────────
function runJudgeTest() {
  heading("Judge Preflight");
  const config = detectJudgeKeys();
  if (config.hasKey) {
    console.log(`  ${OK} LLM Judge configured via: ${config.keyType}`);
  } else {
    console.log(`  ${BAD} No LLM Judge keys found. Please set DEEPSEEK_API_KEY or OPENROUTER_API_KEY in your test/.env file.`);
    process.exit(1);
  }

  heading("Build");
  const build = spawnSync(isWindows ? "npm.cmd" : "npm", ["run", "build"], {
    stdio: "inherit",
    cwd: repoRoot,
    shell: isWindows,
  });
  if (build.status !== 0) {
    console.log(`  ${BAD} ${c.red("build failed — aborting.")}`);
    process.exit(build.status ?? 1);
  }
  console.log(`  ${OK} build succeeded`);

  heading("LLM-as-a-Judge semantic test suite");
  const runner = path.join(repoRoot, "scripts", "run-tests.mjs");
  const judgeRun = spawnSync(process.execPath, [runner, "judge"], { stdio: "inherit", cwd: repoRoot });
  if (judgeRun.status === 0) {
    console.log(`\n  ${OK} ${c.green("Judge suite passed — semantic checks successful!")}`);
  } else {
    console.log(`\n  ${BAD} ${c.red("Judge suite failed.")}`);
  }
  process.exit(judgeRun.status ?? 1);
}

function detectJudgeKeys() {
  let hasKey = false;
  let keyType = "";
  const envPath = path.join(repoRoot, "test", ".env");
  
  if (process.env.DEEPSEEK_API_KEY) {
    hasKey = true;
    keyType = "process.env.DEEPSEEK_API_KEY";
  } else if (process.env.OPENROUTER_API_KEY) {
    hasKey = true;
    keyType = "process.env.OPENROUTER_API_KEY";
  }

  if (!hasKey && existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, "utf-8");
      if (/DEEPSEEK_API_KEY\s*=\s*[^\s#]+/i.test(content)) {
        hasKey = true;
        keyType = "test/.env (DEEPSEEK_API_KEY)";
      } else if (/OPENROUTER_API_KEY\s*=\s*[^\s#]+/i.test(content)) {
        hasKey = true;
        keyType = "test/.env (OPENROUTER_API_KEY)";
      }
    } catch {}
  }
  return { hasKey, keyType };
}

// ── dispatch ───────────────────────────────────────────────────────────────────
const mode = (process.argv[2] || "").toLowerCase();
if (mode === "test") runTest();
else if (mode === "judge") runJudgeTest();
else runReport();
