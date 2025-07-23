import { ZodError } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
export const toolRegistry = [];
export function toolExists(toolName) {
    return toolRegistry.some(t => t.name === toolName);
}
export function getToolDefinitions() {
    return toolRegistry.map(tool => {
        const raw = zodToJsonSchema(tool.zodSchema, tool.name);
        const def = raw.definitions?.[tool.name] ?? raw;
        const inputSchema = {
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
function extractPromptArguments(zodSchema) {
    const jsonSchema = zodToJsonSchema(zodSchema);
    const properties = jsonSchema.properties || {};
    const required = jsonSchema.required || [];
    return Object.entries(properties).map(([name, prop]) => ({
        name,
        description: prop.description || `${name} parameter`,
        required: required.includes(name)
    }));
}
export function getPromptDefinitions() {
    return toolRegistry
        .filter(tool => tool.prompt)
        .map(tool => ({
        name: tool.name,
        description: tool.prompt.description,
        arguments: tool.prompt.arguments || extractPromptArguments(tool.zodSchema),
    }));
}
export async function executeTool(toolName, args, onProgress) {
    const tool = toolRegistry.find(t => t.name === toolName);
    if (!tool) {
        throw new Error(`Unknown tool: ${toolName}`);
    }
    try {
        const validatedArgs = tool.zodSchema.parse(args);
        return tool.execute(validatedArgs, onProgress);
    }
    catch (error) {
        if (error instanceof ZodError) {
            const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
            throw new Error(`Invalid arguments for ${toolName}: ${issues}`);
        }
        throw error;
    }
}
export function getPromptMessage(toolName, args) {
    const tool = toolRegistry.find(t => t.name === toolName);
    if (!tool?.prompt) {
        throw new Error(`No prompt defined for tool: ${toolName}`);
    }
    const paramStrings = [];
    if (args.prompt) {
        paramStrings.push(args.prompt);
    }
    Object.entries(args).forEach(([key, value]) => {
        if (key !== 'prompt' && value !== undefined && value !== null && value !== false) {
            if (typeof value === 'boolean' && value) {
                paramStrings.push(`[${key}]`);
            }
            else if (typeof value !== 'boolean') {
                paramStrings.push(`(${key}: ${value})`);
            }
        }
    });
    return `Use the ${toolName} tool${paramStrings.length > 0 ? ': ' + paramStrings.join(' ') : ''}`;
}
//# sourceMappingURL=registry.js.map