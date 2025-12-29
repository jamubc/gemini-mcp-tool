import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { executeCommand } from '../utils/commandExecutor.js';

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
  annotations: {
    title: "Ping",
    readOnlyHint: true,
    idempotentHint: true,
  },
  execute: async (args, onProgress) => {
    const message = args.prompt || args.message || "Pong!";
    return executeCommand("echo", [message as string], onProgress);
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
  annotations: {
    title: "Help",
    readOnlyHint: true,
    openWorldHint: true,
  },
  execute: async (args, onProgress) => {
    return executeCommand("gemini", ["-help"], onProgress);
  }
};