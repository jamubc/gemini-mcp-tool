import { BaseTool } from './base-tool.js';
import { StrictMode } from '../types/strict-mode.js';
import { parseSuggestedEdits } from '../utils/edit-parser.js';
import { StandardizedResponseSections } from '../utils/structured-response.js';
import { ToolExecutionError } from '../types/errors.js';

/**
 * AnalyzeForChangesTool - Analyze files and get structured change suggestions
 * Always uses CHANGE strict mode to format responses properly
 */
class AnalyzeForChangesTool extends BaseTool {
  name = "analyze-for-changes";
  description = "Analyze files with @ syntax and get structured change suggestions. Use when you need Gemini to suggest file modifications. Automatically formats prompts to prevent 'tool not found' errors and returns changes in a parseable format.";

  constructor() {
    super();
    
    // Configure features - always use CHANGE mode for this tool
    this.configureFeatures({
      strictMode: StrictMode.CHANGE, // Force CHANGE mode
      sandboxSupport: false,
      promptMode: false,
    });

    // Configure behavior
    this.configureBehavior({
      readsFilesystem: "relative",
    });
  }

  inputSchema = this.buildInputSchema({
    prompt: {
      type: "string",
      description: "Change request with @ syntax. Examples: '@file.js replace all instances of foo with bar' or '@style.css update the color scheme to dark mode'",
    },
    model: {
      type: "string",
      description: "Optional model to use (e.g., 'gemini-2.5-flash'). If not specified, uses the default model.",
    },
  }, ["prompt"]);

  protected async preExecute(args: any): Promise<void> {
    // Validate required prompt
    if (!args.prompt || !args.prompt.trim()) {
      throw new ToolExecutionError(
        this.name,
        "Please provide a change request with @ syntax. Examples: '@file.js replace all instances of foo with bar' or '@style.css update the color scheme to dark mode'"
      );
    }
  }

  protected async doExecute(args: any): Promise<string> {
    const prompt = args.prompt as string;

    console.warn(`[Gemini MCP] Running analyze-for-changes with enhanced strict mode...`);

    // Always use CHANGE mode for this tool
    const result = await this.executeGemini(prompt, args, StrictMode.CHANGE);

    console.warn(
      `[Gemini MCP] Analyze-for-changes completed successfully, result length: ${result.length}`,
    );

    return result;
  }

  protected buildResponseSections(result: string, args: any): StandardizedResponseSections {
    const prompt = args.prompt as string;
    
    let changesSuggested = '';
    let analysisContent = '';
    let nextSteps = '';
    
    if (result.includes("Tool") && result.includes("not found in registry")) {
      console.warn(`[Gemini MCP] Detected tool registry error, formatting guidance...`);
      analysisContent = `Analyzed file(s) using prompt: "${prompt}"\n\nGemini attempted to use unavailable tools for direct file editing.`;
      changesSuggested = result;
      nextSteps = "Gemini cannot directly edit files. To apply the suggested changes above:\n" +
                "• For single replacements: use Claude's Edit tool\n" +
                "• For multiple replacements in one file: use Claude's MultiEdit tool\n" +
                "• Alternative: use gemini-mcp-tool's 'replace' tool for simple string replacements";
    } else {
      // Try to parse structured edits
      const parsedResult = parseSuggestedEdits(result);
      if (parsedResult !== result) {
        // Structured edits were found and parsed
        analysisContent = `Analyzed file(s) using prompt: "${prompt}"\n\nFound structured change suggestions that have been parsed for easier application.`;
        changesSuggested = parsedResult;
        nextSteps = `To apply the changes:
` +
                `• For single replacements: use Claude's Edit tool
` +
                `• For multiple replacements in one file: use Claude's MultiEdit tool
` +
                `• Alternative: use gemini-mcp-tool's 'replace' tool for simple string replacements
` +
                `⚠️ Note: The OLD content must match EXACTLY including all whitespace and indentation`;
      } else {
        // No structured edits, return raw result
        analysisContent = `Analyzed file(s) using prompt: "${prompt}"\n\nGemini provided change analysis and suggestions.`;
        changesSuggested = result;
        nextSteps = `To apply the changes:
` +
                `• For single replacements: use Claude's Edit tool
` +
                `• For multiple replacements in one file: use Claude's MultiEdit tool
` +
                `• Alternative: use gemini-mcp-tool's 'replace' tool for simple string replacements
` +
                `⚠️ Note: The OLD content must match EXACTLY including all whitespace and indentation`;
      }
    }

    return {
      analysis: analysisContent,
      changesSuggested: changesSuggested,
      updatedContent: changesSuggested, // For analyze tool, the changes ARE the content
      nextSteps: nextSteps
    };
  }

  protected getMetadata(_result: string): any {
    return {
      status: "success",
      execution_details: `Analysis completed in change detection mode`,
    };
  }
}

// Export behavior for backward compatibility
export const behavior = {
  idempotent: true,
  readsFilesystem: "relative",
  writesFilesystem: false,
  network: "none",
} as const;

// Create and export singleton instance
const analyzeForChangesTool = new AnalyzeForChangesTool();
export default analyzeForChangesTool;
