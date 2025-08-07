// Tool Registry Index - Registers all tools
import { toolRegistry } from './registry.js';
import { askGeminiTool } from './ask-gemini.tool.js';
import { pingTool, helpTool } from './simple-tools.js';
import { brainstormTool } from './brainstorm.tool.js';
import { timeoutTestTool } from './timeout-test.tool.js';
import { quotaStatusTool } from './quota-status.tool.js';
import { chatManagementTools } from './chat-management-tools.js';

toolRegistry.push(
  askGeminiTool,
  pingTool,
  helpTool,
  brainstormTool,
  timeoutTestTool,
  quotaStatusTool,
  ...chatManagementTools
);

export * from './registry.js';