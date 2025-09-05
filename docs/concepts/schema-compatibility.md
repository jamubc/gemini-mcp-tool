# Schema Compatibility

## The Problem: Divergent Tool Schemas

Different Large Language Models can have different levels of strictness when it comes to validating the schemas of the tools they are provided. For example, Google Gemini's API enforces a stricter subset of the JSON Schema specification than other models might.

A common issue is the use of complex schema types like `anyOf` (which is what `zod` produces for a `z.union`). While valid JSON Schema, Gemini's API may reject it, causing `400 Bad Request` errors and preventing the tool from being called.

A simple solution would be to make all schemas conform to the strictest possible requirements, but this would reduce the expressiveness and validation power of our internal schemas for models that *do* support them.

## The Solution: A Strategy-Based Approach

To solve this, we've implemented a **strategy-based pattern** that allows the server to dynamically select the appropriate schema for a tool parameter based on a startup configuration. This gives us the best of both worlds: strict, compatible schemas for models that need them, and rich, expressive schemas for those that don't.

The system is composed of two parts:

### 1. Startup Configuration

The server's "mode" is determined once at startup by the `--target-model` command-line flag or the `MCP_TARGET_MODEL` environment variable. This is managed in `@/src/utils/config.ts`.

```bash
# Start the server in Gemini compatibility mode
npx gemini-mcp-tool --target-model gemini
```

If no target is specified, it defaults to `'default'`.

### 2. Schema Strategies

The core of the solution is in `@/src/utils/schema-strategies.ts`. This file contains functions (strategies) that are responsible for choosing which Zod schema to use based on the `config.target`.

This approach keeps the conditional logic centralized and allows our tool definitions to remain clean and declarative.

## Developer Guide: Adding a Compatible Parameter

If you are adding a new tool parameter that requires a different schema for a specific target (like Gemini), follow this pattern. We will use the `chunkIndex` parameter in the `ask-gemini` tool as our example.

### Step 1: Define Both Schema Variations

In your tool definition file (e.g., `@/src/tools/ask-gemini.tool.ts`), define both the standard and the model-specific schemas as named constants.

The `gemini` version should be the simplest possible schema that the API will accept. It's also a good practice to include a `z.preprocess` step to gracefully handle any data that might still come in the "standard" format (e.g., a number) before validation.

```typescript
// @/src/tools/ask-gemini.tool.ts

// The standard, expressive schema for most models
const standardChunkIndexSchema = z.union([z.number(), z.string()]).optional().describe("Which chunk to return (1-based)");

// The simplified schema for Gemini's stricter API
const geminiChunkIndexSchema = z.preprocess(
  (val) => (val === undefined || val === null ? val : String(val)),
  z.string().optional()
).describe("Which chunk to return (1-based)");
```

### Step 2: Create or Update a Strategy

In `@/src/utils/schema-strategies.ts`, ensure there is a strategy function that can select the correct schema. If you're adding a parameter with a new compatibility need, you may need to add a new strategy function.

Our existing strategy for `chunkIndex` looks like this:

```typescript
// @/src/utils/schema-strategies.ts

export const selectChunkIndexSchema = (schemas: {
  standard: ZodTypeAny;
  gemini: ZodTypeAny;
}): ZodTypeAny => {
  if (config.target === 'gemini') {
    return schemas.gemini;
  }
  return schemas.standard;
};
```

### Step 3: Use the Strategy in Your Tool Definition

Finally, in your tool's main Zod schema, import and use the strategy function. Pass your previously defined schemas to it. This makes your definition declarative and clean.

```typescript
// @/src/tools/ask-gemini.tool.ts
import { selectChunkIndexSchema } from '../utils/schema-strategies.js';

// ... (schemas defined above) ...

const askGeminiArgsSchema = z.object({
  // ... other parameters
  chunkIndex: selectChunkIndexSchema({
    standard: standardChunkIndexSchema,
    gemini: geminiChunkIndexSchema,
  }),
  // ... other parameters
});
```

By following this pattern, you can easily support multiple model targets without cluttering your tool definitions with conditional logic.