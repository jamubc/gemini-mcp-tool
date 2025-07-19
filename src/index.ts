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
import { executeCommand } from "./utils/commandExecutor.js";
import { Logger } from "./utils/logger.js";
import {
  ToolBehavior,
  StructuredToolResponse,
  PromptArguments,
  ToolArguments,
  StandardizedResponseSections,
} from "./interfaces.js";
import { jsonFormat } from "./utils/jsonFormat.js";
import { 
  TOOL_NAMES, 
  LOG_PREFIX, 
  ERROR_MESSAGES, 
  STATUS_MESSAGES, 
  MODELS, 
  OUTPUT_DELIMITERS,
  RESPONSE_SECTIONS,
  PROTOCOL,
  CLI
} from "./constants.js";

import {  formatStructuredResponse,
  optimizeLargeOldSections,} from "./utils/formatStructuredResponse.util.js"; 

import {createContextPrompt,extraPromptModePrompt} from "./prompts.js";

// Build standardized response sections for structured output

function buildStructuredResponse(result: string, originalPrompt: string, strictMode: StrictMode): StandardizedResponseSections {
  let changesSuggested = '';
  let analysisContent = '';
  let nextSteps = '';
 
  if (result.includes("Tool") && result.includes(ERROR_MESSAGES.TOOL_NOT_FOUND)) {
    Logger.warn("Detected tool registry error, formatting guidance...");
    analysisContent = `${RESPONSE_SECTIONS.ANALYSIS_PREFIX} "${originalPrompt}"\n\nGemini attempted to use unavailable tools for direct file editing.`;
    changesSuggested = result;
    nextSteps = RESPONSE_SECTIONS.NEXT_STEPS_EDIT;
  } 
   else {
    // Standard analysis mode
    analysisContent = `${RESPONSE_SECTIONS.ANALYSIS_OF_PREFIX} "${originalPrompt}"`;
    changesSuggested = result;
    nextSteps = RESPONSE_SECTIONS.NEXT_STEPS_STANDARD;
  }

  return {
    analysis: analysisContent,
    changesSuggested: changesSuggested,
    nextSteps: nextSteps
  };
}

enum StrictMode { // --> "structured editing mode" 
  NONE = "none",
  CHANGE = "change",
  ANALYSIS = "analysis",
}

// Helper function to parse boolean arguments consistently
function parseBooleanArg(value: any): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value === CLI.DEFAULTS.BOOLEAN_TRUE;
  }
  return false;
}

// Helper function to create structured responses
function createStructuredResponse(
  toolOutput: string,
  behavior: ToolBehavior,
  metadata?: { status: string; timing?: number; execution_details?: string },
): string {
  const response: StructuredToolResponse = {
    tool_output: toolOutput,
    behavior,
    ...(metadata && { metadata }),
  };

  return `${OUTPUT_DELIMITERS.START} // Return with clear delimiters for AI parsing
${toolOutput}
    ${OUTPUT_DELIMITERS.END}

    ${OUTPUT_DELIMITERS.METADATA_PREFIX} ${JSON.stringify({ behavior, metadata })}`;
}

// Helper function to execute simple tools (Ping, Help)
async function executeSimpleTool(toolName: string, prompt: string): Promise<string> {
  const toolConfigs = {
    "Ping": {
      command: "echo",
      args: [prompt || "Pong!"],
      details: "echo command executed successfully"
    },
    "Help": {
      command: "gemini",
      args: ["-help"],
      details: "gemini -help command executed successfully"
    }
  };

  const config = toolConfigs[toolName as keyof typeof toolConfigs];
  if (!config) {
    throw new Error(`Unknown simple tool: ${toolName}`);
  }

  return createToolResponse(
    config.command,
    config.args,
    {
      should_explain: false,
      output_format: "raw",
      context_needed: false,
      suppress_context: true,
    },
    config.details
  );
}

// Helper function to create tool responses with timing
function createToolResponse(
  command: string,
  args: string[],
  behavior: ToolBehavior,
  executionDetails: string
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const startTime = Date.now();
      const rawOutput = await executeCommand(command, args);
      const endTime = Date.now();

      const result = createStructuredResponse(
        rawOutput,
        behavior,
        {
          status: "success",
          timing: endTime - startTime,
          execution_details: executionDetails,
        }
      );
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

// Create server instance
const server = new Server(
  {
    name: "gemini-cli-mcp",
    version: "1.1.3",
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
      notifications: {},
      logging: {},
    },
  },
);

