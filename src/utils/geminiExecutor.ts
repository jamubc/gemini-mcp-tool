import * as path from 'path';
import { readFileSync, realpathSync } from 'fs';
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

const FILE_REF_PATTERN = /@(\S+)/g;
// Inlining only: @ must start the prompt or follow whitespace, so user@host or
// a@b aren't inlined. The guard above stays broad (it must reject any traversal).
const FILE_REF_INLINE_PATTERN = /(?<=^|\s)@(\S+)/g;

/**
 * Rejects @file references that resolve outside the working directory.
 *
 * The Gemini CLI inlines the contents of any `@path` token it finds in the
 * prompt. Because prompt text can originate from untrusted input, an
 * unrestricted reference such as `@/etc/passwd`, `@~/.ssh/id_rsa` or
 * `@../../secret` would let that input exfiltrate arbitrary local files
 * (CVE-2026-0755). Constraining references to the project root preserves the
 * legitimate `@file` feature while removing the exfiltration primitive.
 */
export function assertSafeFileReferences(prompt: string, root: string = process.cwd()): void {
  const normalizedRoot = path.resolve(root);
  // Canonicalize the root once so a symlinked root (e.g. /tmp -> /private/tmp
  // on macOS) doesn't make legitimate in-root targets look like escapes.
  let realRoot: string;
  try {
    realRoot = realpathSync(normalizedRoot);
  } catch {
    realRoot = normalizedRoot;
  }
  const escapes = (p: string, base: string) =>
    p !== base && !p.startsWith(base + path.sep);
  for (const match of prompt.matchAll(FILE_REF_PATTERN)) {
    const ref = match[1];
    const resolved = path.resolve(normalizedRoot, ref);
    // `~` is rejected explicitly: path.resolve treats it as a literal segment,
    // so a home-directory reference would otherwise look contained.
    if (ref.startsWith('~') || escapes(resolved, normalizedRoot)) {
      throw new Error(
        `Refusing @file reference outside the project directory: "@${ref}". ` +
        `Only files within ${normalizedRoot} may be referenced.`
      );
    }
    // Symlink-aware re-check: the lexical test above cannot see through an
    // in-root symlink whose target lies outside the root. A path that doesn't
    // resolve is fine here — nothing is read, and the CLI reports it.
    let real: string | undefined;
    try {
      real = realpathSync(resolved);
    } catch {
      real = undefined;
    }
    if (real !== undefined && escapes(real, realRoot)) {
      throw new Error(
        `Refusing @file reference resolving outside the project directory: "@${ref}". ` +
        `Only files within ${normalizedRoot} may be referenced.`
      );
    }
  }
}

/**
 * Wraps a user request in the changeMode instruction template that makes the
 * model emit machine-applicable OLD/NEW edit blocks. The format is model- and
 * CLI-agnostic, so both the gemini and agy backends share this builder.
 */
export function buildChangeModePrompt(userRequest: string): string {
  return `
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
${userRequest}
`;
}

/**
 * changeMode preprocessing shared by both backends: rewrite `file:foo` -> `@foo`
 * so the inlining/guard path treats them as file refs, then wrap the request in
 * the OLD/NEW template. One implementation so gemini and agy cannot drift.
 */
export function prepareChangeModePrompt(prompt: string): string {
  return buildChangeModePrompt(prompt.replace(/file:(\S+)/g, '@$1'));
}

/**
 * Replaces every in-project `@path` reference with the file's contents inlined
 * in a delimited block. The Gemini CLI does this inlining itself; the agy
 * backend does NOT reliably inline `@file` (it is agent-first and decides to
 * read files via its own tools), so for agy we inline ourselves to keep both
 * determinism and the CVE-2026-0755 project-root guard in the data path.
 */
