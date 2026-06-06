import { spawn } from "child_process";
import { CLI } from "../constants.js";
import { resolveCommandForExecution } from "../utils/commandExecutor.js";
import { Logger } from "../utils/logger.js";

/**
 * What the *installed* `agy` build supports, discovered from `agy --help` so the
 * backend adapts to whatever version is on PATH instead of hard-coding 1.0.x
 * assumptions. As upstream fixes print-mode (antigravity-cli#7) these flags
 * appear and we automatically prefer the clean paths — JSON on stdout, a
 * caller-known conversation id — over transcript scraping. That is Phase 3's
 * "self-retiring fallback" in code: nothing here needs editing when agy improves.
 *
 * Detection is a best-effort scan of the help text. Every capability defaults to
 * false, so a missing / slow / unusual `agy --help` leaves us behaving exactly as
 * the Phase 1-2 backend did.
 */
export interface AgyCapabilities {
  /** `--output-format` exists and advertises a json mode → we can skip scraping. */
  outputFormatJson: boolean;
  /** `--conversation <id>` exists → sessions can be addressed explicitly. */
  conversationId: boolean;
  /** `--continue`/`-c` exists → "resume latest" is available. */
  continueFlag: boolean;
  /** `--print-timeout` exists → headless runs can bound their own wait. */
  printTimeout: boolean;
  /** Raw help text, kept for diagnostics. */
  raw: string;
}

export const NO_AGY_CAPABILITIES: AgyCapabilities = {
  outputFormatJson: false,
  conversationId: false,
  continueFlag: false,
  printTimeout: false,
  raw: "",
};

/** Parse `agy --help` text into a capability set. Pure — unit tested directly. */
export function parseAgyHelp(help: string): AgyCapabilities {
  if (!help) return NO_AGY_CAPABILITIES;
  const has = (re: RegExp) => re.test(help);
  return {
    outputFormatJson: has(/--output-format\b/) && /\bjson\b/i.test(help),
    conversationId: has(/--conversation\b/),
    continueFlag: has(/--continue\b/) || has(/(^|\s)-c\b/),
    printTimeout: has(/--print-timeout\b/),
    raw: help,
  };
}

const HELP_TIMEOUT_MS = 4000;

/** Run `agy --help` defensively: never throws, never hangs the backend. */
function runAgyHelp(): Promise<string> {
  return new Promise((resolve) => {
    let cmd: string;
    try {
      cmd = resolveCommandForExecution(CLI.COMMANDS.AGY);
    } catch {
      resolve("");
      return;
    }
    const isWindows = process.platform === "win32";
    const spawnCmd = isWindows && /\s/.test(cmd) ? `"${cmd}"` : cmd;

    let child;
    try {
      child = spawn(spawnCmd, ["--help"], {
        env: process.env,
        shell: isWindows,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      resolve("");
      return;
    }

    let out = "";
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(out);
    };
    // Some CLIs print usage to stderr; capture both.
    child.stdout?.on("data", (d) => (out += d.toString()));
    child.stderr?.on("data", (d) => (out += d.toString()));
    child.on("error", () => finish());
    child.on("close", () => finish());

    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
      finish();
    }, HELP_TIMEOUT_MS);
    timer.unref?.();
  });
}

let cached: Promise<AgyCapabilities> | undefined;

/**
 * Probe (once per process) what the installed agy supports. Fail-safe: any
 * problem yields NO_AGY_CAPABILITIES, i.e. the conservative Phase 1-2 behaviour.
 */
export function probeAgyCapabilities(): Promise<AgyCapabilities> {
  if (!cached) {
    cached = runAgyHelp()
      .then(parseAgyHelp)
      .catch((e) => {
        Logger.warn(`agy: capability probe failed, assuming none: ${(e as Error).message}`);
        return NO_AGY_CAPABILITIES;
      });
  }
  return cached;
}

/** Test seam: pin a capability set (or pass nothing to clear the cache). */
export function __setAgyCapabilitiesForTest(caps?: AgyCapabilities): void {
  cached = caps ? Promise.resolve(caps) : undefined;
}
