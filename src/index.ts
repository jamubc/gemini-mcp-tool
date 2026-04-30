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
import { trace } from "./utils/fileTrace.js";
import { PROTOCOL, ToolArguments } from "./constants.js";

const PROGRESS_NOTIFICATIONS_ENABLED = process.env.GEMINI_MCP_ENABLE_PROGRESS === "1";
const NO_FALLBACK_ENABLED = process.argv.includes('--no-fallback');

trace("process.start", { argvCount: process.argv.length });

process.stdin.on("end", () => trace("stdin.end"));
process.stdin.on("close", () => trace("stdin.close"));
process.stdin.on("error", (error) => trace("stdin.error", { message: error.message, stack: error.stack }));

process.on("beforeExit", (code) => trace("process.beforeExit", { code }));
process.on("exit", (code) => trace("process.exit", { code }));
process.on("SIGTERM", () => trace("process.signal", { signal: "SIGTERM" }));
process.on("SIGINT", () => trace("process.signal", { signal: "SIGINT" }));

process.on("unhandledRejection", (reason) => {
  trace("process.unhandledRejection", { reason: String(reason) });
  Logger.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  trace("process.uncaughtException", { message: error.message, stack: error.stack });
  Logger.error("Uncaught exception:", error);
});

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
    version: "1.2.0",
  },{
    capabilities: {
      tools: {},
      prompts: {},
      logging: {},
    },
  },
);

let isProcessing = false; let currentOperationName = ""; let latestOutput = "";

async function sendNotification(method: string, params: any) {
  try {
    await server.notification({ method, params });
  } catch (error) {
    Logger.error("notification failed: ", error);
  }
}

/**
 * @param progressToken The progress token provided by the client
 * @param progress The current progress value
 * @param total Optional total value
 * @param message Optional status message
 */
async function sendProgressNotification(
  progressToken: string | number | undefined,
  progress: number,
  total?: number,
  message?: string
) {
  if (!progressToken) return; // Only send if client requested progress
  
  try {
    const params: any = {
      progressToken,
      progress
    };
    
    if (total !== undefined) params.total = total; // future cache progress
    if (message) params.message = message;
    
    await server.notification({
      method: PROTOCOL.NOTIFICATIONS.PROGRESS,
      params
    });
  } catch (error) {
    Logger.error("Failed to send progress notification:", error);
  }
}

function startProgressUpdates(
  operationName: string,
  progressToken?: string | number
) {
  isProcessing = true;
  currentOperationName = operationName;
  latestOutput = ""; // Reset latest output
  
  const progressMessages = [
    `🧠 ${operationName} - Gemini is analyzing your request...`,
    `📊 ${operationName} - Processing files and generating insights...`,
    `✨ ${operationName} - Creating structured response for your review...`,
    `⏱️ ${operationName} - Large analysis in progress (this is normal for big requests)...`,
    `🔍 ${operationName} - Still working... Gemini takes time for quality results...`,
  ];
  
  let messageIndex = 0;
  let progress = 0;
  
  // Send immediate acknowledgment if progress requested
  if (progressToken) {
    sendProgressNotification(
      progressToken,
      0,
      undefined, // No total - indeterminate progress
      `🔍 Starting ${operationName}`
    );
  }
  
  // Keep client alive with periodic updates
  const progressInterval = setInterval(async () => {
    if (isProcessing && progressToken) {
      // Simply increment progress value
      progress += 1;
      
      // Include latest output if available
      const baseMessage = progressMessages[messageIndex % progressMessages.length];
      const outputPreview = latestOutput.slice(-150).trim(); // Last 150 chars
      const message = outputPreview 
        ? `${baseMessage}\n📝 Output: ...${outputPreview}`
        : baseMessage;
      
      await sendProgressNotification(
        progressToken,
        progress,
        undefined, // No total - indeterminate progress
        message
      );
      messageIndex++;
    } else if (!isProcessing) {
      clearInterval(progressInterval);
    }
  }, PROTOCOL.KEEPALIVE_INTERVAL); // Every 25 seconds
  
  return { interval: progressInterval, progressToken };
}

