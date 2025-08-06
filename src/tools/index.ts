// Tool Registry Index - Registers all tools
import { toolRegistry } from './registry.js';
import { askGeminiTool } from './ask-gemini.tool.js';
import { pingTool, helpTool } from './simple-tools.js';
import { brainstormTool } from './brainstorm.tool.js';
import { fetchChunkTool } from './fetch-chunk.tool.js';
import { timeoutTestTool } from './timeout-test.tool.js';
import { chatTools } from './chat-tools.js';
import { chatManagementTools } from './chat-management-tools.js';

toolRegistry.push(
  askGeminiTool,
  pingTool,
  helpTool,
  brainstormTool,
  fetchChunkTool,
  timeoutTestTool,
  ...chatTools,
  ...chatManagementTools
);

export * from './registry.js';