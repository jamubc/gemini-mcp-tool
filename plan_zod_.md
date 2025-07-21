# Zod Integration Plan for gemini-mcp-tool

## Objective
Introduce Zod-based schemas to replace hand-written JSON schemas, achieving:  
- Compile-time type safety and IntelliSense for tool arguments.  
- Runtime validation of incoming RPC payloads.  
- Automated derivation of JSON Schema for MCP `inputSchema` via `zod-to-json-schema`.  

## Background & Motivation
- **Current State**: Each `UnifiedTool` declares `inputSchema` manually (`properties: Record<string, any>`). Arguments drift easily, no compile-time type checking, and schemas can go out of sync.  
- **MCP Spec Requirements**: The MCP server must expose `Tool.inputSchema` as JSON Schema; clients rely on this for request validation.  
- **Zod**: A battle-tested TypeScript-first validation library. Zod schemas can be transformed into JSON Schema using [zod-to-json-schema](https://github.com/astrolabsoftware/zod-to-json-schema).  

## High-Level Steps
1. **Add Zod dependency**  
   `npm install zod zod-to-json-schema --save`  

2. **Extend `UnifiedTool`**  
   - Remove `inputSchema` field or mark it deprecated.  
   - Add a required `zodSchema: ZodTypeAny` property.  
   - Document in code comment that `zodSchema` drives both validation and JSON Schema derivation.  

3. **Update Registry Helpers**  
   - In `getToolDefinitions()`, replace `tool.inputSchema` with the result of converting `tool.zodSchema` to JSON Schema:  
   ```ts
   import { zodToJsonSchema } from 'zod-to-json-schema';  

   const jsonSchema = zodToJsonSchema(tool.zodSchema, tool.name);  
   return { name, description, inputSchema: jsonSchema };  
   ```
   - In `executeTool()`, before invoking `tool.execute(args)`, run `tool.zodSchema.parse(args)` to enforce validation at runtime.  

4. **Migrate One Example Tool (ping)**  
   - Replace its `inputSchema` block with:  
   ```ts
   import { z } from 'zod';  

   const pingArgs = z.object({  
     prompt: z.string().optional().default(''),  
     message: z.string().optional(),  
   });  

   export const pingTool: UnifiedTool = {  
     name: 'ping',  
     description: 'Echo test...',  
     zodSchema: pingArgs,  
     execute: async args => { ... }  
   };
   ```
   - Remove the old `inputSchema` property.  

5. **Test & Validate**  
   - Write unit tests to ensure `zodSchema.parse()` rejects invalid arguments.  
   - Confirm `getToolDefinitions()` output matches the MCP JSON Schema format.  
   - Run `npm run build` and smoke-test in a compliant MCP client (e.g. Claude Code).  

## Benefits
- Single source of truth: Types + runtime checks from one Zod definition.  
- Zero drift: Changes to argument types instantly reflect in JSON Schema.  
- Enhanced developer UX: IDE autocomplete for `args` inside each tool.  
- MCP compliance: Automated schema generation prevents manual errors.  

## What We DON’T Want
- Manual maintenance of separate JSON schemas and type definitions.  
- Runtime failures due to mismatched schemas.  
- Boilerplate duplication across tools.  
- Breaking the MCP spec by altering the RPC contract unexpectedly.  

## References
- MCP Spec: https://github.com/modelcontextprotocol/mcp-spec  
- Zod: https://github.com/colinhacks/zod  
- zod-to-json-schema: https://github.com/astrolabsoftware/zod-to-json-schema