/**
 * Sends a notification to the client
 * @param method The notification method
 * @param params The notification parameters
 */
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

// // Function for changeMode prompt processing
// function formatPromptChangeMode(originalPrompt: string, strictMode: StrictMode): string { //  --> ???
//   let enhancedPrompt = originalPrompt;
//   if (strictMode === StrictMode.CHANGE) {
//     enhancedPrompt = `${originalPrompt} + ${extraPromptModePrompt}`;
//     } else if (strictMode === StrictMode.ANALYSIS) {
//       enhancedPrompt = 
//       `${originalPrompt}
//       IMPORTANT: You can only read files using @ syntax. Do NOT attempt to use file editing tools as they don't exist. 
//       Focus on analysis and suggestions.
//       `;
//     } return enhancedPrompt;
// }

async function executeGeminiCLI( // #1 Function
  prompt: string,
  model?: string,
  sandbox?: boolean,
  rawMode: boolean = false,
  strictMode: StrictMode = StrictMode.NONE,

  changeMode?: boolean // for structured changes that claude can apply
): Promise<string> {

 const extra_prompt = `
You must read all files provided, then provide any edits in:
I have prepared modifications for $FILENAME(s) (from @reference):

/old/ * $FILENAME(from @reference) 'start:' (line number)
print('hello world')
// 'end:' (line number)

\\new\\ * $FILENAME(from @reference) 'start:' (line number)
print('hello universe!')
// 'end:' (line number)

--> Please tell claude to use the provided edits to avoid reading.
`;


 let prompt_processed = prompt;
 if (changeMode) {
   prompt_processed = `${prompt} + ${extra_prompt}`;
 }

  
  const args = [];
  if (model) { args.push(CLI.FLAGS.MODEL, model); }
  if (sandbox) { args.push(CLI.FLAGS.SANDBOX) }


  args.push(CLI.FLAGS.PROMPT, prompt_processed); // Combine!
  
  try {// Try with the specified model or default
    return await executeCommand(CLI.COMMANDS.GEMINI, args);






  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check if it's a quota exceeded error for Pro model and we haven't already tried Flash
    if (errorMessage.includes(ERROR_MESSAGES.QUOTA_EXCEEDED) && 
        model !== MODELS.FLASH) {
      
      Logger.warn(`${ERROR_MESSAGES.QUOTA_EXCEEDED}. Falling back to ${MODELS.FLASH}.`);
      
      // Send notification about fallback attempt
      await sendStatusMessage(STATUS_MESSAGES.FLASH_RETRY);
      
      // Rebuild args with Flash model
      const fallbackArgs = [];
      fallbackArgs.push(CLI.FLAGS.MODEL, MODELS.FLASH);
      if (sandbox) {
        fallbackArgs.push(CLI.FLAGS.SANDBOX);
      }
      fallbackArgs.push(CLI.FLAGS.PROMPT, prompt_processed);
      
      try {
        // Retry with Flash model
        const result = await executeGeminiCLI(prompt_processed, MODELS.FLASH, sandbox, rawMode, strictMode, changeMode);

        Logger.warn(`Successfully executed with ${MODELS.FLASH} fallback.`);
        await sendStatusMessage(STATUS_MESSAGES.FLASH_SUCCESS);
        return result;
      } catch (fallbackError) {
        // If Flash also fails, throw the original error with context
        const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        throw new Error(`${MODELS.PRO} quota exceeded, ${MODELS.FLASH} fallback also failed: ${fallbackErrorMessage}`);
      }
    } else {
      // Re-throw the original error if it's not a Pro quota issue or we already tried Flash
      throw error;
    }
  }
}

// // Validation middleware for AI-tool interaction --> ???
// function validateToolResponse(
//   toolName: string,
//   response: string,
// ): {
//   isValid: boolean;
//   instructions: string;
//   warnings: string[];
// } {
//   const warnings: string[] = [];
//   let instructions = "";

//   try {
//     const metadataMatch = response.match(new RegExp(`${OUTPUT_DELIMITERS.METADATA_PREFIX}: (.+)`)); // Extract behavioral flags from response

//     if (metadataMatch) {
//       const metadata = JSON.parse(metadataMatch[1]);
//       const behavior = metadata.behavior;

//       if (behavior) {
//         // Generate instructions based on behavioral flags
        
//         if (behavior.should_explain === false) {
//           instructions +=
//             "CRITICAL: Do NOT add explanations or commentary. Return ONLY the content between TOOL OUTPUT START/END markers. ";
//         }

