import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { executeCliCommand } from '../utils/cliExecutor.js';

const pingArgsSchema = z.object({
  prompt: z.string().default('').describe("Message to echo "),
});

export const pingTool: UnifiedTool = {
  name: "ping",
  description: "Echo",
  zodSchema: pingArgsSchema,
  prompt: {
    description: "Echo test message with structured response.",
  },
  category: 'simple',
  execute: async (args, onProgress) => {
    const message = args.prompt || args.message || "Pong!";
    const result = await executeCliCommand({
      command: "echo",
      args: [message as string],
      timeoutMs: 10_000,
      onStdout: onProgress,
    });
    return result.stdout.trim();
  }
};

const helpArgsSchema = z.object({});

export const helpTool: UnifiedTool = {
  name: "Help",
  description: "receive help information",
  zodSchema: helpArgsSchema,
  prompt: {
    description: "receive help information",
  },
  category: 'simple',
  execute: async (args, onProgress) => {
    const result = await executeCliCommand({
      command: "gemini",
      args: ["-help"],
      timeoutMs: 30_000,
      onStdout: onProgress,
      onStderr: onProgress,
    });
    return result.stdout.trim();
  }
};