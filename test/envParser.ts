/**
 * envParser.ts
 * Gets the configuration for the test suites (E2E and Judge).
 * 
 * Note on `changemodeProjectPath` / `CHANGEMODE_PROJECT_PATH`:
 * This represents the path for a dedicated project to test changeMode in the MCP.
 * This allows you to run 'askGeminiChangeMode' via judge while testing gemini-mcp-tool.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export interface TestConfig {
  deepseekApiKey?: string;
  openrouterApiKey?: string;
  judgeModel?: string;
  changemodeProjectPath?: string;
  judgeGeminiModel: string;
}

export type JudgeConfig = TestConfig;

/**
 * Loads test configuration from process.env, then fills missing values from the
 * test directory `.env` file if it exists. System environment variables take precedence.
 * @param envPath Optional path to the .env file.
 * @returns An object containing the loaded environment variables.
 */
export function loadConfig(envPath: string = path.join(path.dirname(fileURLToPath(import.meta.url)), ".env")): TestConfig {
  const config: TestConfig = {
    judgeGeminiModel: process.env.JUDGE_GEMINI_MODEL || "gemini-2.5-flash",
    // Note, the model picked here may change the outcomes of tests.
  };

  // Populate config
  if (process.env.DEEPSEEK_API_KEY) {
    config.deepseekApiKey = process.env.DEEPSEEK_API_KEY;
  }
  if (process.env.OPENROUTER_API_KEY) {
    config.openrouterApiKey = process.env.OPENROUTER_API_KEY;
  }
  if (process.env.JUDGE_MODEL) {
    config.judgeModel = process.env.JUDGE_MODEL;
  }
  if (process.env.CHANGEMODE_PROJECT_PATH) {
    config.changemodeProjectPath = process.env.CHANGEMODE_PROJECT_PATH;
  }

  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, "utf-8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith("#")) continue;

        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;

        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();

        // Strip surrounding quotes
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.substring(1, val.length - 1);
        }

        if (key === "DEEPSEEK_API_KEY" && val && !process.env.DEEPSEEK_API_KEY) {
          config.deepseekApiKey = val;
        } else if (key === "OPENROUTER_API_KEY" && val && !process.env.OPENROUTER_API_KEY) {
          config.openrouterApiKey = val;
        } else if (key === "JUDGE_MODEL" && val && !process.env.JUDGE_MODEL) {
          config.judgeModel = val;
        } else if (key === "CHANGEMODE_PROJECT_PATH" && val && !process.env.CHANGEMODE_PROJECT_PATH) {
          config.changemodeProjectPath = val;
        } else if (key === "JUDGE_GEMINI_MODEL" && val && !process.env.JUDGE_GEMINI_MODEL) {
          config.judgeGeminiModel = val;
        }
      }
    } catch (e) {
      console.warn(`[Config] Failed to read .env file, did you set variables?: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return config;
}
