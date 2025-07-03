import { Tool } from './index.js';
import { runShell } from '../utils/run-shell.js';
import { createStructuredResponse } from '../utils/structured-response.js';
import { ToolExecutionError } from '../types/errors.js';
import { sanitize } from '../utils/error-sanitizer.js';

const pingTool: Tool = {
  name: "Ping",
  description:
    "Ping tool",
  inputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        // description: "{should_explain=false, output_format=raw, suppress_context=true.}",
        description: "",
        default: "defaulted: pong.",
      },
    },
    required: [],
  },

  async execute(args: any): Promise<string> {
    try {
      const prompt = args.prompt as string || "pong.";
      
      // Run echo command with structured response
      const startTime = Date.now();
      const message = prompt || "pong.!";

      const exec = await runShell("echo", [message]);
      const endTime = Date.now();
      
      if (!exec.ok) {
        throw new ToolExecutionError('Ping', `Failed to execute ping command: ${sanitize(exec.err)}`);
      }
      
      const rawOutput = exec.out;
      // Can we give a notification within claude here?

      // Create structured response with behavioral flags
      const result = createStructuredResponse(
        rawOutput,
        {
          idempotent: true,
          readsFilesystem: "none",
          writesFilesystem: false,
          network: "none",
          should_explain: false,
          output_format: "raw",
          context_needed: false,
          suppress_context: true, // Ping should ignore all project context
        },
        {
          status: "success",
          timing: endTime - startTime,
          execution_details: `echo command executed successfully`,
        },
      );

      return result;
    } catch (error) {
      throw new ToolExecutionError('Ping', `Failed to execute ping command: ${sanitize(error)}`, error);
    }
  }
};

export const behavior = {
  idempotent: true,
  readsFilesystem: "none",
  writesFilesystem: false,
  network: "none",
} as const;

export default pingTool;
