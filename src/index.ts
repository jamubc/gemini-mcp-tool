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

    // The only server-side lever on a client's in-flight request timeout is a
    // notifications/progress carrying the client's progressToken: the MCP SDK
    // resets the per-request timer in _onprogress for that token (when the client
    // set resetTimeoutOnProgress). Logging notifications do not touch the timer,
    // so without a token there is nothing useful to send here. This is precisely
    // why a slow (e.g. 15-minute) changeMode survives only when the client opted
    // into progress — see PROTOCOL.KEEPALIVE_INTERVAL and the docs on long ops.
    if (!progressToken) return;

    const baseMessage = progressMessages[ctx.messageIndex % progressMessages.length];
    const outputPreview = ctx.latestOutput.slice(-150).trim();
    const message = outputPreview ? `${baseMessage}\n📝 Output: ...${outputPreview}` : baseMessage;
    ctx.messageIndex++;
    ctx.progress += 1;

    try {
      await server.notification({
        method: PROTOCOL.NOTIFICATIONS.PROGRESS,
        params: { progressToken, progress: ctx.progress, message },
      });
    } catch (error) {
      // Transport gone (e.g. EPIPE after the client went away): stop ticking so
      // we neither leak this timer nor keep throwing on a dead pipe.
      Logger.error("Keepalive progress notification failed; stopping updates:", error);
      ctx.isProcessing = false;
      clearInterval(progressInterval);
    }
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

// A long-lived stdio bridge must not die from a stray async/stream error.
// Without these guards a single unhandled rejection — or an EPIPE writing to
// stdout after the client went away mid-call — terminates the process, which
// Claude Code surfaces as the MCP server "disconnecting" after a handful of
// calls (issue #64). Log to stderr and stay up; startup failures still exit.
process.stdout.on("error", (err) => Logger.error("stdout stream error (ignored):", err));
process.stderr.on("error", () => { /* nowhere safe left to log */ });
process.on("unhandledRejection", (reason) => Logger.error("Unhandled rejection (server kept alive):", reason));
process.on("uncaughtException", (error) => Logger.error("Uncaught exception (server kept alive):", error));

// Start the server
async function main() {
  Logger.debug("init gemini-mcp-tool");
  const transport = new StdioServerTransport(); await server.connect(transport);
  Logger.debug("gemini-mcp-tool listening on stdio");
}
main().catch((error) => { Logger.error("Fatal error during startup:", error); process.exit(1); });
