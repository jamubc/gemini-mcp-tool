import { executeCommand } from './commandExecutor.js';
import { Logger } from './logger.js';
import {
  ERROR_MESSAGES,
  STATUS_MESSAGES,
  MODELS,
  CLI
} from '../constants.js';

import { parseChangeModeOutput, validateChangeModeEdits } from './changeModeParser.js';
import { formatChangeModeResponse, summarizeChangeModeEdits } from './changeModeTranslator.js';
import { chunkChangeModeEdits } from './changeModeChunker.js';
import { cacheChunks, getChunks } from './chunkCache.js';
import { generateCacheKey, getCachedResponse, cacheResponse } from './responseCache.js';

export interface GeminiCLIOptions {
  model?: string;
  sandbox?: boolean;
  changeMode?: boolean;
  yolo?: boolean;
  approvalMode?: string;
  outputFormat?: string;
  includeDirectories?: string | string[];
  debug?: boolean;
  promptInteractive?: string;
  extensions?: string | string[];
  resume?: string;
}

/**
 * Helper function to build Gemini CLI arguments from options
 * Eliminates code duplication between main execution and fallback
 */
function buildGeminiArgs(opts: GeminiCLIOptions, prompt: string, forceModel?: string): string[] {
  const args: string[] = [];
  const model = forceModel || opts.model;

  // Model selection
  if (model) {
    args.push(CLI.FLAGS.MODEL, model);
  }

  // Boolean flags
  if (opts.sandbox) {
    args.push(CLI.FLAGS.SANDBOX);
  }
  if (opts.yolo) {
    args.push(CLI.FLAGS.YOLO);
  }
  if (opts.debug) {
    args.push(CLI.FLAGS.DEBUG);
  }

  // Approval mode (overrides yolo if both are set)
  if (opts.approvalMode) {
    args.push(CLI.FLAGS.APPROVAL_MODE, opts.approvalMode);
  }

  // Output format
  if (opts.outputFormat) {
    args.push(CLI.FLAGS.OUTPUT_FORMAT, opts.outputFormat);
  }

  // Include directories (array or comma-separated string)
  if (opts.includeDirectories) {
    const dirs = Array.isArray(opts.includeDirectories)
      ? opts.includeDirectories.join(',')
      : opts.includeDirectories;
    args.push(CLI.FLAGS.INCLUDE_DIRECTORIES, dirs);
  }

  // Extensions (array or comma-separated string)
  if (opts.extensions) {
    const exts = Array.isArray(opts.extensions)
      ? opts.extensions.join(',')
      : opts.extensions;
    args.push(CLI.FLAGS.EXTENSIONS, exts);
  }

  // Resume session
  if (opts.resume) {
    args.push(CLI.FLAGS.RESUME, opts.resume);
  }

  // Prompt interactive
  if (opts.promptInteractive) {
    args.push(CLI.FLAGS.PROMPT_INTERACTIVE, opts.promptInteractive);
  }

  // Ensure @ symbols work cross-platform by wrapping in quotes if needed
  const finalPrompt = prompt.includes('@') && !prompt.startsWith('"')
    ? `"${prompt}"`
    : prompt;

  args.push(CLI.FLAGS.PROMPT, finalPrompt);

  return args;
}