function stopProgressUpdates(
  progressData: { interval: NodeJS.Timeout; progressToken?: string | number },
  success: boolean = true
) {
  const operationName = currentOperationName; // Store before clearing
  isProcessing = false;
  currentOperationName = "";
  clearInterval(progressData.interval);
  
  // Send final progress notification if client requested progress
  if (progressData.progressToken) {
    sendProgressNotification(
      progressData.progressToken,
      100,
      100,
      success ? `✅ ${operationName} completed successfully` : `❌ ${operationName} failed`
    );
  }
}

// tools/list
server.setRequestHandler(ListToolsRequestSchema, async (request: ListToolsRequest): Promise<{ tools: Tool[] }> => {
  trace("tools.list.start", { request });
  const tools = getToolDefinitions() as unknown as Tool[];
  trace("tools.list.end", { count: tools.length, names: tools.map((tool) => tool.name) });
  return { tools };
});

// tools/get
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
  const toolName: string = request.params.name;

  const rawArguments = request.params.arguments;
  trace("tools.call.received", {
    name: toolName,
    hasArguments: rawArguments !== undefined,
    argumentKeys: rawArguments && typeof rawArguments === "object" ? Object.keys(rawArguments as Record<string, unknown>) : [],
  });

  if (toolExists(toolName)) {
    const progressToken = PROGRESS_NOTIFICATIONS_ENABLED ? request.params._meta?.progressToken : undefined;

    const progressData = startProgressUpdates(toolName, progressToken);
    
    try {
      // Get prompt and other parameters from arguments with proper typing.
      // Inject noFallback from the server's CLI flag / env var so the tool
      // can thread it through to executeGeminiCLI without exposing it in the
      // public MCP tool schema.
      const args: ToolArguments = {
        ...((request.params.arguments as ToolArguments) || {}),
        noFallback: NO_FALLBACK_ENABLED,
      };

      Logger.toolInvocation(toolName, request.params.arguments);
      trace("tools.call.execute.start", { name: toolName });

      // Execute the tool using the unified registry with progress callback
      const result = await executeTool(toolName, args, (newOutput) => {
        latestOutput = newOutput;
      });

      trace("tools.call.execute.end", { name: toolName, resultLength: result.length });

      // Stop progress updates
      stopProgressUpdates(progressData, true);

      trace("tools.call.response", { name: toolName, isError: false });
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
      stopProgressUpdates(progressData, false);
      
      Logger.error(`Error in tool '${toolName}':`, error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      trace("tools.call.response", { name: toolName, isError: true, error: errorMessage });
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
  trace("server.main.start");
  Logger.debug("init gemini-mcp-tool");
  const transport = new StdioServerTransport();

  const originalSend = transport.send.bind(transport);
  transport.send = async (message) => {
    trace("transport.send", { method: "method" in message ? message.method : undefined, id: "id" in message ? message.id : undefined });
    await originalSend(message);
    trace("transport.send.done", { method: "method" in message ? message.method : undefined, id: "id" in message ? message.id : undefined });
  };

  const originalOnMessage = transport.onmessage;
  transport.onmessage = (message) => {
    trace("transport.message", { method: "method" in message ? message.method : undefined, id: "id" in message ? message.id : undefined });
    originalOnMessage?.(message);
  };

  transport.onclose = () => trace("transport.close");
  transport.onerror = (error) => trace("transport.error", { message: error.message, stack: error.stack });
  server.oninitialized = () => trace("server.initialized", { client: server.getClientVersion(), capabilities: server.getClientCapabilities() });
  server.onclose = () => trace("server.close");

  await server.connect(transport);
  trace("server.connected");
  Logger.debug("gemini-mcp-tool listening on stdio");
}

main().catch((error) => {
  Logger.error("Fatal startup error:", error);
  process.exit(1);
});
