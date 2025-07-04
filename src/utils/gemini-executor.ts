import { runShell } from './run-shell.js';
import { resolveFilePaths } from './path-resolver.js';
import { StrictModeType, StrictMode, isValidStrictMode, fromBooleanStrictMode } from '../types/strict-mode.js';
import { GeminiCLIError } from '../types/errors.js';
import { sanitize } from './error-sanitizer.js';

/**
 * Executes Gemini CLI command with proper argument handling
 * @param prompt The prompt to pass to Gemini, including @ syntax
 * @param model Optional model to use (e.g., "gemini-2.5-flash") instead of (default "gemini-2.5-pro")
 * @param sandbox Whether to use sandbox mode (-s flag)
 * @param strictMode Strict mode type or legacy boolean (true maps to "auto", false to "off")
 * @returns Promise resolving to the command output
 */
export async function executeGeminiCLI(
  prompt: string,
  model?: string,
  sandbox?: boolean,
  strictMode: boolean | StrictModeType = StrictMode.AUTO,
): Promise<string> {
  // Check if prompt contains @ syntax for file/directory references
  const hasFileSyntax = /@[^\s]+/.test(prompt);

  // Resolve file paths if @ syntax is present
  const resolvedPrompt = hasFileSyntax ? await resolveFilePaths(prompt) : prompt;

  // Normalize strict mode value
  let mode: StrictModeType;
  if (typeof strictMode === 'boolean') {
    mode = fromBooleanStrictMode(strictMode);
  } else if (isValidStrictMode(strictMode)) {
    mode = strictMode;
  } else {
    mode = StrictMode.AUTO;
  }

  // Auto-detect mode if set to "auto"
  if (mode === StrictMode.AUTO) {
    if (hasFileSyntax) {
      // Check if prompt contains change-related keywords
      const changeKeywords = /\b(replace|change|modify|edit|update|fix|refactor|rename|delete|remove|add|insert)\b/i;
      const isChangeRequest = changeKeywords.test(prompt);
      mode = isChangeRequest ? StrictMode.CHANGE : StrictMode.ANALYSIS;
      console.warn(`[Gemini MCP] Auto-detected mode: ${mode} (@ syntax: yes, change keywords: ${isChangeRequest ? 'yes' : 'no'})`);
    } else {
      mode = StrictMode.OFF;
    }
  }

  // Apply prompt wrapper based on mode
  let finalPrompt = resolvedPrompt;
  
  switch (mode) {
    case StrictMode.OFF:
      // No wrapping, use prompt as-is
      break;
      
    case StrictMode.ANALYSIS:
      console.warn(`[Gemini MCP] Using analysis mode for file analysis`);
      finalPrompt = `=== STRICT MODE: FILE ANALYSIS REQUEST ===

INSTRUCTIONS FOR GEMINI:
1. The following prompt includes file contents via @ syntax
2. Focus ONLY on analyzing the provided files
3. Do NOT add speculation or unrelated information
4. Provide direct, factual analysis based on file contents
5. Return the actual file path when referencing files, not just descriptions

USER PROMPT:
${resolvedPrompt}

=== END OF REQUEST ===

IMPORTANT: Respond with analysis based solely on the file contents provided. When mentioning files, always include their full paths.`;
      break;
      
    case StrictMode.CHANGE:
      console.warn(`[Gemini MCP] Using change mode for modification suggestions`);
      finalPrompt = `=== STRICT MODE: FILE ANALYSIS WITH CHANGE SUGGESTIONS ===

AVAILABLE TOOLS IN YOUR REGISTRY:
- analyze: Analyze code and provide insights
- suggest: Suggest improvements in structured format

UNAVAILABLE TOOLS (DO NOT ATTEMPT TO USE):
- replace, edit, write, modify, update, delete, create, or any other file modification tools

CRITICAL: You do NOT have access to any file editing tools. If asked to make changes:
1. Analyze the requested changes
2. Output them in this EXACT format for each change:

[SUGGESTED_EDIT_START]
FILE: <exact filepath>
CHANGE: <brief description>
OLD:
<exact old code to replace>
NEW:
<exact new code>
[SUGGESTED_EDIT_END]

USER PROMPT:
${resolvedPrompt}

=== END OF REQUEST ===

REMEMBER: You can only SUGGEST changes in the format above. You cannot execute any file modifications.`;
      break;
      
    case StrictMode.SEARCH:
      // Search mode - no wrapper, tools provide their own search-optimized prompts
      console.warn(`[Gemini MCP] Using search mode - no wrapper applied`);
      break;
      
    default:
      // For any other mode, use prompt as-is
      console.warn(`[Gemini MCP] Using mode: ${mode}`);
  }

  const args = [];
  if (model) {
    args.push("-m", model);
  }
  if (sandbox) {
    args.push("-s");
  }
  args.push("-p", finalPrompt);
  
  // Use unified runShell wrapper
  const exec = await runShell("gemini", args);
  if (exec.ok) {
    return exec.out;  
  }
  
  // Handle error case
  throw new GeminiCLIError(
    sanitize(exec.err),
    prompt,
    model
  );
}