import { Tool } from './index.js';
import { executeGeminiCLI } from '../utils/gemini-executor.js';
import { StrictMode, StrictModeType } from '../types/strict-mode.js';
import { sanitize } from '../utils/error-sanitizer.js';
import { ToolExecutionError, TimeoutError } from '../types/errors.js';

const askGeminiTool: Tool = {
  name: "ask-gemini",
  description:
    "Execute 'gemini -p <prompt>' to get Gemini AI's response with preserved context field boundaries. Use when: 1) User asks for Gemini's opinion/analysis, 2) User wants to analyze large files with @file syntax, 3) User uses /gemini-cli:analyze command. Defaults to StrictMode.OFF to preserve field integrity. Supports -m flag for model selection and -s flag for sandbox testing.",
  inputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "Analysis request. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions. When @ syntax is used, strict mode is automatically enabled to focus on file contents.",
      },
      model: {
        type: "string",
        description:
          "Optional model to use (e.g., 'gemini-2.5-flash'). If not specified, uses the default model (gemini-2.5-pro).",
      },
      sandbox: {
        type: "boolean",
        description:
          "Use sandbox mode (-s flag) to safely test code changes, execute scripts, or run potentially risky operations in an isolated environment",
        default: false,
      },
      strictMode: {
        type: "string",
        description:
          "Strict mode type: 'off' (default), 'auto', 'analysis', 'change', or 'search'. Default preserves field boundaries for proper context orchestration.",
        enum: ["off", "auto", "analysis", "change", "search"],
        default: "off",
      },
    },
    required: ["prompt"],
  },

  async execute(args: any): Promise<string> {
    const prompt = args.prompt as string;
    const model = args.model as string | undefined;
    const sandbox = args.sandbox as boolean;
    const strictMode = (args.strictMode as StrictModeType) || StrictMode.OFF;

    // Check if prompt is provided
    if (!prompt.trim()) {
      throw new ToolExecutionError(
        'ask-gemini',
        "Please provide a prompt for analysis. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions"
      );
    }

    console.warn(`[Gemini MCP] About to execute Gemini command...`);

    let statusLog = `Run {gemini-cli} for: ${sandbox ? " in sandbox mode" : ""}...\n\n`;

    try {
      // Set a race between command execution and timeout (longer for sandbox operations)
      const timeoutDuration = sandbox ? 600000 : 300000; // 10 minutes for sandbox, 5 minutes for regular
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () =>
            reject(
              new TimeoutError(
                `Tool timeout after ${timeoutDuration / 1000} seconds`,
                timeoutDuration,
                'ask-gemini'
              ),
            ),
          timeoutDuration,
        );
      });

      const result = await Promise.race([
        executeGeminiCLI(prompt, model, sandbox, strictMode),
        timeoutPromise as Promise<string>,
      ]);

      console.warn(
        `[Gemini MCP] Gemini command completed successfully, result length: ${result.length}`,
      );

      // Add status to our log
      statusLog += `{gemini-cli} [completed]:  (${result.length} characters)\n\n`;
      statusLog += `< [Processed Response] >\n${result}`;

      return statusLog;
    } catch (error) {
      console.error(`[Gemini MCP] Command failed:`, error);
      const sanitizedMessage = sanitize(error);
      statusLog += `Gemini command failed: ${sanitizedMessage}\n\n`;
      throw new ToolExecutionError(
        'ask-gemini',
        statusLog + `Error: ${sanitizedMessage}`,
        error
      );
    }
  }
};

export const behavior = {
  idempotent: true,
  readsFilesystem: "none",
  writesFilesystem: false,
  network: "outbound",
} as const;

export default askGeminiTool;
