#!/usr/bin/env node
// gemini-mcp-tool setup doctor.
//
// Reports what the tool will actually do on this machine: which CLI backend is
// active, whether the gemini / agy executables are installed (path + version),
// the effective model configuration, and every related environment variable.
//
// Self-contained: pure Node, no build step or dependencies. The constant names
// below mirror src/constants.ts — keep them in sync.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ENV = {
  BACKEND: "GEMINI_MCP_BACKEND",
  APPROVAL_MODE: "GEMINI_MCP_APPROVAL_MODE",
  TIMEOUT_MS: "GEMINI_MCP_TIMEOUT_MS",
  GEMINI_CLI_PATH: "GEMINI_CLI_PATH",
  MODEL: "GEMINI_MODEL",
  FLASH_MODEL: "GEMINI_FLASH_MODEL",
};
const DEFAULT_FLASH_MODEL = "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const APPROVAL_MODES = ["default", "auto_edit", "yolo", "plan"];

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

const problems = [];

function runCmd(cmd, args) {
  try {
    const r = spawnSync(cmd, args, {
      encoding: "utf8",
      timeout: 20000,
      shell: isWindows, // .cmd shims on Windows need a shell
      windowsHide: true,
    });
    if (r.error) return { ok: false, err: r.error.message };
    return {
      ok: r.status === 0,
      status: r.status,
      out: (r.stdout || "").trim(),
      err: (r.stderr || "").trim(),
    };
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

function envLine(key, { fallback = c.dim("(unset)"), mask = false } = {}) {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return `${key} = ${fallback}`;
  return `${key} = ${c.cyan(mask ? "********" : raw)}`;
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

// ── System ───────────────────────────────────────────────────────────────────
heading("System");
console.log(`  node      ${process.version}`);
console.log(`  platform  ${process.platform} (${process.arch})`);

// ── Backend selection ──────────────────────────────────────────────────────--
const rawBackend = (process.env[ENV.BACKEND] || "gemini").trim().toLowerCase();
const backend = rawBackend === "agy" || rawBackend === "antigravity" ? "agy" : "gemini";
heading("Active backend");
console.log(`  ${ENV.BACKEND} = ${process.env[ENV.BACKEND] ? c.cyan(process.env[ENV.BACKEND]) : c.dim("(unset → gemini)")}`);
console.log(`  → using: ${c.bold(backend)}${backend === "agy" ? c.yellow("  (experimental)") : ""}`);
if (process.env[ENV.BACKEND] && backend === "gemini" && rawBackend !== "gemini") {
  console.log(`  ${WARN} unrecognised value ${JSON.stringify(process.env[ENV.BACKEND])} — defaulting to gemini`);
}

// ── Gemini CLI ─────────────────────────────────────────────────────────────--
heading("Gemini CLI");
const gemini = detectCli("gemini", { honourEnvPath: true });
if (gemini.found) {
  console.log(`  ${OK} found${gemini.override ? " (via " + ENV.GEMINI_CLI_PATH + ")" : ""}`);
  console.log(`     path     ${gemini.primary}${gemini.ext ? c.dim("  [" + gemini.ext + "]") : ""}`);
  console.log(`     version  ${gemini.version ? c.cyan(gemini.version) : c.yellow("(could not read --version)")}`);
  if (gemini.candidates.length > 1) {
    console.log(c.dim(`     also on PATH: ${gemini.candidates.slice(1).join(", ")}`));
  }
} else {
  console.log(`  ${BAD} not found on PATH`);
  if (backend === "gemini") {
    problems.push(
      `Gemini CLI not found. Install it (npm i -g @google/gemini-cli) or set ${ENV.GEMINI_CLI_PATH} to its full path.`,
    );
  }
}

// ── Antigravity CLI (agy) ─────────────────────────────────────────────────--
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
  if (backend === "agy") {
    problems.push("GEMINI_MCP_BACKEND=agy but the agy executable was not found on PATH.");
  }
}

// ── Model configuration ───────────────────────────────────────────────────--
heading("Model configuration");
const defaultModel = (process.env[ENV.MODEL] || "").trim();
const flashModel = (process.env[ENV.FLASH_MODEL] || "").trim() || DEFAULT_FLASH_MODEL;
console.log(`  default model   ${defaultModel ? c.cyan(defaultModel) + c.dim("  (GEMINI_MODEL)") : c.dim("(Gemini CLI's own default; pass model: or set GEMINI_MODEL)")}`);
console.log(`  flash fallback  ${c.cyan(flashModel)}${process.env[ENV.FLASH_MODEL] ? c.dim("  (GEMINI_FLASH_MODEL)") : c.dim("  (default)")}`);
if (backend === "agy") {
  console.log(`  ${WARN} agy print-mode ignores model selection (hardcoded to Gemini 3.5 Flash)`);
}

// ── Approval & timeout ─────────────────────────────────────────────────────--
heading("Behaviour");
const approval = (process.env[ENV.APPROVAL_MODE] || "").trim();
if (!approval) {
  console.log(`  approval mode   ${c.dim("(unset → no flag; plain Q&A)")}`);
} else if (APPROVAL_MODES.includes(approval)) {
  console.log(`  approval mode   ${c.cyan(approval)}`);
  if (approval === "plan") console.log(`  ${WARN} 'plan' makes Gemini an autonomous planner in headless mode — not ideal for plain Q&A`);
} else {
  console.log(`  approval mode   ${c.yellow(approval)} ${WARN} not one of ${APPROVAL_MODES.join("/")} — will be ignored`);
}
const rawTimeout = (process.env[ENV.TIMEOUT_MS] || "").trim();
let timeoutMs = DEFAULT_TIMEOUT_MS;
if (rawTimeout) {
  const n = Number(rawTimeout);
  timeoutMs = Number.isFinite(n) && n > 0 ? n : 0;
}
console.log(`  timeout         ${c.cyan(humanizeMs(timeoutMs))}${rawTimeout ? c.dim("  (GEMINI_MCP_TIMEOUT_MS)") : c.dim("  (default)")}`);

// ── Environment variables ──────────────────────────────────────────────────--
heading("Environment variables (this shell)");
for (const key of Object.values(ENV)) console.log("  " + envLine(key));
console.log(c.dim("\n  Note: your MCP client sets its own env for the server process — these are"));
console.log(c.dim("  the values in the shell running this doctor, which may differ."));

// ── Summary ────────────────────────────────────────────────────────────────--
heading("Summary");
if (problems.length === 0) {
  console.log(`  ${OK} ${c.green("No problems detected.")} Active backend '${backend}' looks ready.`);
} else {
  console.log(`  ${BAD} ${c.red(`${problems.length} issue(s) found:`)}`);
  for (const p of problems) console.log(`     - ${p}`);
}
console.log("");
process.exit(problems.length === 0 ? 0 : 1);
