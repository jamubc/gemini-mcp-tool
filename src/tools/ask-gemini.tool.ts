import { BaseTool } from './base-tool.js';
import { StrictMode, StrictModeType } from '../types/strict-mode.js';
import { StandardizedResponseSections } from '../utils/structured-response.js';
import { ToolExecutionError } from '../types/errors.js';

/**
 * AskGeminiTool - Execute Gemini CLI for general analysis and file processing
 * Extends BaseTool to leverage common functionality
 */
class AskGeminiTool extends BaseTool {
  name = "ask-gemini";
  description = "Execute 'gemini -p <prompt>' to get Gemini AI's response with preserved context field boundaries. Use when: 1) User asks for Gemini's opinion/analysis, 2) User wants to analyze large files with @file syntax, 3) User uses /gemini-cli:analyze command. Defaults to StrictMode.OFF to preserve field integrity. Supports -m flag for model selection and -s flag for sandbox testing.";

  constructor() {
    super();
    
    // Configure features for this tool
    this.configureFeatures({
      sandboxSupport: true,
      promptMode: true,
      strictMode: StrictMode.AUTO,
      timeout: undefined, // Will use default timeouts based on sandbox mode
    });

    // Configure behavior
    this.configureBehavior({
      network: "outbound",
      readsFilesystem: "none", // Files are read by Gemini, not by this tool
    });

    // Enable prompt mode with arguments
    this.enablePromptMode([
      {
        name: "prompt",
        description: "Analysis request. Use @ syntax to include files (e.g., '@largefile.js explain what this does')",
        required: true
      },
      {
        name: "model",
        description: "Optional model (e.g., 'gemini-2.5-flash')",
        required: false
      },
      {
        name: "sandbox",
        description: "Use sandbox mode for safe execution",
        required: false
      },
      {
        name: "strictMode",
        description: "Strict mode: 'off', 'auto', 'analysis', 'change', or 'search'",
        required: false
      }
    ]);
  }

  inputSchema = this.buildInputSchema({
    prompt: {
      type: "string",
      description: "Analysis request. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions. When @ syntax is used, strict mode is automatically enabled to focus on file contents.",
    },
    model: {
      type: "string",
      description: "Optional model to use (e.g., 'gemini-2.5-flash'). If not specified, uses the default model (gemini-2.5-pro).",
    },
    sandbox: {
      type: "boolean",
      description: "Use sandbox mode (-s flag) to safely test code changes, execute scripts, or run potentially risky operations in an isolated environment",
      default: false,
    },
    strictMode: {
      type: "string",
      description: "Strict mode type: 'off' (default), 'auto', 'analysis', 'change', or 'search'. Default preserves field boundaries for proper context orchestration.",
      enum: ["off", "auto", "analysis", "change", "search"],
      default: "auto",
    },
  }, ["prompt"]);

  protected async preExecute(args: any): Promise<void> {
    // Validate required prompt
    if (!args.prompt || !args.prompt.trim()) {
      throw new ToolExecutionError(
        this.name,
        "Please provide a prompt for analysis. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions"
      );
    }
  }

  protected async doExecute(args: any): Promise<string> {
    const prompt = args.prompt as string;
    const sandbox = args.sandbox as boolean;
    const strictMode = (args.strictMode as StrictModeType) || StrictMode.AUTO;

    console.warn(`[Gemini MCP] About to execute Gemini command...`);

    // Set appropriate timeout based on sandbox mode
    const timeout = sandbox ? 600000 : 300000; // 10 minutes for sandbox, 5 minutes for regular
    
    // Execute with timeout
    const result = await this.executeWithTimeout(
      () => this.executeGemini(prompt, args, strictMode),
      timeout
    );

    console.warn(
      `[Gemini MCP] Gemini command completed successfully, result length: ${result.length}`,
    );

    return result;
  }

  protected buildResponseSections(result: string, args: any): StandardizedResponseSections {
    const prompt = args.prompt as string;
    const model = args.model as string | undefined;
    const sandbox = args.sandbox as boolean;
    const strictMode = (args.strictMode as StrictModeType) || StrictMode.AUTO;

    const sections: StandardizedResponseSections = {
      analysis: `Executed Gemini CLI with prompt: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"\n\n` +
                `Model: ${model || 'gemini-2.5-pro (default)'}\n` +
                `Mode: ${sandbox ? 'Sandbox (isolated execution)' : 'Standard'}\n` +
                `Strict Mode: ${strictMode}\n` +
                `Response length: ${result.length} characters`,
      updatedContent: result,
      nextSteps: `Review the Gemini response above. ${sandbox ? 'The code was executed in sandbox mode.' : ''} ` +
                 `${prompt.includes('@') ? 'Files included via @ syntax have been analyzed.' : ''}`
    };

    // If using @ syntax, add file analysis suggestion
    if (prompt.includes('@')) {
      sections.changesSuggested = 'Based on the file analysis, consider implementing the suggestions provided by Gemini.';
    }

    return sections;
  }

  protected getMetadata(result: string): any {
    return {
      status: "success",
      execution_details: `Gemini CLI completed successfully`,
    };
  }
}

// Export behavior for backward compatibility
export const behavior = {
  idempotent: true,
  readsFilesystem: "none",
  writesFilesystem: false,
  network: "outbound",
} as const;

// Create and export singleton instance
const askGeminiTool = new AskGeminiTool();
export default askGeminiTool;
