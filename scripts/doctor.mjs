#!/usr/bin/env node
// gemini-mcp-tool setup doctor — INTERNAL development / diagnostic tool.
//
// Not published: deliberately excluded from package.json "bin" and "files", so
// it ships with the repo but NOT the npm package. Run it from a checkout with
// `npm run doctor` (or `node scripts/doctor.mjs`). May be released publicly later.
//
//   npm run doctor          → report the live system state for the MCP server
//   npm run doctor setup     → interactive wizard to change configuration
//
// Reports which CLI backend is active, whether the gemini / agy executables are
// installed (path + version), the effective model / approval / timeout config,
// and where each setting comes from: a GLOBAL value (shell export or the loaded
// .env — affects every client, shown in gold) vs a PER-CLIENT value set in a
// client's MCP config (e.g. Claude Code). The `setup` wizard walks each option
// and writes your choices to the .env file and/or a Claude Code server.
//
// Self-contained: pure Node, no build step or dependencies. The constant names
// below mirror src/constants.ts — keep them in sync.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, copyFileSync, renameSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";

const ENV = {
  BACKEND: "GEMINI_MCP_BACKEND",
  MODEL: "GEMINI_MODEL",
  FLASH_MODEL: "GEMINI_FLASH_MODEL",
  APPROVAL_MODE: "GEMINI_MCP_APPROVAL_MODE",
  TIMEOUT_MS: "GEMINI_MCP_TIMEOUT_MS",
  GEMINI_CLI_PATH: "GEMINI_CLI_PATH",
};
const KEYS = Object.values(ENV);
const DEFAULT_FLASH_MODEL = "gemini-2.5-flash";
const APPROVAL_MODES = ["default", "auto_edit", "yolo", "plan"];
const GEMINI_MODELS = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3-pro-preview"];
const FLASH_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

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
  gold: (s) => paint("1;33", s), // bold yellow ≈ gold: marks GLOBAL settings
};
const OK = c.green("✓");
const WARN = c.yellow("⚠");
const BAD = c.red("✗");

