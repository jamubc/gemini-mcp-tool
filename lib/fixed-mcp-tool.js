#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListPromptsRequestSchema,
    GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
// import { Logger } from "../package/dist/utils/logger.js"; // Removed - using console instead
import { PROTOCOL } from "./fixed-constants.js";
import { executeGeminiCLI, getChunkedEdits } from "./fixed-geminiExecutor.js";

const server = new Server({
    name: "gemini-cli-mcp-fixed",
    version: "1.1.4-fixed",
}, {
    capabilities: {
        tools: {},
        prompts: {},
        notifications: {},
        logging: {},
    },
});

let isProcessing = false;
let currentOperationName = "";
let latestOutput = "";

async function sendNotification(method, params) {
    try {
        await server.notification({ method, params });
    }
    catch (error) {
        console.error("notification failed: ", error);
    }
}

async function sendProgressNotification(progressToken, progress, total, message) {
    if (!progressToken)
        return;
    try {
        const params = {
            progressToken,
            progress
        };
        if (total !== undefined)
            params.total = total;
        if (message)
            params.message = message;
        await server.notification({
            method: PROTOCOL.NOTIFICATIONS.PROGRESS,
            params
        });
    }
    catch (error) {
        console.error("Progress notification failed: ", error);
    }
}

// Tool definitions
const tools = [
    {
        name: "ask-gemini",
        description: "model selection [-m], sandbox [-s], and changeMode:boolean for providing edits",
        inputSchema: {
            type: "object",
            properties: {
                prompt: {
                    type: "string",
                    minLength: 1,
                    description: "Analysis request. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions"
                },
                model: {
                    type: "string",
                    description: "Optional model to use (e.g., 'gemini-2.5-flash'). If not specified, uses the default model (gemini-2.5-pro)."
                },
                sandbox: {
                    type: "boolean",
                    default: false,
                    description: "Use sandbox mode (-s flag) to safely test code changes, execute scripts, or run potentially risky operations in an isolated environment"
                },
                changeMode: {
                    type: "boolean",
                    default: false,
                    description: "Enable structured change mode - formats prompts to prevent tool errors and returns structured edit suggestions that Claude can apply directly"
                },
                chunkIndex: {
                    type: ["number", "string"],
                    description: "Which chunk to return (1-based)"
                },
                chunkCacheKey: {
                    type: "string",
                    description: "Optional cache key for continuation"
                },
                powershellPath: {
                    type: "string",
                    description: "Optional custom PowerShell executable path (e.g., 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' or 'pwsh'). If not specified, auto-detects available PowerShell."
                }
            },
            required: ["prompt"]
        }
    },
    {
        name: "ping",
        description: "Echo",
        inputSchema: {
            type: "object",
            properties: {
                prompt: {
                    type: "string",
                    default: "",
                    description: "Message to echo "
                }
            },
            required: []
        }
    },
    {
        name: "Help",
        description: "receive help information",
        inputSchema: {
            type: "object",
            properties: {},
            required: []
        }
    },
    {
        name: "brainstorm",
        description: "Generate novel ideas with dynamic context gathering. --> Creative frameworks (SCAMPER, Design Thinking, etc.), domain context integration, idea clustering, feasibility analysis, and iterative refinement.",
        inputSchema: {
            type: "object",
            properties: {
                prompt: {
                    type: "string",
                    minLength: 1,
                    description: "Primary brainstorming challenge or question to explore"
                },
                model: {
                    type: "string",
                    description: "Optional model to use (e.g., 'gemini-2.5-flash'). If not specified, uses the default model (gemini-2.5-pro)."
                },
                methodology: {
                    type: "string",
                    enum: ["divergent", "convergent", "scamper", "design-thinking", "lateral", "auto"],
                    default: "auto",
                    description: "Brainstorming framework: 'divergent' (generate many ideas), 'convergent' (refine existing), 'scamper' (systematic triggers), 'design-thinking' (human-centered), 'lateral' (unexpected connections), 'auto' (AI selects best)"
                },
                domain: {
                    type: "string",
                    description: "Domain context for specialized brainstorming (e.g., 'software', 'business', 'creative', 'research', 'product', 'marketing')"
                },
                constraints: {
                    type: "string",
                    description: "Known limitations, requirements, or boundaries (budget, time, technical, legal, etc.)"
                },
                existingContext: {
                    type: "string",
                    description: "Background information, previous attempts, or current state to build upon"
                },
                ideaCount: {
                    type: "integer",
                    exclusiveMinimum: 0,
                    default: 12,
                    description: "Target number of ideas to generate (default: 10-15)"
                },
                includeAnalysis: {
                    type: "boolean",
                    default: true,
                    description: "Include feasibility, impact, and implementation analysis for generated ideas"
                },
                powershellPath: {
                    type: "string",
                    description: "Optional custom PowerShell executable path (e.g., 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' or 'pwsh'). If not specified, auto-detects available PowerShell."
                }
            },
            required: ["prompt"]
        }
    },
    {
        name: "fetch-chunk",
        description: "Retrieves cached chunks from a changeMode response. Use this to get subsequent chunks after receiving a partial changeMode response.",
        inputSchema: {
            type: "object",
            properties: {
                cacheKey: {
                    type: "string",
                    description: "The cache key provided in the initial changeMode response"
                },
                chunkIndex: {
                    type: "number",
                    minimum: 1,
                    description: "Which chunk to retrieve (1-based index)"
                }
            },
            required: ["cacheKey", "chunkIndex"]
        }
    },
    {
        name: "timeout-test",
        description: "Test timeout prevention by running for a specified duration",
        inputSchema: {
            type: "object",
            properties: {
                duration: {
                    type: "number",
                    minimum: 10,
                    description: "Duration in milliseconds (minimum 10ms)"
                }
            },
            required: ["duration"]
        }
    }
];

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    console.error(`[GMCPT] Tool called: ${name}`);
    console.error(`[GMCPT] Arguments:`, JSON.stringify(args, null, 2));
    
    if (!args) {
        return {
            content: [{
                type: "text",
                text: "Error: No arguments provided"
            }],
            isError: true
        };
    }
    
    try {
        switch (name) {
            case "ask-gemini":
                const { prompt, model, sandbox, changeMode, chunkIndex, chunkCacheKey, powershellPath } = args;
                console.error('[GMCPT] ask-gemini tool called with prompt: ' + (prompt && typeof prompt === 'string' ? prompt.substring(0, 50) + '...' : 'undefined'));
                console.error('[GMCPT] Model: ' + model + ', Sandbox: ' + sandbox + ', ChangeMode: ' + changeMode);
                if (powershellPath) {
                    console.error('[GMCPT] Custom PowerShell path: ' + powershellPath);
                }
                
                if (chunkCacheKey && chunkIndex) {
                    const result = getChunkedEdits(chunkCacheKey, parseInt(chunkIndex));
                    return {
                        content: [{
                            type: "text",
                            text: result
                        }]
                    };
                }
                
                console.error('[GMCPT] About to call executeGeminiCLI...');
                console.log('[MCP-TOOL] About to call executeGeminiCLI with:');
                console.log('[MCP-TOOL] - prompt length:', prompt ? prompt.length : 'undefined');
                console.log('[MCP-TOOL] - model:', model);
                console.log('[MCP-TOOL] - sandbox:', sandbox);
                console.log('[MCP-TOOL] - changeMode:', changeMode);
                console.log('[MCP-TOOL] - powershellPath:', powershellPath);
                
                const result = await executeGeminiCLI(prompt, model, sandbox, changeMode, powershellPath);
                
                console.log('[MCP-TOOL] executeGeminiCLI returned:');
                console.log('[MCP-TOOL] - result type:', typeof result);
                console.log('[MCP-TOOL] - result length:', result ? result.length : 'null');
                console.log('[MCP-TOOL] - result preview:', result && typeof result === 'string' ? result.substring(0, 100) + '...' : 'null');
                console.error('[GMCPT] executeGeminiCLI completed')
                console.error('[GMCPT] Result type:', typeof result);
                console.error('[GMCPT] Result is string:', typeof result === 'string');
                console.error('[GMCPT] Result length:', result ? result.length : 'undefined');
                console.error('[GMCPT] Result preview:', result && typeof result === 'string' ? result.substring(0, 100) : 'undefined');
                
                // Ensure result is a string
                const textResult = typeof result === 'string' ? result : JSON.stringify(result);
                
                return {
                    content: [{
                        type: "text",
                        text: textResult
                    }]
                };
                
            case "ping":
                return {
                    content: [{
                        type: "text",
                        text: `Pong! ${args.prompt || 'Hello from gemini-cli MCP server!'}`
                    }]
                };
                
            case "Help":
                return {
                    content: [{
                        type: "text",
                        text: "Gemini CLI MCP Tool - Fixed Version\n\nAvailable commands:\n- ask-gemini: Interact with Gemini CLI\n- ping: Test connection\n- Help: Show this help\n- brainstorm: Generate novel ideas with creative frameworks\n- fetch-chunk: Retrieve cached chunks from changeMode responses\n- timeout-test: Test timeout prevention"
                    }]
                };
                
            case "brainstorm":
                const { 
                    prompt: brainstormPrompt, 
                    model: brainstormModel, 
                    methodology, 
                    domain, 
                    constraints, 
                    existingContext, 
                    ideaCount, 
                    includeAnalysis,
                    powershellPath: brainstormPowershellPath
                } = args;
                
                console.error('[GMCPT] brainstorm tool called with prompt: ' + (brainstormPrompt ? brainstormPrompt.slice(0, 50) + '...' : 'undefined'));
                console.error('[GMCPT] Methodology: ' + methodology + ', Domain: ' + domain);
                
                // Build enhanced brainstorming prompt
                let enhancedPrompt = `BRAINSTORMING SESSION\n\nChallenge: ${brainstormPrompt}\n\n`;
                
                if (methodology && methodology !== 'auto') {
                    enhancedPrompt += `Framework: Use ${methodology} methodology for idea generation.\n`;
                }
                
                if (domain) {
                    enhancedPrompt += `Domain Context: ${domain}\n`;
                }
                
                if (constraints) {
                    enhancedPrompt += `Constraints: ${constraints}\n`;
                }
                
                if (existingContext) {
                    enhancedPrompt += `Background: ${existingContext}\n`;
                }
                
                enhancedPrompt += `\nGenerate ${ideaCount || 12} creative and diverse ideas. `;
                
                if (includeAnalysis !== false) {
                    enhancedPrompt += `For each idea, provide a brief feasibility assessment and potential impact.`;
                }
                
                const brainstormResult = await executeGeminiCLI(enhancedPrompt, brainstormModel, false, false, brainstormPowershellPath);
                return {
                    content: [{
                        type: "text",
                        text: brainstormResult
                    }]
                };
                
            case "fetch-chunk":
                const { cacheKey, chunkIndex: fetchChunkIndex } = args;
                console.error('[GMCPT] fetch-chunk tool called with cacheKey: ' + cacheKey + ', chunkIndex: ' + fetchChunkIndex);
                
                try {
                    const chunkResult = getChunkedEdits(cacheKey, parseInt(fetchChunkIndex));
                    
                    // Format the chunk information
                    const chunkInfo = `CHUNK ${chunkResult.chunk}/${chunkResult.totalChunks} (Cache Key: ${chunkResult.cacheKey})\n\n${chunkResult.content}`;
                    
                    if (chunkResult.hasMore) {
                        const nextChunk = chunkResult.chunk + 1;
                        const remainingChunks = chunkResult.totalChunks - chunkResult.chunk;
                        return {
                            content: [{
                                type: "text",
                                text: chunkInfo + `\n\n[Use fetch-chunk tool with cacheKey "${chunkResult.cacheKey}" and chunkIndex ${nextChunk}-${chunkResult.totalChunks} to get remaining ${remainingChunks} chunks]`
                            }]
                        };
                    } else {
                        return {
                            content: [{
                                type: "text",
                                text: chunkInfo + "\n\n[This is the final chunk]" 
                            }]
                        };
                    }
                } catch (error) {
                    return {
                        content: [{
                            type: "text",
                            text: `Error retrieving chunk: ${error.message}`
                        }]
                    };
                }
                
            case "timeout-test":
                const { duration } = args;
                console.error('[GMCPT] timeout-test tool called with duration: ' + duration + 'ms');
                
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve({
                            content: [{
                                type: "text",
                                text: `Timeout test completed after ${duration}ms`
                            }]
                        });
                    }, Math.max(10, duration));
                });
                
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        console.error(`Error executing ${name}: ${error.message}`);
        return {
            content: [{
                type: "text",
                text: `Error executing ${name}: ${error.message}`
            }],
            isError: true
        };
    }
});

// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("[GMCPT] Gemini CLI MCP Server (Fixed) started");
}

main().catch((error) => {
    console.error("Server failed to start:", error);
    process.exit(1);
});