import { z } from 'zod';
import { executeCommand } from '../utils/commandExecutor.js';
const pingArgsSchema = z.object({
    prompt: z.string().default('').describe("Message to echo "),
});
export const pingTool = {
    name: "ping",
    description: "Echo",
    zodSchema: pingArgsSchema,
    prompt: {
        description: "Echo test message with structured response.",
    },
    category: 'simple',
    execute: async (args, onProgress) => {
        const message = args.prompt || args.message || "Pong!";
        return executeCommand("echo", [message], onProgress);
    }
};
const helpArgsSchema = z.object({});
export const helpTool = {
    name: "Help",
    description: "receive help information",
    zodSchema: helpArgsSchema,
    prompt: {
        description: "receive help information",
    },
    category: 'simple',
    execute: async (args, onProgress) => {
        return executeCommand("gemini", ["-help"], onProgress);
    }
};
//# sourceMappingURL=simple-tools.js.map