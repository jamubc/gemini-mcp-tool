import { Tool, Prompt } from "@modelcontextprotocol/sdk/types.js";
import { ToolArguments } from "../constants.js";
import { ZodTypeAny } from "zod";
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
export declare const toolRegistry: UnifiedTool[];
export declare function toolExists(toolName: string): boolean;
export declare function getToolDefinitions(): Tool[];
export declare function getPromptDefinitions(): Prompt[];
export declare function executeTool(toolName: string, args: ToolArguments, onProgress?: (newOutput: string) => void): Promise<string>;
export declare function getPromptMessage(toolName: string, args: Record<string, any>): string;
//# sourceMappingURL=registry.d.ts.map