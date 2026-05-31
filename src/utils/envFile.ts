import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { ENV } from "../constants.js";
import { Logger } from "./logger.js";

// Only these recognised keys are imported from a .env — never arbitrary keys —
// so an unrelated .env sitting in the launch directory can't inject variables
// into the server process.
const KNOWN_KEYS: ReadonlySet<string> = new Set(Object.values(ENV));

export function parseEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let key = line.slice(0, eq).trim();
    if (key.startsWith("export ")) key = key.slice(7).trim();
    let val = line.slice(eq + 1).trim();
    // Strip a single layer of matching surrounding quotes.
    if (
      val.length >= 2 &&
      ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'")))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function candidatePaths(): string[] {
  // dist/utils/envFile.js → package root is two levels up.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(here, "..", "..");
  const cwd = process.cwd();
  const paths = [path.join(packageRoot, ".env")];
  if (path.resolve(cwd) !== packageRoot) paths.push(path.join(cwd, ".env"));
  return paths;
}

/**
 * Load recognised GEMINI_* config keys from a `.env` file into `process.env`,
 * WITHOUT overriding anything already set — a shell export or the MCP client's
 * own `env` block always wins. Only the keys in {@link ENV} are imported.
 *
 * This is the "global" (per-install) config source written by `npm run doctor
 * setup`. It is a no-op when no `.env` exists, so installs that don't use one
 * behave exactly as before (1.1.6 parity).
 */
export function loadEnvFile(): void {
  for (const p of candidatePaths()) {
    if (!existsSync(p)) continue;
    let parsed: Record<string, string>;
    try {
      parsed = parseEnv(readFileSync(p, "utf8"));
    } catch (e) {
      Logger.warn(`Could not read ${p}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    let applied = 0;
    for (const [k, v] of Object.entries(parsed)) {
      if (!KNOWN_KEYS.has(k)) continue;
      // Don't override an already-set value (shell/client env wins over .env).
      if (process.env[k] !== undefined && process.env[k] !== "") continue;
      process.env[k] = v;
      applied++;
    }
    if (applied > 0) Logger.debug(`Loaded ${applied} setting(s) from ${p}`);
    return; // first existing .env wins
  }
}
