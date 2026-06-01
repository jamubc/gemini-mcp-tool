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
} from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "./utils/logger.js";
import { PROTOCOL, ToolArguments } from "./constants.js";

import { 
  getToolDefinitions, 
  getPromptDefinitions, 
  executeTool, 
  toolExists, 
  getPromptMessage 
} from "./tools/index.js";

const server = new Server(
  {
    name: "gemini-cli-mcp",
    version: "1.1.4",
  },{
    capabilities: {
      tools: {},
      prompts: {},
      logging: {},
    },
  },
);

interface ProgressContext {
  isProcessing: boolean;
  operationName: string;
  latestOutput: string;
  messageIndex: number;
  progress: number;
}

async function sendProgressNotification(
  progressToken: string | number | undefined,
  progress: number,
  total?: number,
  message?: string
) {
  if (!progressToken) return;
  try {
    const params: any = { progressToken, progress };
    if (total !== undefined) params.total = total;
    if (message) params.message = message;
    await server.notification({ method: PROTOCOL.NOTIFICATIONS.PROGRESS, params });
  } catch (error) {
    Logger.error("Failed to send progress notification:", error);
  }
}

function startProgressUpdates(operationName: string, progressToken?: string | number) {
  const ctx: ProgressContext = {
    isProcessing: true,
    operationName,
    latestOutput: "",
    messageIndex: 0,
    progress: 0,
  };

  const progressMessages = [
    `🧠 ${operationName} - Gemini is analyzing your request...`,
    `📊 ${operationName} - Processing files and generating insights...`,
    `✨ ${operationName} - Creating structured response for your review...`,
    `⏱️ ${operationName} - Large analysis in progress (this is normal for big requests)...`,
    `🔍 ${operationName} - Still working... Gemini takes time for quality results...`,
  ];

  if (progressToken) {
    sendProgressNotification(progressToken, 0, undefined, `🔍 Starting ${operationName}`);
  }

  const progressInterval = setInterval(async () => {
    if (!ctx.isProcessing) {
      clearInterval(progressInterval);
      return;
    }

    const baseMessage = progressMessages[ctx.messageIndex % progressMessages.length];
    const outputPreview = ctx.latestOutput.slice(-150).trim();
    const message = outputPreview ? `${baseMessage}\n📝 Output: ...${outputPreview}` : baseMessage;

    // Always send a log notification — keeps the stdio pipe alive even without a progressToken.
    // Claude Code silently drops the connection after ~30s of stdio inactivity; this prevents that.
    try {
      await server.notification({ method: "notifications/message", params: { level: "debug", data: message } });
    } catch {
      clearInterval(progressInterval);
      ctx.isProcessing = false;
      return;
    }

    if (progressToken) {
      ctx.progress += 1;
      await sendProgressNotification(progressToken, ctx.progress, undefined, message);
    }

    ctx.messageIndex++;
  }, PROTOCOL.KEEPALIVE_INTERVAL);

  return { interval: progressInterval, progressToken, ctx };
}

async function stopProgressUpdates(
  progressData: { interval: NodeJS.Timeout; progressToken?: string | number; ctx: ProgressContext },
  success: boolean = true
) {
  const operationName = progressData.ctx.operationName;
  progressData.ctx.isProcessing = false;
  clearInterval(progressData.interval);

  if (progressData.progressToken) {
    await sendProgressNotification(
      progressData.progressToken, 100, 100,
      success ? `✅ ${operationName} completed successfully` : `❌ ${operationName} failed`
    );
  }
}

// tools/list
server.setRequestHandler(ListToolsRequestSchema, async (request: ListToolsRequest): Promise<{ tools: Tool[] }> => {
  return { tools: getToolDefinitions() as unknown as Tool[] };
});

// tools/get
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
  const toolName: string = request.params.name;

  if (toolExists(toolName)) {
    // Check if client requested progress updates
    const progressToken = (request.params as any)._meta?.progressToken;
    
    // Start progress updates if client requested them
    const progressData = startProgressUpdates(toolName, progressToken);
    
    try {
      const args: ToolArguments = (request.params.arguments as ToolArguments) || {};

      Logger.toolInvocation(toolName, request.params.arguments);

      const result = await executeTool(toolName, args, (newOutput) => {
        progressData.ctx.latestOutput = newOutput;
      });

      await stopProgressUpdates(progressData, true);

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
      await stopProgressUpdates(progressData, false);
      
      Logger.error(`Error in tool '${toolName}':`, error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

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
  Logger.debug("init gemini-mcp-tool");
  const transport = new StdioServerTransport(); await server.connect(transport);
  Logger.debug("gemini-mcp-tool listening on stdio");
} main().catch((error) => {Logger.error("Fatal error:", error); process.exit(1); }); 
