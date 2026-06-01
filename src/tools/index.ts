// Tool Registry Index - Registers all tools
import { toolRegistry } from './registry.js';
import { askGeminiTool } from './ask-gemini.tool.js';
import { pingTool, helpTool } from './simple-tools.js';
import { brainstormTool } from './brainstorm.tool.js';
import { fetchChunkTool } from './fetch-chunk.tool.js';
import { timeoutTestTool } from './timeout-test.tool.js';

toolRegistry.push(
  askGeminiTool,
  pingTool,
  helpTool,
  brainstormTool,
  fetchChunkTool
);

// Only register test-only tools when explicitly enabled (e.g. judge/e2e test suite)
if (process.env.GEMINI_MCP_TEST_TOOLS) {
  toolRegistry.push(timeoutTestTool);
}

export * from './registry.js';