export function inlineFileReferences(prompt: string, root: string = process.cwd()): string {
  // Reuse the same guard the gemini path relies on; rejects ~, absolute,
  // traversal and out-of-root-symlink references before we read anything.
  assertSafeFileReferences(prompt, root);
  const normalizedRoot = path.resolve(root);
  // Compare real targets against the canonicalized root (see the note in
  // assertSafeFileReferences about symlinked roots).
  let realRoot: string;
  try {
    realRoot = realpathSync(normalizedRoot);
  } catch {
    realRoot = normalizedRoot;
  }
  const escapesRoot = (p: string) =>
    p !== realRoot && !p.startsWith(realRoot + path.sep);
  return prompt.replace(FILE_REF_INLINE_PATTERN, (whole, ref: string) => {
    const resolved = path.resolve(normalizedRoot, ref);
    // Symlink-aware guard: assertSafeFileReferences is lexical (path.resolve),
    // so an in-root symlink could still point outside the root. Resolve the real
    // target and re-check before reading. realpathSync throws on a missing path —
    // that is handled below as "not found" (no contents leaked).
    let real: string;
    try {
      real = realpathSync(resolved);
    } catch (e) {
      Logger.warn(`inlineFileReferences: could not resolve @${ref}: ${(e as Error).message}`);
      return `\n----- FILE NOT FOUND: ${ref} -----\n`;
    }
    if (escapesRoot(real)) {
      throw new Error(
        `Refusing @file reference resolving outside the project directory: "@${ref}". ` +
        `Only files within ${normalizedRoot} may be referenced.`
      );
    }
    try {
      const content = readFileSync(real, 'utf8');
      return `\n----- BEGIN FILE: ${ref} -----\n${content}\n----- END FILE: ${ref} -----\n`;
    } catch (e) {
      Logger.warn(`inlineFileReferences: could not read @${ref}: ${(e as Error).message}`);
      // Leave a visible marker rather than the raw token so the model isn't
      // misled into thinking a file was provided.
      return `\n----- FILE NOT FOUND: ${ref} -----\n`;
    }
  });
}

export async function executeGeminiCLI(
  prompt: string,
  model?: string,
  sandbox?: boolean,
  changeMode?: boolean,
  onProgress?: (newOutput: string) => void
): Promise<string> {
  let prompt_processed = prompt;

  if (changeMode) {
    prompt_processed = prepareChangeModePrompt(prompt);
  }

  // Block @file references that escape the project root before the prompt
  // reaches the Gemini CLI's file-inlining parser (CVE-2026-0755).
  assertSafeFileReferences(prompt_processed);

  // changeMode and @file prompts go on stdin instead of the -p flag: this dodges
  // cmd.exe argument parsing on Windows and the OS command-line length limit that
  // large @file/changeMode prompts can exceed. Simple prompts still use -p. (#27, #77)
  const useStdin = !!changeMode || prompt_processed.includes('@');

  const args = [];
  if (model) { args.push(CLI.FLAGS.MODEL, model); }
  if (sandbox) { args.push(CLI.FLAGS.SANDBOX); }

  // cmd.exe-safe quoting on Windows is handled in commandExecutor, so the prompt
  // is passed verbatim as one logical CLI argument. No manual quoting here —
  // wrapping in `"` only injects literal quote characters and corrupts @file
  // references (#66, CVE-2026-0755).
  if (!useStdin) { args.push(CLI.FLAGS.PROMPT, prompt_processed); }

  try {
    return await executeCommand(CLI.COMMANDS.GEMINI, args, onProgress, useStdin ? prompt_processed : undefined);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes(ERROR_MESSAGES.QUOTA_EXCEEDED) && model !== MODELS.FLASH) {
      Logger.warn(`${ERROR_MESSAGES.QUOTA_EXCEEDED}. Falling back to ${MODELS.FLASH}.`);
      await sendStatusMessage(STATUS_MESSAGES.FLASH_RETRY);
      const fallbackArgs = [];
      fallbackArgs.push(CLI.FLAGS.MODEL, MODELS.FLASH);
      if (sandbox) {
        fallbackArgs.push(CLI.FLAGS.SANDBOX);
      }

      // Pass the prompt verbatim here too (see note in the primary path).
      if (!useStdin) { fallbackArgs.push(CLI.FLAGS.PROMPT, prompt_processed); }
      try {
        const result = await executeCommand(CLI.COMMANDS.GEMINI, fallbackArgs, onProgress, useStdin ? prompt_processed : undefined);
        Logger.warn(`Successfully executed with ${MODELS.FLASH} fallback.`);
        await sendStatusMessage(STATUS_MESSAGES.FLASH_SUCCESS);
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

    if (!rawResult.trim()) {
      if (cachedChunks) {
        return `❌ Invalid chunk index: ${chunkIndex}

Available chunks: 1 to ${cachedChunks.length}
You requested: ${chunkIndex}

Please use a valid chunk index.`;
      }

      return `❌ Cache miss: No chunks found for cache key "${chunkCacheKey}".

Possible reasons:
1. The cache key is incorrect, or the original changeMode request did not create chunks
2. The cache has expired (10 minute TTL)
3. The MCP server was restarted and the file-based cache was cleared

Please re-run the original changeMode request to regenerate the chunks.`;
    }

    Logger.debug(`Cache miss or invalid chunk index, processing new result`);
  }

  // Parse OLD/NEW format
  const edits = parseChangeModeOutput(rawResult);

  if (edits.length === 0) {
    return `No edits found in Gemini's response. Please ensure Gemini uses the OLD/NEW format. \n\n${rawResult}`;
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
