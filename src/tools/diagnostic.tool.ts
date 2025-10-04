import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { executeCommand } from '../utils/commandExecutor.js';
import { CLI } from '../constants.js';

// gemini_version: get Gemini CLI version information
const versionArgsSchema = z.object({});

export const geminiVersionTool: UnifiedTool = {
  name: "gemini_version",
  description: "Get Gemini CLI version information with 30-minute cache TTL for optimal performance",
  zodSchema: versionArgsSchema,
  prompt: {
    description: "Retrieve Gemini CLI version information for diagnostics and compatibility checks",
  },
  category: 'utility',
  execute: async (args, onProgress) => {
    try {
      const result = await executeCommand(CLI.COMMANDS.GEMINI, ["--version"], onProgress);
      return `✅ Gemini CLI Version Information:\n${result}`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to retrieve Gemini CLI version: ${errorMessage}`);
    }
  }
};

// gemini_help: get Gemini CLI help information
const helpArgsSchema = z.object({});

export const geminiHelpTool: UnifiedTool = {
  name: "gemini_help",
  description: "Get comprehensive Gemini CLI help information with 30-minute cache TTL",
  zodSchema: helpArgsSchema,
  prompt: {
    description: "Access complete Gemini CLI documentation and command reference",
  },
  category: 'utility',
  execute: async (args, onProgress) => {
    try {
      const result = await executeCommand(CLI.COMMANDS.GEMINI, ["--help"], onProgress);
      return `✅ Gemini CLI Help Information:\n${result}`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to retrieve Gemini CLI help: ${errorMessage}`);
    }
  }
};

// gemini_models: list all available Gemini AI models
const modelsArgsSchema = z.object({});

export const geminiModelsTool: UnifiedTool = {
  name: "gemini_models",
  description: "List all available Gemini AI models with their capabilities and specifications",
  zodSchema: modelsArgsSchema,
  prompt: {
    description: "Retrieve comprehensive list of available Gemini AI models for model selection",
  },
  category: 'utility',
  execute: async (args, onProgress) => {
    const knownModels = [
      "gemini-2.5-pro - Advanced reasoning and complex tasks (default)",
      "gemini-2.5-flash - Fast responses with efficiency and cost optimization",
      "gemini-1.5-pro - Stable performance for general use",
      "gemini-1.5-flash - Speed-optimized general purpose model",
      "gemini-1.0-pro - Legacy compatibility"
    ];

    const modelInfo = `✅ Available Gemini AI Models:

${knownModels.join('\n')}

Model Selection:
- Use the -m or --model flag to specify a model
- Example: gemini -m gemini-2.5-flash -p "your prompt"
- If no model is specified, gemini-2.5-pro is used by default

Capabilities:
- All models support text generation
- gemini-2.5-* models offer improved reasoning
- *-flash models optimize for speed and cost
- Use gemini -h for more information on model usage`;

    return modelInfo;
  }
};