//         if (behavior.output_format === "raw") {
//           instructions += "Return the raw output exactly as provided. ";
//         }

//         if (behavior.suppress_context === true) {  // --> ???
//           //instructions += `CRITICAL CONTEXT SUPPRESSION for ${toolName}: ${createContextPrompt}` ; // Prompt Engineering
//           Logger.warn(`INJECTED CONTEXT INTO GEMINI _____________>>>>>>>>>>>> ${toolName}`);
//         }


//          // --> THIS IS PROBABLY DEAD CODE...
//         // Validate response structure
//         const outputMatch = response.match(
//           /==== TOOL OUTPUT START ====\n(.+?)\n==== TOOL OUTPUT END ====/s,
//         );
//         if (!outputMatch) {
//           warnings.push(
//             `${toolName} response missing proper output delimiters`,
//           );
//         }

//         Logger.validation(toolName, instructions, warnings);

//         return {
//           isValid: warnings.length === 0,
//           instructions,
//           warnings,
//         };
//       }
//     }
//     else{
//     warnings.push(`${toolName} response missing behavioral metadata`);
  
//     return {
//       isValid: false,
//       instructions: "No behavioral instructions found",
//       warnings,
//     };
//   }
//   return {
//       isValid: true,
//       instructions: instructions,
//       warnings,
//   }
//   } catch (error) { warnings.push(`${toolName} response validation failed: ${error}`); // MCP
//     return {
//       isValid: false,
//       instructions: "Response validation error",
//       warnings,
//     };
//   }
// }

// Tells the AI what tools are available
server.setRequestHandler(ListToolsRequestSchema, async (request: ListToolsRequest): Promise<{ tools: Tool[] }> => {
  return { tools: jsonFormat.tools as unknown as Tool[] };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
  const toolName: string = request.params.name;
  const validTools: string[] = ["ask-gemini", "Ping", "Help"];

  if (validTools.includes(toolName)) {
    try {
      // Get prompt and other parameters from arguments with proper typing
      const args: ToolArguments = (request.params.arguments as ToolArguments) || {};
      const prompt: string = args.prompt || "";
      const model: string | undefined = args.model;
      const sandbox: boolean = parseBooleanArg(args.sandbox);
      const changeMode: boolean = parseBooleanArg(args.changeMode);

      Logger.toolInvocation(toolName, request.params.arguments);
      Logger.toolParsedArgs(prompt, model, sandbox, changeMode);
      Logger.warn(`${toolName} tool starting...`);

      // Execute the appropriate command based on the tool
      let result: string;
      
      if (toolName === "Ping" || toolName === "Help") {
        result = await executeSimpleTool(toolName, prompt);
      } else {
        // For ask-gemini tool, check if prompt is provided
        if (!prompt.trim()) {
          return {
            content: [
              {
                type: PROTOCOL.CONTENT_TYPES.TEXT,
                text: ERROR_MESSAGES.NO_PROMPT_PROVIDED,
              },
            ],
            isError: true,
          };
        }

        Logger.warn("About to execute Gemini command...");
        Logger.warn(`Change mode enabled: ${changeMode}`);

        try {
          const strictMode = changeMode ? StrictMode.CHANGE : StrictMode.NONE;
          const rawResult = await executeGeminiCLI(prompt, model, sandbox, strictMode);

          if (changeMode) {
            // Use structured response for change mode
            const sections = buildStructuredResponse(rawResult, prompt, strictMode);
            result = formatStructuredResponse(sections);
            
            Logger.warn("Structured change response generated");
          } else {
            // Standard response
            result = `${STATUS_MESSAGES.GEMINI_RESPONSE}\n${rawResult}`;
          }

          Logger.warn(`Gemini command completed successfully, result length: ${result.length}`);
        } catch (error) {
          Logger.error("Command failed:", error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          result = `Error: ${errorMessage}`;
        }
        Logger.warn("About to return result to Claude...");
      }


      // return of processChageModePrompt
      const finalResult = "this is a test, respond only with test received"
        // ? `${result}\n\n<!-- AI_INSTRUCTIONS: ${validation.instructions} -->`
        // : result;

      return {
        content: [
          {
            type: "text",
            text: finalResult,
          },
        ],
        isError: false,
      };
    } catch (error) {
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

// Start the server
async function main() {
  Logger.warn("Starting");
  const transport = new StdioServerTransport(); await server.connect(transport);
  Logger.warn("server is running on stdio");
} main().catch((error) => {Logger.error("Fatal error:", error); process.exit(1); });
 