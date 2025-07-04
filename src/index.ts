#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { toolLoader } from './tools/index.js';
import { executeGeminiCLI } from './utils/gemini-executor.js';
import { StrictMode } from './types/strict-mode.js';
import { parseSuggestedEdits } from './utils/edit-parser.js';
import { runShell } from './utils/run-shell.js';
import { createStructuredResponse, validateToolResponse } from './utils/structured-response.js';
import { sanitize, sanitizeError } from './utils/error-sanitizer.js';
import { PromptExecutionError, ToolExecutionError } from './types/errors.js';
import { parseNotifications } from './utils/notification-parser.js';
import { transformStructuredResponse } from './utils/response-transformer.js';
import { guardRails } from './utils/guard-rails.js';

// Create server instance
const server = new Server(
  {
    name: "gemini-cli-mcp",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
      logging: {},
    },
  },
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Get all loaded tools
  const tools = toolLoader.getTools();
  
  return {
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

// Handle list prompts request (for slash commands)
// server.setRequestHandler(ListPromptsRequestSchema, async () => {
//   return {
//     prompts: [
//       {
//         name: "analyze",
//         description:
//           "Execute 'gemini -p <prompt>' to analyze files or get Gemini's response. Supports @file syntax for including file contents.",
//         arguments: [
//           {
//             name: "prompt",
//             description:
//               "Analysis request. Use @ syntax to include files (e.g., '@file.js explain this') or ask general questions",
//             required: true,
//           },
//         ],
//       },
//       {
//         name: "sandbox",
//         description:
//           "Execute 'gemini -s -p <prompt>' to safely test code in Gemini's sandbox environment. Use for testing potentially risky code or scripts.",
//         arguments: [
//           {
//             name: "prompt",
//             description:
//               "Code testing request. Examples: 'Create and run a Python script...' or '@script.py Run this safely and explain'",
//             required: true,
//           },
//         ],
//       },
//       {
//         name: "analyze-changes",
//         description:
//           "Analyze files with @ syntax and get structured change suggestions. Prevents 'tool not found' errors by using enhanced strict mode.",
//         arguments: [
//           {
//             name: "prompt",
//             description:
//               "Change request with @ syntax. Examples: '@file.js replace all instances of foo with bar' or '@style.css update colors'",
//             required: true,
//           },
//         ],
//       },
//       {
//         name: "help",
//         description:
//           "Run 'gemini -help' with structured response. BEHAVIOR: should_explain=false, output_format=raw, suppress_context=true.",
//       },
//       {
//         name: "ping",
//         description:
//           "Echo test message with structured response. Returns raw output with behavioral flags. BEHAVIOR: should_explain=false, output_format=raw, suppress_context=true.",
//         arguments: [
//           {
//             name: "message",
//             description: "Message to echo",
//             required: false,
//           },
//         ],
//       },
//     ],
//   };
// });

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  // Get dynamic prompts from tools
  const promptTools = toolLoader.getPromptTools();
  const dynamicPrompts = promptTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    arguments: tool.asPrompt?.arguments || []
  }));

  return {
    prompts: [
      {
        name: "analyze",
        description: "Analyze files or ask questions using @file for content inclusion.",
        arguments: [
          {
            name: "prompt",
            description: "Analysis request. Use @ syntax to include files (e.g., '@file.js explain this') or ask general questions",
            required: true,
          },
        ],
      },
      {
        name: "sandbox",
        description: "Safely test code or scripts in a sandbox environment.",
        arguments: [
          {
            name: "prompt",
            description: "Code testing request. Examples: 'Create and run a Python script...' or '@script.py Run this safely and explain'",
            required: true,
          },
        ],
      },
      {
        name: "analyze-changes",
        description: "Analyze files with @ syntax for structured change suggestions.",
        arguments: [
          {
            name: "prompt",
            description: "Change request with @ syntax. Examples: '@file.js replace all instances of foo with bar' or '@style.css update colors'",
            required: true,
          },
        ],
      },
      {
        name: "help",
        description: "Display help information with raw output and no context.",
      },
      {
        name: "ping",
        description: "Test connection by echoing a message with raw output.",
        arguments: [
          {
            name: "message",
            description: "Message to echo",
            required: false,
          },
        ],
      },
      ...dynamicPrompts
    ],
  };
});


