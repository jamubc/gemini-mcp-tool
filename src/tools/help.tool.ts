import { Tool } from './index.js';
import { runShell } from '../utils/run-shell.js';
import { createStructuredResponse } from '../utils/structured-response.js';
import { ToolExecutionError } from '../types/errors.js';
import { sanitize } from '../utils/error-sanitizer.js';

const helpTool: Tool = {
  name: "Help",
  description:
    "Run 'gemini -help' with structured response. BEHAVIOR: should_explain=false, output_format=raw, suppress_context=true.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },

  async execute(args: any): Promise<string> {
    try {
      // Run gemini --help with structured response
      const startTime = Date.now();
      const exec = await runShell("gemini", ["-help"]);
      const endTime = Date.now();
      
      if (!exec.ok) {
        throw new ToolExecutionError('Help', `Failed to execute help command: ${sanitize(exec.err)}`);
      }
      
      let rawOutput = exec.out;

      const mcpHelp = [
        'Gemini MCP Tool — bridge Claude/MCP to the Gemini CLI',
        '',
        'Core CLI Flags',
        '  -m, --model <name>     Select model (default: gemini-2.5-pro)',
        '  -p, --prompt <text>    Provide prompt text',
        '  -a, --all_files        Include every file in context',
        '  -y, --yolo             Auto-accept actions',
        '',
        'Workspace & Context',
        '  --cwd <path>           Launch or auto-restart server in <path>',
        '                        (when switching repos). Works with absolute @file refs.',
        '  @file / @dir syntax    Embed file or dir contents in prompts',
        '',
        'Safety & Testing',
        '  -s, --sandbox          Safe code execution in sandbox',
        '  -c, --checkpointing    Enable file-edit checkpoints',
        '',
        'Debug & Telemetry',
        '  -d, --debug            Verbose logging',
        '  --telemetry            Send anonymous timing data',
        '',
        'Examples',
        '  Analyze other repo : gemini --cwd ../Other -p "summarize @README.md"',
        '  Safe script test   : gemini -s -p "test @script.py"',
        '',
        'See more docs → https://github.com/jamubc/gemini-mcp-tool/wiki',
      ].join('\n');

      const combinedOutput = `${rawOutput}\n\n---\n${mcpHelp}`;

      // Create structured response with behavioral flags
      const result = createStructuredResponse(
        combinedOutput,
        {
          idempotent: true,
          readsFilesystem: "none",
          writesFilesystem: false,
          network: "outbound",
          should_explain: false,
          output_format: "raw",
          context_needed: false,
          suppress_context: true, // Help should ignore all project context
        },
        {
          status: "success",
          timing: endTime - startTime,
          execution_details: "gemini -help command executed successfully",
        },
      );

      return result;
    } catch (error) {
      throw new ToolExecutionError('Help', `Failed to execute help command: ${sanitize(error)}`, error);
    }
  }
};

export const behavior = {
  idempotent: true,
  readsFilesystem: "none",
  writesFilesystem: false,
  network: "outbound",
} as const;

export default helpTool;