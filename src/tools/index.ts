// Tool loader - minimal system for dynamic tool loading
import { promises as fs } from "fs";
import { ToolBehavior } from "../types/tool-behavior.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
execute: (args: any) => Promise<string>;
  /** Optional declarative metadata about side-effects */
  behavior?: ToolBehavior;
  asPrompt?: {
    enabled: boolean;
    arguments?: Array<{
      name: string;
      description: string;
      required?: boolean;
    }>;
  };
}

class ToolLoader {
  private tools: Map<string, Tool> = new Map();

  async loadTools() {
    const toolsDir = __dirname;

    try {
      const files = await fs.readdir(toolsDir);

      for (const file of files) {
        if (file.endsWith(".tool.js") || file.endsWith(".tool.ts")) {
          try {
            const module = await import(path.join(toolsDir, file));
            if (module.default && this.isValidTool(module.default)) {
              // Attach exported behavior to tool if not already present
              if (module.behavior && !module.default.behavior) {
                module.default.behavior = module.behavior;
              }
              this.checkBehavior(module.default);
              this.tools.set(module.default.name, module.default);
            }
          } catch (error) {
            console.error(`[Gemini MCP] Failed to load tool ${file}:`, error);
          }
        }
      }
    } catch (error) {
      // Tools directory exists, so this shouldn't happen
      console.error("[Gemini MCP] Error loading tools:", error);
    }
  }

private isValidTool(tool: any): tool is Tool {
    return (
      typeof tool.name === "string" &&
      typeof tool.description === "string" &&
      tool.inputSchema &&
      typeof tool.execute === "function"
    );
  }

  /**
   * Naïve static analysis: warn if a non-mutating tool appears to write files.
   * This doesn’t guarantee safety but catches accidents.
   */
  private checkBehavior(tool: Tool) {
    if (!tool.behavior) return;
    try {
      const src = tool.execute.toString();
const mutatesFs = /fs\.(write(File|FileSync)|append|mkdir|rm|rmdir|unlink)/.test(src);
      if (mutatesFs && tool.behavior.writesFilesystem === false) {
        console.warn(`⚠️ [Gemini MCP] Tool '${tool.name}' may write to disk but behavior.writesFilesystem=false`);
      }
      // Network usage detection
      const netPattern = /(fetch\(|axios\.|http\.|https\.|undici|got\()/;
      const usesNetwork = netPattern.test(src);
      if (usesNetwork && tool.behavior.network === "none") {
        console.warn(`⚠️ [Gemini MCP] Tool '${tool.name}' appears to make network calls but behavior.network='none'`);
      }
    } catch {/* ignore */}
  }


  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getPromptTools(): Tool[] {
    return Array.from(this.tools.values()).filter(
      tool => tool.asPrompt?.enabled === true
    );
  }
}
export const toolLoader = new ToolLoader();
