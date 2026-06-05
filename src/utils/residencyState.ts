/**
 * residencyState.ts
 *
 * Persists the warm-residency baseline { baseSha, createdAt } to a JSON file
 * inside the state directory.  The state directory path is derived from the
 * GEMINI_MCP_STATE_DIR environment variable (default: '.gemini-mcp') resolved
 * relative to process.cwd().
 *
 * Security: all paths are confined within process.cwd() – no user-supplied
 * path components reach the filesystem.
 */
import * as fs from "fs";
import * as path from "path";
import { GEMINI_MCP_STATE_DIR } from "../constants.js";
import { Logger } from "./logger.js";

export interface ResidencyBaseline {
  baseSha: string;
  createdAt: string; // ISO 8601
}

/** Resolve the state directory, anchored at process.cwd(). */
function stateDir(): string {
  const dirName = process.env[GEMINI_MCP_STATE_DIR] ?? ".gemini-mcp";
  const resolved = path.resolve(process.cwd(), dirName);
  // Prevent escaping the working directory.
  const cwd = path.resolve(process.cwd());
  if (resolved !== cwd && !resolved.startsWith(cwd + path.sep)) {
    throw new Error(
      `GEMINI_MCP_STATE_DIR resolves outside the project directory: "${resolved}"`
    );
  }
  return resolved;
}

function residencyFilePath(): string {
  return path.join(stateDir(), "residency.json");
}

/** Lazily create the state directory. */
function ensureStateDir(): void {
  const dir = stateDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    Logger.debug(`residencyState: created state directory: ${dir}`);
  }
}

/**
 * Read the persisted baseline, or return null if none exists.
 */
export function getBaseline(): ResidencyBaseline | null {
  const fp = residencyFilePath();
  if (!fs.existsSync(fp)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(fp, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "baseSha" in parsed &&
      "createdAt" in parsed &&
      typeof (parsed as { baseSha: unknown }).baseSha === "string" &&
      typeof (parsed as { createdAt: unknown }).createdAt === "string"
    ) {
      return parsed as ResidencyBaseline;
    }
    Logger.debug("residencyState: residency.json has unexpected shape, ignoring");
    return null;
  } catch (err) {
    Logger.debug(`residencyState: failed to read baseline: ${err}`);
    return null;
  }
}

/**
 * Persist a new baseline SHA, recording the current timestamp.
 */
export function setBaseline(sha: string): void {
  ensureStateDir();
  const baseline: ResidencyBaseline = {
    baseSha: sha,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(residencyFilePath(), JSON.stringify(baseline, null, 2), "utf8");
  Logger.debug(`residencyState: baseline set to ${sha}`);
}

/**
 * Remove the persisted baseline (clears warm-residency state).
 */
export function clearBaseline(): void {
  const fp = residencyFilePath();
  if (fs.existsSync(fp)) {
    fs.unlinkSync(fp);
    Logger.debug("residencyState: baseline cleared");
  }
}