const problems = [];
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── .env (global per-install config) ───────────────────────────────────────--
function parseEnv(content) {
  const out = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let key = line.slice(0, eq).trim();
    if (key.startsWith("export ")) key = key.slice(7).trim();
    let val = line.slice(eq + 1).trim();
    if (val.length >= 2 && ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}
const envFilePath = path.join(repoRoot, ".env");
function readRepoEnv() {
  if (!existsSync(envFilePath)) return {};
  try {
    return parseEnv(readFileSync(envFilePath, "utf8"));
  } catch {
    return {};
  }
}
function writeRepoEnv(map) {
  const header = [
    "# gemini-mcp-tool configuration — written by `npm run doctor setup`.",
    "# Loaded by the server at startup as GLOBAL defaults for this install.",
    "# A shell export or an MCP client's own env block overrides anything here.",
    "",
  ];
  const lines = [];
  for (const key of KEYS) {
    const v = map[key];
    if (v === undefined || v === "") continue;
    const needsQuote = /\s/.test(v) || v === "";
    lines.push(`${key}=${needsQuote ? JSON.stringify(v) : v}`);
  }
  const content = header.join("\n") + lines.join("\n") + "\n";
  const tmp = `${envFilePath}.tmp-${process.pid}`;
  writeFileSync(tmp, content, "utf8");
  renameSync(tmp, envFilePath);
}

// Capture the shell environment BEFORE loading .env, so we can tell a true
// global export apart from a value that merely came from the .env file.
const shellSnapshot = {};
for (const key of KEYS) shellSnapshot[key] = process.env[key];

// Reflect server behaviour: load recognised keys from .env without overriding
// anything already exported in the shell.
const repoEnv = readRepoEnv();
for (const key of KEYS) {
  if ((repoEnv[key] ?? "") !== "" && (process.env[key] ?? "") === "") process.env[key] = repoEnv[key];
}

// ── Claude Code config (per-client) ──────────────────────────────────────────
const claudeConfigPath = path.join(os.homedir(), ".claude.json");
function readClaudeConfig() {
  if (!existsSync(claudeConfigPath)) return null;
  try {
    return JSON.parse(readFileSync(claudeConfigPath, "utf8"));
  } catch (e) {
    return null;
  }
}
function looksLikeGemini(name, cfg) {
  const blob = JSON.stringify(cfg || {});
  return /gemini/i.test(name) || /gemini-mcp-tool|dist\/index\.js/.test(blob);
}
// Enumerate gemini MCP servers across user + project scopes (no health checks).
function findGeminiServers(json) {
  const servers = [];
  if (json?.mcpServers) {
    for (const [name, cfg] of Object.entries(json.mcpServers)) {
      if (looksLikeGemini(name, cfg)) servers.push({ scope: "user", project: null, name, cfg });
    }
  }
  if (json?.projects) {
    for (const [project, pcfg] of Object.entries(json.projects)) {
      const ms = pcfg?.mcpServers;
      if (!ms) continue;
      for (const [name, cfg] of Object.entries(ms)) {
        if (looksLikeGemini(name, cfg)) servers.push({ scope: "local", project, name, cfg });
      }
    }
  }
  return servers;
}

// ── shell helpers (CLI detection) ──────────────────────────────────────────--
function runCmd(cmd, args) {
  try {
    const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 20000, shell: isWindows, windowsHide: true });
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
function detectCli(cmd, { honourEnvPath = false } = {}) {
  const override = honourEnvPath ? (process.env[ENV.GEMINI_CLI_PATH] || "").trim() : "";
  let candidates = locate(cmd);
  if (override) candidates = [override, ...candidates.filter((p) => p !== override)];
  const primary = override || candidates[0] || null;
  const found = candidates.length > 0 || (override && existsSync(override));
  let version = null;
  if (found) {
    const v = runCmd(cmd, ["--version"]);
    if (v.ok && v.out) version = v.out.split(/\r?\n/)[0].trim();
  }
  const ext = primary ? path.extname(primary).toLowerCase() : "";
  return { found: !!found, primary, candidates, override: override || null, version, ext };
}

function humanizeMs(ms) {
  if (ms === 0) return "disabled (waits forever)";
  if (ms % 60000 === 0) return `${ms / 60000} min`;
  if (ms % 1000 === 0) return `${ms / 1000} s`;
  return `${ms} ms`;
}
function heading(title) {
  console.log("\n" + c.bold(title));
  console.log(c.dim("─".repeat(Math.max(title.length, 16))));
}
// Where a globally-effective value came from (shell export vs .env), or null.
function globalSourceLabel(key) {
  if ((shellSnapshot[key] ?? "") !== "") return c.gold("(set globally)");
  if ((repoEnv[key] ?? "") !== "") return c.gold("(from .env)");
  return null;
}

function resolveBackend(val) {
  const b = (val || "gemini").trim().toLowerCase();
  return b === "agy" || b === "antigravity" ? "agy" : "gemini";
}

// Robust line reader. readline's rl.question can drop buffered lines and stall
// when stdin is a pipe (not a TTY); this queues 'line' events so prompts work
// for both interactive use and scripted/piped input. EOF yields null.
function createLineReader() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const buffered = [];
  const waiters = [];
  let closed = false;
  rl.on("line", (line) => {
    if (waiters.length) waiters.shift()(line);
    else buffered.push(line);
  });
  rl.on("close", () => {
    closed = true;
    while (waiters.length) waiters.shift()(null);
  });
  return {
    next() {
      if (buffered.length) return Promise.resolve(buffered.shift());
      if (closed) return Promise.resolve(null);
      return new Promise((resolve) => waiters.push(resolve));
    },
    close() {
      rl.close();
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────────────────────────────────────
function runReport() {
  heading("System");
  console.log(`  node      ${process.version}`);
  console.log(`  platform  ${process.platform} (${process.arch})`);

  const backend = resolveBackend(process.env[ENV.BACKEND]);
  heading("Active backend");
  const bSrc = globalSourceLabel(ENV.BACKEND);
  console.log(`  ${ENV.BACKEND} = ${process.env[ENV.BACKEND] ? c.cyan(process.env[ENV.BACKEND]) : c.dim("(unset → gemini)")}${bSrc ? "  " + bSrc : ""}`);
  console.log(`  → using: ${c.bold(backend)}${backend === "agy" ? c.yellow("  (experimental)") : ""}`);

  heading("Gemini CLI");
  const gemini = detectCli("gemini", { honourEnvPath: true });
  if (gemini.found) {
    console.log(`  ${OK} found${gemini.override ? " (via " + ENV.GEMINI_CLI_PATH + ")" : ""}`);
    console.log(`     path     ${gemini.primary}${gemini.ext ? c.dim("  [" + gemini.ext + "]") : ""}`);
    console.log(`     version  ${gemini.version ? c.cyan(gemini.version) : c.yellow("(could not read --version)")}`);
    if (gemini.candidates.length > 1) console.log(c.dim(`     also on PATH: ${gemini.candidates.slice(1).join(", ")}`));
  } else {
    console.log(`  ${BAD} not found on PATH`);
    if (backend === "gemini") problems.push(`Gemini CLI not found. Install it (npm i -g @google/gemini-cli) or set ${ENV.GEMINI_CLI_PATH} to its full path.`);
  }

  heading("Antigravity CLI (agy)");
  const agy = detectCli("agy");
  const agyDataDir = path.join(os.homedir(), ".gemini", "antigravity-cli");
  if (agy.found) {
    console.log(`  ${OK} found`);
    console.log(`     path     ${agy.primary}`);
    console.log(`     version  ${agy.version ? c.cyan(agy.version) : c.yellow("(could not read --version)")}`);
    console.log(`     data dir ${existsSync(agyDataDir) ? OK + " " + agyDataDir : WARN + " missing (run `agy -i` once to authenticate)"}`);
  } else {
    console.log(`  ${c.dim("not installed")} ${c.dim("— optional; the future backend once Gemini CLI retires 2026-06-18")}`);
    if (backend === "agy") problems.push("GEMINI_MCP_BACKEND=agy but the agy executable was not found on PATH.");
  }

  heading("Model configuration");
  const defaultModel = (process.env[ENV.MODEL] || "").trim();
  const flashModel = (process.env[ENV.FLASH_MODEL] || "").trim() || DEFAULT_FLASH_MODEL;
  const mSrc = globalSourceLabel(ENV.MODEL);
  const fSrc = globalSourceLabel(ENV.FLASH_MODEL);
  console.log(`  default model   ${defaultModel ? c.cyan(defaultModel) + (mSrc ? "  " + mSrc : "") : c.dim("(Gemini CLI's own default; pass model: or set GEMINI_MODEL)")}`);
  console.log(`  flash fallback  ${c.cyan(flashModel)}${fSrc ? "  " + fSrc : c.dim("  (default)")}`);
  if (backend === "agy") console.log(`  ${WARN} agy print-mode ignores model selection (hardcoded to Gemini 3.5 Flash)`);

  heading("Behaviour");
  const approval = (process.env[ENV.APPROVAL_MODE] || "").trim();
  const aSrc = globalSourceLabel(ENV.APPROVAL_MODE);
  if (!approval) {
    console.log(`  approval mode   ${c.dim("(unset → no flag; plain Q&A)")}`);
  } else if (APPROVAL_MODES.includes(approval)) {
    console.log(`  approval mode   ${c.cyan(approval)}${aSrc ? "  " + aSrc : ""}`);
    if (approval === "plan") console.log(`  ${WARN} 'plan' makes Gemini an autonomous planner in headless mode — not ideal for plain Q&A`);
  } else {
    console.log(`  approval mode   ${c.yellow(approval)} ${WARN} not one of ${APPROVAL_MODES.join("/")} — will be ignored`);
  }
  const rawTimeout = (process.env[ENV.TIMEOUT_MS] || "").trim();
  let timeoutMs = 0; // disabled by default (1.1.6 parity: waits forever)
  if (rawTimeout) {
    const n = Number(rawTimeout);
    timeoutMs = Number.isFinite(n) && n > 0 ? n : 0;
  }
  const tSrc = globalSourceLabel(ENV.TIMEOUT_MS);
  console.log(`  timeout         ${c.cyan(humanizeMs(timeoutMs))}${rawTimeout ? (tSrc ? "  " + tSrc : "") : c.dim("  (default: disabled)")}`);

  // ── Configuration sources: global vs per-client ──────────────────────────
  heading("Configuration sources");
  const json = readClaudeConfig();
  const servers = json ? findGeminiServers(json) : [];
  for (const key of KEYS) {
    const shellVal = shellSnapshot[key];
    const fileVal = repoEnv[key];
    let line;
    if ((shellVal ?? "") !== "") line = `${c.gold("●")} ${key} = ${c.cyan(shellVal)}  ${c.gold("(set globally)")}`;
    else if ((fileVal ?? "") !== "") line = `${c.gold("●")} ${key} = ${c.cyan(fileVal)}  ${c.gold("(global, from .env)")}`;
    else line = `${c.dim("○")} ${key} = ${c.dim("(not set globally)")}`;
    console.log("  " + line);
    // Per-client values from Claude Code servers.
    for (const s of servers) {
      const v = s.cfg?.env?.[key];
      if (v === undefined || v === "") continue;
      const loc = s.scope === "user" ? "user" : `local:${path.basename(s.project || "")}`;
      console.log(`      ${c.dim("└ per-client")} ${s.name} ${c.dim("[" + loc + "]")} = ${c.cyan(v)}`);
    }
  }
  console.log(c.dim(`\n  ${c.gold("gold")} = global (this shell's env / the loaded .env) — affects every client.`));
  console.log(c.dim(`  per-client = set in a client's MCP config; that client uses its own value.`));
  console.log(c.dim(`  .env: ${existsSync(envFilePath) ? envFilePath : "(none — run `npm run doctor setup` to create one)"}`));
  if (json === null) console.log(c.dim(`  Claude Code config not read (${claudeConfigPath} missing or unparseable).`));

  heading("Summary");
  if (problems.length === 0) {
    console.log(`  ${OK} ${c.green("No problems detected.")} Active backend '${backend}' looks ready.`);
  } else {
    console.log(`  ${BAD} ${c.red(`${problems.length} issue(s) found:`)}`);
    for (const p of problems) console.log(`     - ${p}`);
  }
  console.log(c.dim(`\n  Tip: run \`npm run doctor setup\` to change configuration.`));
  console.log("");
  process.exit(problems.length === 0 ? 0 : 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP WIZARD
// ─────────────────────────────────────────────────────────────────────────────
async function runSetup() {
  const reader = createLineReader();
  const prompt = async (str) => {
    process.stdout.write(str);
    const line = await reader.next();
    return line === null ? "" : line.trim();
  };
  const ask = async (q, def) => {
    const v = await prompt(`  ${q}${def ? ` [${def}]` : ""}: `);
    return v || def || "";
  };
  const confirm = async (q, def = false) => {
    const a = (await prompt(`  ${q} ${def ? "[Y/n]" : "[y/N]"}: `)).toLowerCase();
    if (a === "") return def;
    return a === "y" || a === "yes";
  };

  // Present a menu. Returns { action: "set"|"unset"|"skip", value? }.
  async function selectOption({ title, currentDisplay, recommendedDisplay, choices, allowCustom, customLabel, customPrompt, allowUnset, unsetLabel }) {
    console.log("\n" + c.bold(title));
    console.log("  " + c.dim(`current: ${currentDisplay}   ·   recommended: ${recommendedDisplay}`));
    choices.forEach((ch, i) => console.log(`    ${i + 1}) ${ch.label}`));
    if (allowCustom) console.log(`    c) ${customLabel || "enter a custom value"}`);
    if (allowUnset) console.log(`    u) ${unsetLabel || "unset"}`);
    console.log(`    s) skip — keep current`);
    const ans = (await prompt(`  choose [s]: `)).toLowerCase();
    if (ans === "" || ans === "s") return { action: "skip" };
    if (ans === "u" && allowUnset) return { action: "unset" };
    if (ans === "c" && allowCustom) {
      const v = (await ask(customPrompt || "value")).trim();
      return v ? { action: "set", value: v } : { action: "skip" };
    }
    const idx = Number(ans) - 1;
    if (Number.isInteger(idx) && choices[idx]) return { action: "set", value: choices[idx].value };
    console.log(c.yellow("    unrecognised — skipping"));
    return { action: "skip" };
  }

  console.log(c.bold("\ngemini-mcp-tool · setup"));
  console.log(c.dim("Walk each setting: pick a value, enter a custom one, unset it, or skip to keep current."));
  console.log(c.dim("Nothing is written until you confirm at the end.\n"));

  const effective = (key) => (process.env[key] || "").trim();
  const changes = {}; // key -> { action, value? }

  // 1) Backend
  {
    const cur = resolveBackend(process.env[ENV.BACKEND]);
    const r = await selectOption({
      title: "Backend",
      currentDisplay: cur,
      recommendedDisplay: "gemini",
      choices: [
        { label: "gemini — the Gemini CLI (default)", value: "gemini" },
        { label: "agy — Antigravity CLI (experimental)", value: "agy" },
      ],
    });
    if (r.action !== "skip") changes[ENV.BACKEND] = r;
  }
  const effBackend = resolveBackend(changes[ENV.BACKEND]?.value ?? process.env[ENV.BACKEND]);

  // 2) Default model (skipped for agy — print-mode is Flash-only)
  if (effBackend === "agy") {
    console.log("\n" + c.bold("Default model"));
    console.log(`  ${WARN} ${c.dim("agy print-mode ignores model selection (Flash-only) — skipping.")}`);
  } else {
    const cur = effective(ENV.MODEL) || "(unset → Gemini CLI default)";
    const r = await selectOption({
      title: "Default model",
      currentDisplay: cur,
      recommendedDisplay: "(unset → Gemini CLI default)",
      choices: GEMINI_MODELS.map((m) => ({ label: m, value: m })),
      allowCustom: true,
      customLabel: "enter a custom model id",
      customPrompt: "model id",
      allowUnset: true,
      unsetLabel: "unset — let the Gemini CLI choose",
    });
    if (r.action !== "skip") changes[ENV.MODEL] = r;
  }

  // 3) Flash fallback model
  {
    const cur = effective(ENV.FLASH_MODEL) || `${DEFAULT_FLASH_MODEL} (default)`;
    const r = await selectOption({
      title: "Flash fallback model (used on quota fallback)",
      currentDisplay: cur,
      recommendedDisplay: DEFAULT_FLASH_MODEL,
      choices: FLASH_MODELS.map((m) => ({ label: m, value: m })),
      allowCustom: true,
      customLabel: "enter a custom model id",
      customPrompt: "model id",
      allowUnset: true,
      unsetLabel: `unset — use default (${DEFAULT_FLASH_MODEL})`,
    });
    if (r.action !== "skip") changes[ENV.FLASH_MODEL] = r;
  }

  // 4) Approval mode
  {
    const cur = effective(ENV.APPROVAL_MODE) || "(unset → no flag; plain Q&A)";
    const r = await selectOption({
      title: "Approval mode",
      currentDisplay: cur,
      recommendedDisplay: "(unset)",
      choices: APPROVAL_MODES.map((m) => ({ label: m + (m === "plan" ? "  — autonomous planner (not for plain Q&A)" : ""), value: m })),
      allowUnset: true,
      unsetLabel: "unset — no flag (recommended for plain Q&A)",
    });
    if (r.action !== "skip") changes[ENV.APPROVAL_MODE] = r;
  }

  // 5) Timeout
  {
    const raw = effective(ENV.TIMEOUT_MS);
    const cur = raw ? `${raw} ms` : "disabled (waits forever)";
    const r = await selectOption({
      title: "Per-call timeout",
      currentDisplay: cur,
      recommendedDisplay: "disabled (matches 1.1.6)",
      choices: [
        { label: "disabled — wait forever (matches 1.1.6)", value: "__disable__" },
        { label: "1800000  (30 minutes)", value: "1800000" },
        { label: "600000   (10 minutes)", value: "600000" },
      ],
      allowCustom: true,
      customLabel: "enter milliseconds",
      customPrompt: "timeout in ms (positive integer)",
    });
    if (r.action === "set") {
      if (r.value === "__disable__") changes[ENV.TIMEOUT_MS] = { action: "unset" };
      else {
        const n = Number(r.value);
        if (Number.isFinite(n) && n > 0) changes[ENV.TIMEOUT_MS] = { action: "set", value: String(Math.trunc(n)) };
        else console.log(c.yellow("    not a positive number — skipping timeout"));
      }
    }
  }

  // 6) Gemini executable path
  {
    const cur = effective(ENV.GEMINI_CLI_PATH) || "(auto-detect)";
    const r = await selectOption({
      title: "Gemini executable path (GEMINI_CLI_PATH)",
      currentDisplay: cur,
      recommendedDisplay: "(auto-detect)",
      choices: [{ label: "set a full path to the gemini executable", value: "__custom__" }],
      allowUnset: true,
      unsetLabel: "unset — auto-detect from PATH",
    });
    if (r.action === "unset") changes[ENV.GEMINI_CLI_PATH] = { action: "unset" };
    else if (r.action === "set") {
      const v = (await ask("full path")).trim();
      if (v) changes[ENV.GEMINI_CLI_PATH] = { action: "set", value: v };
    }
  }

  // ── Review ────────────────────────────────────────────────────────────────
  const changedKeys = Object.keys(changes);
  heading("Review");
  if (changedKeys.length === 0) {
    console.log(c.dim("  No changes selected. Nothing to do."));
    reader.close();
    return;
  }
  for (const key of changedKeys) {
    const ch = changes[key];
    const before = effective(key) || c.dim("(unset)");
    const after = ch.action === "unset" ? c.yellow("(unset)") : c.cyan(ch.value);
    console.log(`  ${key}: ${before} ${c.dim("→")} ${after}`);
  }

  // ── Apply target ────────────────────────────────────────────────────────--
  const target = await selectOption({
    title: "Where should these be applied?",
    currentDisplay: "n/a",
    recommendedDisplay: ".env (global default for this install)",
    choices: [
      { label: ".env file — global default loaded by the server", value: "env" },
      { label: "Claude Code — a specific client server's env block", value: "claude" },
      { label: "both", value: "both" },
    ],
  });
  if (target.action !== "set") {
    console.log(c.dim("\n  Cancelled — nothing written."));
    reader.close();
    return;
  }

  if (target.value === "env" || target.value === "both") {
    const map = { ...readRepoEnv() };
    for (const key of changedKeys) {
      if (changes[key].action === "unset") delete map[key];
      else map[key] = changes[key].value;
    }
    writeRepoEnv(map);
    console.log(`\n  ${OK} wrote ${c.cyan(envFilePath)}`);
    if (changedKeys.some((k) => (shellSnapshot[k] ?? "") !== "")) {
      console.log(`  ${WARN} ${c.dim("some keys are also exported in your shell — that export overrides .env.")}`);
    }
  }

  if (target.value === "claude" || target.value === "both") {
    await applyToClaudeCode(changes, changedKeys, { prompt, ask, confirm });
  }

  console.log("");
  reader.close();
}

async function applyToClaudeCode(changes, changedKeys, { prompt, ask, confirm }) {
  const json = readClaudeConfig();
  if (!json) {
    console.log(`\n  ${BAD} Claude Code config not found/parseable at ${claudeConfigPath} — skipping Claude Code.`);
    return;
  }
  const servers = findGeminiServers(json);
  console.log("\n" + c.bold("Claude Code — pick a server to update"));
  servers.forEach((s, i) => {
    const loc = s.scope === "user" ? "user" : `local:${s.project}`;
    console.log(`    ${i + 1}) ${s.name}  ${c.dim("[" + loc + "]")}`);
  });
  console.log(`    n) enter a different name (create under this project if missing)`);
  console.log(`    s) skip Claude Code`);
  const ans = (await prompt(`  choose [s]: `)).toLowerCase();

  let ref;
  if (ans === "" || ans === "s") {
    console.log(c.dim("  skipped Claude Code."));
    return;
  } else if (ans === "n") {
    const name = (await ask("server name", "gemini-cli")).trim() || "gemini-cli";
    // Search existing across scopes; else create under the current project (local).
    const existing = servers.find((s) => s.name === name) ||
      (json.mcpServers?.[name] && { scope: "user", project: null, name, cfg: json.mcpServers[name] }) ||
      (json.projects?.[repoRoot]?.mcpServers?.[name] && { scope: "local", project: repoRoot, name, cfg: json.projects[repoRoot].mcpServers[name] });
    if (existing) {
      ref = existing;
    } else {
      console.log(c.dim(`  '${name}' not found — will create it under project ${repoRoot} (local scope) using \`npx -y gemini-mcp-tool\`.`));
      if (!(await confirm("create it?", true))) return;
      json.projects = json.projects || {};
      json.projects[repoRoot] = json.projects[repoRoot] || {};
      json.projects[repoRoot].mcpServers = json.projects[repoRoot].mcpServers || {};
      json.projects[repoRoot].mcpServers[name] = { type: "stdio", command: "npx", args: ["-y", "gemini-mcp-tool"], env: {} };
      ref = { scope: "local", project: repoRoot, name, cfg: json.projects[repoRoot].mcpServers[name] };
    }
  } else {
    const idx = Number(ans) - 1;
    if (!Number.isInteger(idx) || !servers[idx]) {
      console.log(c.yellow("  unrecognised — skipping Claude Code."));
      return;
    }
    ref = servers[idx];
  }

  // Merge env into the chosen server.
  const target = ref.scope === "user" ? json.mcpServers[ref.name] : json.projects[ref.project].mcpServers[ref.name];
  target.env = target.env || {};
  for (const key of changedKeys) {
    if (changes[key].action === "unset") delete target.env[key];
    else target.env[key] = changes[key].value;
  }

  const loc = ref.scope === "user" ? "user" : `local:${ref.project}`;
  console.log(`\n  Resulting env for ${c.cyan(ref.name)} ${c.dim("[" + loc + "]")}:`);
  const entries = Object.entries(target.env);
  if (entries.length === 0) console.log(c.dim("    (empty)"));
  for (const [k, v] of entries) console.log(`    ${k} = ${c.cyan(v)}`);
  console.log(c.dim(`  Editing ${claudeConfigPath} (a ${c.bold("backup")} will be written to .bak first).`));
  if (!(await confirm("write this change?", true))) {
    console.log(c.dim("  not written."));
    return;
  }

  try {
    copyFileSync(claudeConfigPath, claudeConfigPath + ".bak");
    const tmp = `${claudeConfigPath}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(json, null, 2) + "\n", "utf8");
    renameSync(tmp, claudeConfigPath);
    console.log(`  ${OK} updated ${c.cyan(ref.name)} in ${claudeConfigPath} ${c.dim("(backup: " + claudeConfigPath + ".bak)")}`);
    console.log(`  ${WARN} ${c.dim("restart Claude Code to pick up the change (avoid editing while it's running).")}`);
  } catch (e) {
    console.log(`  ${BAD} failed to write config: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── dispatch ────────────────────────────────────────────────────────────────
const mode = (process.argv[2] || "").toLowerCase();
if (mode === "setup") {
  runSetup().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
} else {
  runReport();
}
