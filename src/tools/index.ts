/**
 * Tool Registry Index - Registers all tools
 */

import { toolRegistry } from './registry.js';
import { askGeminiTool } from './ask-gemini.tool.js';
import { pingTool, helpTool } from './simple-tools.js';
import { brainstormTool } from './brainstorm.tool.js';
import { fetchChunkTool } from './fetch-chunk.tool.js';

// Register all tools
toolRegistry.push(
  askGeminiTool,
  pingTool,
  helpTool,
  brainstormTool,
  fetchChunkTool
);

// Export everything from registry
export * from './registry.js';