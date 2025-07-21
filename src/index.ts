#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CallToolRequest,
  ListToolsRequest,
  ListPromptsRequest,
  GetPromptRequest,
  Tool,
  Prompt,
  GetPromptResult,
  CallToolResult,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "./utils/logger.js";
import { ToolArguments } from "./interfaces.js";
import { PROTOCOL } from "./constants.js";

// Unified tool registry imports
import { 
  getToolDefinitions, 
  getPromptDefinitions, 
  executeTool, 
  toolExists, 
  getPromptMessage 
} from "./tools/index.js";

// Create server instance
const server = new Server(
  {
    name: "gemini-cli-mcp",
    version: "1.1.3",
  },{
    capabilities: {
      tools: {},
      prompts: {},
      notifications: {},
      logging: {},
    },
  },
);

// Global state for progress tracking
let isProcessing = false;
let currentOperationName = "";

async function sendNotification(method: string, params: any) {
  try {
    await server.notification({ method, params });
  } catch (error) {
    Logger.error("Failed to send notification:", error);
  }
}

/**
 * Sends a status message that appears in Claude Code UI with ⎿ symbol
 * @param message The status message to display
 */
async function sendStatusMessage(message: string) {
  try {
    // Try using progress notification format
    await server.notification({
      method: PROTOCOL.NOTIFICATIONS.PROGRESS,
      params: {
        progressToken: PROTOCOL.PROGRESS_TOKEN,
        value: {
          kind: PROTOCOL.STATUS.REPORT,
          message: message,
        },
      },
    });
  } catch (error) {
    Logger.error("Failed to send status message:", error);
  }
}

/**
 * Start progress updates to prevent MCP client timeout
 */
function startProgressUpdates(operationName: string) {
  isProcessing = true;
  currentOperationName = operationName;
  
  const progressMessages = [
    `🧠 ${operationName} - Gemini is analyzing your request...`,
    `📊 ${operationName} - Processing files and generating insights...`,
    `✨ ${operationName} - Creating structured response for your review...`,
    `⏱️ ${operationName} - Large analysis in progress (this is normal for big requests)...`,
    `🔍 ${operationName} - Still working... Gemini takes time for quality results...`,
  ];
  
  let messageIndex = 0;
  
  // Send immediate acknowledgment
  sendStatusMessage(`🔍 Starting ${operationName} (may take 5-15 minutes for large codebases)`);
  
  // Keep client alive with periodic updates
  const progressInterval = setInterval(async () => {
    if (isProcessing) {
      const message = progressMessages[messageIndex % progressMessages.length];
      await sendStatusMessage(message);
      messageIndex++;
    } else {
      clearInterval(progressInterval);
    }
  }, PROTOCOL.KEEPALIVE_INTERVAL); // Every 25 seconds
  
  return progressInterval;
}

/**
 * Stop progress updates
 */
function stopProgressUpdates(intervalId: NodeJS.Timeout) {
  isProcessing = false;
  currentOperationName = "";
  clearInterval(intervalId);
}





// tools/list
server.setRequestHandler(ListToolsRequestSchema, async (request: ListToolsRequest): Promise<{ tools: Tool[] }> => {
  return { tools: getToolDefinitions() as unknown as Tool[] };
});

// tools/get
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
  const toolName: string = request.params.name;

  if (toolExists(toolName)) {
    // Start progress updates to prevent timeout
    const progressInterval = startProgressUpdates(toolName);
    
    try {
      // Get prompt and other parameters from arguments with proper typing
      const args: ToolArguments = (request.params.arguments as ToolArguments) || {};

      Logger.toolInvocation(toolName, request.params.arguments);

      // Execute the tool using the unified registry
      const result = await executeTool(toolName, args);

      // Stop progress updates
      stopProgressUpdates(progressInterval);
      
      // Send completion message
      await sendStatusMessage(`✅ ${toolName} completed successfully`);

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
        isError: false,
      };
    } catch (error) {
      // Stop progress updates on error
      stopProgressUpdates(progressInterval);
      
      Logger.error(`Error in tool '${toolName}':`, error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await sendStatusMessage(`❌ ${toolName} failed: ${errorMessage}`);

      return {
        content: [
          {
            type: "text",
            text: `Error executing ${toolName}: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  } else {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

// prompts/list
server.setRequestHandler(ListPromptsRequestSchema, async (request: ListPromptsRequest): Promise<{ prompts: Prompt[] }> => {
  return { prompts: getPromptDefinitions() as unknown as Prompt[] };
});

// prompts/get
server.setRequestHandler(GetPromptRequestSchema, async (request: GetPromptRequest): Promise<GetPromptResult> => {
  const promptName = request.params.name;
  const args = request.params.arguments || {};
  
  const promptMessage = getPromptMessage(promptName, args);
  
  if (!promptMessage) {
    throw new Error(`Unknown prompt: ${promptName}`);
  }
  
  return { 
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: promptMessage
      }
    }]
  };
});

// Start the server
async function main() {
  Logger.debug("Starting gemini-mcp-tool server");
  
  // Keep MCP client alive during long operations with a backup heartbeat
  setInterval(async () => {
    if (isProcessing) {
      await sendStatusMessage(`⏳ Still processing ${currentOperationName}... Gemini is working on your request`);
    }
  }, PROTOCOL.BACKUP_HEARTBEAT_INTERVAL); // Every 20 seconds as backup
  
  const transport = new StdioServerTransport(); 
  await server.connect(transport);
  Logger.debug("gemini-mcp-tool server listening on stdio transport");
} main().catch((error) => {Logger.error("Fatal error:", error); process.exit(1); }); 
