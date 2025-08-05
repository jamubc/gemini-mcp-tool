/**
 * Example: Adding a new tool with the unified registry
 * To add this tool:
 * 1. Rename this file to remove .example (test-tool.ts)
 * 2. Import and register in src/tools/index.ts:
 *    import { testTool } from './test-tool.js';
 *    toolRegistry.push(testTool);
 * 
 * That's it! No more editing multiple files.
 */

import { z } from 'zod';
import { UnifiedTool } from './registry.js';

const testToolArgsSchema = z.object({
  message: z.string().describe("Test message to echo"), // Required field (no .optional())
});

export const testTool: UnifiedTool = {
  name: "test-tool",
  description: "A test tool demonstrating the simplified registration",
  zodSchema: testToolArgsSchema,
  prompt: {
    description: "Test the new unified tool registration",
    arguments: [{
      name: "message",
      description: "Message to test with",
      required: true
    }]
  },
  category: 'utility',
  execute: async (args) => {
    return `Test tool received: ${args.message}`;
  }
};