// Handle prompt execution (for slash commands)
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const promptName = request.params.name;
  const args = request.params.arguments || {};

  switch (promptName) {
    case "analyze":
      const prompt = args.prompt as string;
      if (!prompt) {
        return {
          description: "Please provide a prompt for analysis",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Please provide a prompt for analysis. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions",
              },
            },
          ],
        };
      }
      try {
        const model = args.model as string | undefined;
        const sandbox =
          typeof args.sandbox === "boolean"
            ? args.sandbox
            : typeof args.sandbox === "string"
              ? args.sandbox === "true"
              : false;
        const result = await executeGeminiCLI(prompt, model, sandbox);
        return {
          description: "Analysis complete",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: result,
              },
            },
          ],
        };
      } catch (error) {
        const sanitizedMessage = sanitize(error);
        return {
          description: "Analysis failed",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Error: ${sanitizedMessage}`,
              },
            },
          ],
        };
      }

    case "analyze-changes":
      const changePrompt = args.prompt as string;
      if (!changePrompt) {
        return {
          description: "Please provide a change request with @ syntax",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Please provide a change request with @ syntax. Examples: '@file.js replace all instances of foo with bar' or '@style.css update the color scheme to dark mode'",
              },
            },
          ],
        };
      }
      try {
        const model = args.model as string | undefined;
        // Always use change mode for analyze-changes
        const result = await executeGeminiCLI(changePrompt, model, false, StrictMode.CHANGE);
        
        // Parse the result for structured edits
        const parsedResult = parseSuggestedEdits(result);
        
        return {
          description: "Change analysis complete",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: parsedResult,
              },
            },
          ],
        };
      } catch (error) {
        const sanitizedMessage = sanitize(error);
        return {
          description: "Change analysis failed",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Error: ${sanitizedMessage}`,
              },
            },
          ],
        };
      }

    case "sandbox":
      const sandboxPrompt = args.prompt as string;
      if (!sandboxPrompt) {
        return {
          description: "Please provide a prompt for sandbox testing",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Please provide a code testing request. Examples: 'Create and run a Python script that processes data' or '@script.py Run this script safely and explain what it does'",
              },
            },
          ],
        };
      }
      try {
        const model = args.model as string | undefined;
        const result = await executeGeminiCLI(sandboxPrompt, model, true); // Always use sandbox mode
        return {
          description: "Sandbox testing complete",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `🔒 **Sandbox Mode Execution:**\n\n${result}`,
              },
            },
          ],
        };
      } catch (error) {
        const sanitizedMessage = sanitize(error);
        return {
          description: "Sandbox testing failed",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `🔒 **Sandbox Error:**\n\nError: ${sanitizedMessage}`,
              },
            },
          ],
        };
      }

    case "help":
      try {
        const startTime = Date.now();
        const exec = await runShell("gemini", ["-help"]);
        const endTime = Date.now();
        
        if (!exec.ok) {
          throw new Error(`Help command failed: ${exec.err}`);
        }
        
        let rawOutput = exec.out;

        const mcpHelp = `\nGemini MCP Tool extra flags\n  --cwd <path>     Restart/launch server in <path> when working across repos.\n  --model <name>   Default model for ask-gemini / sandbox-test.\n  --sandbox        Force sandbox mode (ask-gemini).\n  For docs: https://github.com/jamubc/gemini-mcp-tool#readme`;

        rawOutput += "\n\n---" + mcpHelp + "\n";

        // Create structured response for slash command
        const structuredResult = createStructuredResponse(
          rawOutput,
          {
            idempotent: true,
            readsFilesystem: "none",
            writesFilesystem: false,
            network: "outbound",
            should_explain: false,
            output_format: "raw",
            context_needed: false,
            suppress_context: true,
          },
          {
            status: "success",
            timing: endTime - startTime,
            execution_details: "gemini -help executed via slash command",
          },
        );

        return {
          description: "Gemini CLI help",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: structuredResult,
              },
            },
          ],
        };
      } catch (error) {
        const sanitizedMessage = sanitize(error);
        return {
          description: "Help failed",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Error: ${sanitizedMessage}`,
              },
            },
          ],
        };
      }

    case "ping":
      const message = (args.message as string) || "Pong!";
      try {
        const startTime = Date.now();
        const exec = await runShell("echo", [message]);
        const endTime = Date.now();
        
        if (!exec.ok) {
          throw new Error(`Ping command failed: ${exec.err}`);
        }
        
        const rawOutput = exec.out;

        // Create structured response for slash command
        const structuredResult = createStructuredResponse(
          rawOutput,
          {
            idempotent: true,
            readsFilesystem: "none",
            writesFilesystem: false,
            network: "outbound",
            should_explain: false,
            output_format: "raw",
            context_needed: false,
            suppress_context: true,
          },
          {
            status: "success",
            timing: endTime - startTime,
            execution_details: "echo command executed via slash command",
          },
        );

        return {
          description: "Ping successful",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: structuredResult,
              },
            },
          ],
        };
      } catch (error) {
        const sanitizedMessage = sanitize(error);
        return {
          description: "Ping failed",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Error: ${sanitizedMessage}`,
              },
            },
          ],
        };
      }

    default:
      // Check if it's a dynamic tool prompt
      const tool = toolLoader.getTool(promptName);
      if (tool && tool.asPrompt?.enabled) {
        try {
          // Map prompt arguments to tool arguments
          const toolArgs: Record<string, any> = {};
          
          // Convert prompt arguments to tool input schema format
          if (tool.asPrompt.arguments) {
            for (const arg of tool.asPrompt.arguments) {
              if (args[arg.name] !== undefined) {
                toolArgs[arg.name] = args[arg.name];
              }
            }
          }
          
          // Execute the tool
          const result = await tool.execute(toolArgs);
          
          return {
            description: `${tool.name} executed successfully`,
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: result,
                },
              },
            ],
          };
        } catch (error) {
          const sanitizedMessage = sanitize(error);
          return {
            description: `${tool.name} failed`,
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: `Error: ${sanitizedMessage}`,
                },
              },
            ],
          };
        }
      }
      
      throw new Error(`Unknown prompt: ${promptName}`);
  }
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  
  try {
    // Only log tool invocation details if not launched via MCP
    const isMCPLaunched = process.env.GEMINI_MCP_LAUNCHED === '1';
    
    if (!isMCPLaunched) {
      console.warn(`[Gemini MCP] === TOOL INVOCATION ===`);
      console.warn(`[Gemini MCP] Tool: "${toolName}"`);
      console.warn(
        `[Gemini MCP] Raw arguments:`,
        JSON.stringify(request.params.arguments, null, 2),
      );
    }

    // Try to find the tool
    const tool = toolLoader.getTool(toolName);
    
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    // Execute the tool
    const result = await tool.execute(request.params.arguments);
    
    // Parse notifications from the response
    const { cleanedResponse, notifications } = parseNotifications(result);
    
    // Send notifications to user if any exist
    if (notifications.length > 0) {
      for (const notification of notifications) {
        try {
          await server.notification({
            method: "notifications/message",
            params: {
              level: "info",
              message: notification,
            }
          });
        } catch (notifError) {
          console.warn(`[Gemini MCP] Failed to send notification: ${notifError}`);
        }
      }
    }
    
    // Validate response and provide AI guidance
    const validation = validateToolResponse(toolName, cleanedResponse);

    // Add validation instructions as a comment for AI guidance
    const validatedResult = validation.instructions
      ? `${cleanedResponse}\n\n<!-- AI_INSTRUCTIONS: ${validation.instructions} -->`
      : cleanedResponse;
    
    // Apply response transformation (phrase rewriting and action sentence)
    const transformedResult = transformStructuredResponse(validatedResult);
    
    // Process through guard rails
    const processedResult = guardRails.processResponse(transformedResult, toolName);
    
    // Check if we need to append a write reminder
    if (guardRails.shouldAppendWriteReminder() && guardRails.responseContainsEditSuggestion(processedResult)) {
      const finalResult = processedResult + guardRails.getWriteReminderMessage();
      return {
        content: [
          {
            type: "text",
            text: finalResult,
          },
        ],
        isError: false,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: processedResult,
        },
      ],
      isError: false,
    };
  } catch (error) {
    console.error(`[Gemini MCP] Error in tool '${toolName}':`, error);

    const sanitizedMessage = sanitizeError(error, {
      level: 'moderate',
      includeStack: false,
      logOriginal: true
    });

    return {
      content: [
        {
          type: "text",
          text: `Error executing ${toolName}: ${sanitizedMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  // Only log initialization messages if not launched via MCP
  const isMCPLaunched = process.env.GEMINI_MCP_LAUNCHED === '1';
  
  if (!isMCPLaunched) {
    console.warn("{start gemini-mcp-tool");
  }

  // Load all tools
  await toolLoader.loadTools();
  
  if (!isMCPLaunched) {
    console.warn(`[Gemini MCP] Loaded ${toolLoader.getTools().length} tools`);
  }
  
  // Start guard rails session
  guardRails.startSession();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  if (!isMCPLaunched) {
    console.warn("Gemini CLI MCP server is running on stdio");
  }
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    guardRails.endSession();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    guardRails.endSession();
    process.exit(0);
  });
}

// Handle errors
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});