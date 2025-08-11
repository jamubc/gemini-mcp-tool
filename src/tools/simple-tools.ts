import { z } from "zod";
import { UnifiedTool } from "./registry.js";
import { executeCommand } from "../utils/commandExecutor.js";

const pingArgsSchema = z.object({
  prompt: z.string().default("").describe("Message to echo "),
});

type PingArgs = z.infer<typeof pingArgsSchema>;

export const pingTool: UnifiedTool<PingArgs> = {
  name: "ping",
  description: "Echo",
  zodSchema: pingArgsSchema,
  prompt: {
    description: "Echo test message with structured response.",
  },
  category: "simple",
  execute: async (args: PingArgs, onProgress) => {
    const message = args.prompt || "Pong!";
    return executeCommand("echo", [message], onProgress);
  },
};

const helpArgsSchema = z.object({});

type HelpArgs = z.infer<typeof helpArgsSchema>;

export const helpTool: UnifiedTool<HelpArgs> = {
  name: "Help",
  description: "receive help information",
  zodSchema: helpArgsSchema,
  prompt: {
    description: "receive help information",
  },
  category: "simple",
  execute: async (_args: HelpArgs, onProgress) => {
    return executeCommand("gemini", ["-help"], onProgress);
  },
};
