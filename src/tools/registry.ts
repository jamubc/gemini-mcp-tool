import { Tool, Prompt } from "@modelcontextprotocol/sdk/types.js"; // Each tool definition includes its metadata, schema, prompt, and execution logic in one place.

import { ToolArguments } from "../constants.js";
import { ZodTypeAny, ZodError } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export interface UnifiedTool {
  name: string;
  description: string;
  zodSchema: ZodTypeAny;
  
  prompt?: {
    description: string;
    arguments?: Array<{
      name: string;
      description: string;
      required: boolean;
    }>;
  };
  
  execute: (args: ToolArguments, onProgress?: (newOutput: string) => void) => Promise<string>;
  category?: 'simple' | 'gemini' | 'utility';
}

export const toolRegistry: UnifiedTool[] = [];
export function toolExists(toolName: string): boolean {
  return toolRegistry.some(t => t.name === toolName);
}
export function getToolDefinitions(): Tool[] { // get Tool definitions from registry
  return toolRegistry.map(tool => {
    const raw = zodToJsonSchema(tool.zodSchema, tool.name) as any;
    const def = raw.definitions?.[tool.name] ?? raw;
    const inputSchema: Tool['inputSchema'] = {
      type: "object",
      properties: def.properties || {},
      required: def.required || [],
    };
    
    return {
      name: tool.name,
      description: tool.description,
      inputSchema,
    };
  });
}

function extractPromptArguments(zodSchema: ZodTypeAny): Array<{name: string; description: string; required: boolean}> {
  const jsonSchema = zodToJsonSchema(zodSchema) as any;
  const properties = jsonSchema.properties || {};
  const required = jsonSchema.required || [];
  
  return Object.entries(properties).map(([name, prop]: [string, any]) => ({
    name,
    description: prop.description || `${name} parameter`,
    required: required.includes(name)
  }));
}

export function getPromptDefinitions(): Prompt[] { // Helper to get MCP Prompt definitions from registry
  return toolRegistry
    .filter(tool => tool.prompt)
    .map(tool => ({
      name: tool.name,
      description: tool.prompt!.description,
      arguments: tool.prompt!.arguments || extractPromptArguments(tool.zodSchema),
    }));
}

export async function executeTool(toolName: string, args: ToolArguments, onProgress?: (newOutput: string) => void): Promise<string> {
  const tool = toolRegistry.find(t => t.name === toolName);
  if (!tool) { throw new Error(`Unknown tool: ${toolName}`); } try { const validatedArgs = tool.zodSchema.parse(args);
    return tool.execute(validatedArgs, onProgress);
  } catch (error) { if (error instanceof ZodError) {
      const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      throw new Error(`Invalid arguments for ${toolName}: ${issues}`);
    }
    throw error;
  }
}

export function getPromptMessage(toolName: string, args: Record<string, any>): string {
  const tool = toolRegistry.find(t => t.name === toolName);
  if (!tool?.prompt) {
    throw new Error(`No prompt defined for tool: ${toolName}`);
  }
  const paramStrings: string[] = [];
  
  if (args.prompt) {
    paramStrings.push(args.prompt);
  }

  Object.entries(args).forEach(([key, value]) => {
    if (key !== 'prompt' && value !== undefined && value !== null && value !== false) {
      if (typeof value === 'boolean' && value) {
        paramStrings.push(`[${key}]`);
      } else if (typeof value !== 'boolean') {
        paramStrings.push(`(${key}: ${value})`);
      }
    }
  });
  
  return `Use the ${toolName} tool${paramStrings.length > 0 ? ': ' + paramStrings.join(' ') : ''}`;
}