export async function executeGeminiCLI(
  prompt: string,
  options: GeminiCLIOptions | string,
  onProgress?: (newOutput: string) => void
): Promise<string> {
  // Handle backward compatibility - if options is a string, it's the old 'model' parameter
  let opts: GeminiCLIOptions;
  if (typeof options === 'string') {
    opts = { model: options };
  } else {
    opts = options || {};
  }

  // Check cache first for non-changeMode requests (changeMode needs fresh responses)
  if (!opts.changeMode) {
    const cacheKey = generateCacheKey(prompt, opts);
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      Logger.debug('Returning cached response');
      return cached;
    }
  }

  let prompt_processed = prompt;

  if (opts.changeMode) {
    prompt_processed = prompt.replace(/file:(\S+)/g, '@$1');

    const changeModeInstructions = `
[CHANGEMODE INSTRUCTIONS]
You are generating code modifications that will be processed by an automated system. The output format is critical because it enables programmatic application of changes without human intervention.

INSTRUCTIONS:
1. Analyze each provided file thoroughly
2. Identify locations requiring changes based on the user request
3. For each change, output in the exact format specified
4. The OLD section must be EXACTLY what appears in the file (copy-paste exact match)
5. Provide complete, directly replacing code blocks
6. Verify line numbers are accurate

CRITICAL REQUIREMENTS:
1. Output edits in the EXACT format specified below - no deviations
2. The OLD string MUST be findable with Ctrl+F - it must be a unique, exact match
3. Include enough surrounding lines to make the OLD string unique
4. If a string appears multiple times (like </div>), include enough context lines above and below to make it unique
5. Copy the OLD content EXACTLY as it appears - including all whitespace, indentation, line breaks
6. Never use partial lines - always include complete lines from start to finish

OUTPUT FORMAT (follow exactly):
**FILE: [filename]:[line_number]**
\`\`\`
OLD:
[exact code to be replaced - must match file content precisely]
NEW:
[new code to insert - complete and functional]
\`\`\`

EXAMPLE 1 - Simple unique match:
**FILE: src/utils/helper.js:100**
\`\`\`
OLD:
function getMessage() {
  return "Hello World";
}
NEW:
function getMessage() {
  return "Hello Universe!";
}
\`\`\`

EXAMPLE 2 - Common tag needing context:
**FILE: index.html:245**
\`\`\`
OLD:
        </div>
      </div>
    </section>
NEW:
        </div>
      </footer>
    </section>
\`\`\`

IMPORTANT: The OLD section must be an EXACT copy from the file that can be found with Ctrl+F!

USER REQUEST:
${prompt_processed}
`;
    prompt_processed = changeModeInstructions;
  }

  // Use helper function to build args (eliminates code duplication)
  const args = buildGeminiArgs(opts, prompt_processed);

  try {
    const result = await executeCommand(CLI.COMMANDS.GEMINI, args, onProgress);

    // Cache successful non-changeMode responses
    if (!opts.changeMode) {
      const cacheKey = generateCacheKey(prompt, opts);
      cacheResponse(cacheKey, result);
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes(ERROR_MESSAGES.QUOTA_EXCEEDED) && opts.model !== MODELS.FLASH) {
      Logger.warn(`${ERROR_MESSAGES.QUOTA_EXCEEDED}. Falling back to ${MODELS.FLASH}.`);
      await sendStatusMessage(STATUS_MESSAGES.FLASH_RETRY);

      // Use helper function with Flash model override (eliminates code duplication)
      const fallbackArgs = buildGeminiArgs(opts, prompt_processed, MODELS.FLASH);

      try {
        const result = await executeCommand(CLI.COMMANDS.GEMINI, fallbackArgs, onProgress);
        Logger.warn(`Successfully executed with ${MODELS.FLASH} fallback.`);
        await sendStatusMessage(STATUS_MESSAGES.FLASH_SUCCESS);

        // Cache successful fallback response (non-changeMode only)
        if (!opts.changeMode) {
          const cacheKey = generateCacheKey(prompt, opts);
          cacheResponse(cacheKey, result);
        }

        return result;
      } catch (fallbackError) {
        const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        throw new Error(`${MODELS.PRO} quota exceeded, ${MODELS.FLASH} fallback also failed: ${fallbackErrorMessage}`);
      }
    } else {
      throw error;
    }
  }
}

export async function processChangeModeOutput(
  rawResult: string,
  chunkIndex?: number,
  chunkCacheKey?: string,
  prompt?: string
): Promise<string> {
  // Check for cached chunks first
  if (chunkIndex && chunkCacheKey) {
    const cachedChunks = getChunks(chunkCacheKey);
    if (cachedChunks && chunkIndex > 0 && chunkIndex <= cachedChunks.length) {
      Logger.debug(`Using cached chunk ${chunkIndex} of ${cachedChunks.length}`);
      const chunk = cachedChunks[chunkIndex - 1];
      let result = formatChangeModeResponse(
        chunk.edits,
        { current: chunkIndex, total: cachedChunks.length, cacheKey: chunkCacheKey }
      );
      
      // Add summary for first chunk only
      if (chunkIndex === 1 && chunk.edits.length > 5) {
        const allEdits = cachedChunks.flatMap(c => c.edits);
        result = summarizeChangeModeEdits(allEdits) + '\n\n' + result;
      }
      
      return result;
    }
    Logger.debug(`Cache miss or invalid chunk index, processing new result`);
  }
  
  // Parse OLD/NEW format
  const edits = parseChangeModeOutput(rawResult);
  
  if (edits.length === 0) {
    return `No edits found in Gemini's response. Please ensure Gemini uses the OLD/NEW format. \n\n+ ${rawResult}`;
  }

  // Validate edits
  const validation = validateChangeModeEdits(edits);
  if (!validation.valid) {
    return `Edit validation failed:\n${validation.errors.join('\n')}`;
  }
  
  const chunks = chunkChangeModeEdits(edits);
  
  // Cache if multiple chunks and we have the original prompt
  let cacheKey: string | undefined;
  if (chunks.length > 1 && prompt) {
    cacheKey = cacheChunks(prompt, chunks);
    Logger.debug(`Cached ${chunks.length} chunks with key: ${cacheKey}`);
  }
  
  // Return requested chunk or first chunk
  const returnChunkIndex = (chunkIndex && chunkIndex > 0 && chunkIndex <= chunks.length) ? chunkIndex : 1;
  const returnChunk = chunks[returnChunkIndex - 1];
  
  // Format the response
  let result = formatChangeModeResponse(
    returnChunk.edits,
    chunks.length > 1 ? { current: returnChunkIndex, total: chunks.length, cacheKey } : undefined
  );
  
  // Add summary if helpful (only for first chunk)
  if (returnChunkIndex === 1 && edits.length > 5) {
    result = summarizeChangeModeEdits(edits, chunks.length > 1) + '\n\n' + result;
  }
  
  Logger.debug(`ChangeMode: Parsed ${edits.length} edits, ${chunks.length} chunks, returning chunk ${returnChunkIndex}`);
  return result;
}

// Placeholder
async function sendStatusMessage(message: string): Promise<void> {
  Logger.debug(`Status: ${message}`);
}