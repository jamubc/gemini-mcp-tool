import { executeCommand, CommandOptions } from './commandExecutor.js';
import { Logger } from './logger.js';
import { GeminiCliReliabilityManager } from './geminiCliReliabilityManager.js';
import { QuotaManager, isQuotaError, getQuotaAwareErrorMessage } from './quotaManager.js';
import { 
  ERROR_MESSAGES, 
  STATUS_MESSAGES, 
  MODELS, 
  CLI
} from '../constants.js';

import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

// Windows command line length limit
const MAX_CMD_LENGTH = 8000;

/**
 * Configuration options for Gemini CLI execution
 */
export interface GeminiExecutionOptions {
  /** Rolling timeout in milliseconds - resets on data activity (default: 30000) */
  rollingTimeout?: number;
  /** Absolute timeout in milliseconds - maximum duration regardless of activity (default: 600000) */
  absoluteTimeout?: number;
  /** Custom abort signal for external cancellation */
  signal?: AbortSignal;
}

export async function executeGeminiCLI(
  prompt: string,
  model?: string,
  sandbox?: boolean,
  onProgress?: (newOutput: string) => void,
  options?: GeminiExecutionOptions
): Promise<string> {
  let prompt_processed = prompt;
  
  const args = [];
  if (model) { args.push(CLI.FLAGS.MODEL, model); }
  if (sandbox) { args.push(CLI.FLAGS.SANDBOX); }
  
  // Check if command line would be too long (Windows limitation)
  const estimatedCmdLength = 200 + prompt_processed.length; // rough estimate
  let tempFile: string | null = null;
  
  if (process.platform === 'win32' && estimatedCmdLength > MAX_CMD_LENGTH) {
    // Use temporary file for long prompts with random filename to prevent race conditions
    const randomId = randomBytes(8).toString('hex');
    tempFile = join(tmpdir(), `gemini-prompt-${randomId}.txt`);
    writeFileSync(tempFile, prompt_processed, { encoding: 'utf8', mode: 0o600 });
    Logger.info(`Created temp file: ${tempFile} (${prompt_processed.length} chars)`);
    args.push(CLI.FLAGS.PROMPT, `@${tempFile}`);
    Logger.info(`Using temp file approach with args: ${args.join(' ')}`);
  } else {
    // Use command line argument for short prompts
    const finalPrompt = process.platform === 'win32'
      ? `"${prompt_processed.replace(/"/g, '\\"').replace(/'/g, "\\'")}"`
      : prompt_processed;
    args.push(CLI.FLAGS.PROMPT, finalPrompt);
  }
  
  const quotaManager = QuotaManager.getInstance();
  const currentModel = model || MODELS.PRO;
  
  // Check quota status before attempting execution
  const quotaStatus = quotaManager.getQuotaStatus(currentModel);
  if (quotaStatus.isQuotaExceeded && !quotaStatus.canFallback) {
    Logger.warn(`Skipping execution - quota exceeded for ${currentModel}: ${quotaStatus.suggestedAction}`);
    throw new Error(`⚠️ ${quotaStatus.suggestedAction}`);
  }
  
  // Prepare timeout options
  const commandOptions: CommandOptions = {
    rollingTimeout: options?.rollingTimeout || 30000,  // 30 second default
    absoluteTimeout: options?.absoluteTimeout || 600000, // 10 minute default
    enableThrottling: true, // Always enable performance optimization
    signal: options?.signal
  };

  try {
    const result = await executeCommand(CLI.COMMANDS.GEMINI, args, onProgress, commandOptions);
    // Clear any previous quota issues on success
    quotaManager.resetQuotaStatus(currentModel);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const quotaError = quotaManager.analyzeError(errorMessage, currentModel);
    
    if (quotaError.type === 'quota_exceeded' && quotaError.fallbackAvailable) {
      Logger.warn(`${quotaError.message} Attempting fallback to ${MODELS.FLASH}.`);
      await sendStatusMessage(STATUS_MESSAGES.FLASH_RETRY);
      
      const fallbackArgs = [];
      fallbackArgs.push(CLI.FLAGS.MODEL, MODELS.FLASH);
      if (sandbox) {
        fallbackArgs.push(CLI.FLAGS.SANDBOX);
      }
      
      // Use same temp file approach for fallback if needed
      if (tempFile) {
        fallbackArgs.push(CLI.FLAGS.PROMPT, `@${tempFile}`);
      } else {
        const fallbackPrompt = process.platform === 'win32'
          ? `"${prompt_processed.replace(/"/g, '\\"').replace(/'/g, "\\'")}"`
          : prompt_processed;
        fallbackArgs.push(CLI.FLAGS.PROMPT, fallbackPrompt);
      }
        
      try {
        const result = await executeCommand(CLI.COMMANDS.GEMINI, fallbackArgs, onProgress, commandOptions);
        Logger.warn(`Successfully executed with ${MODELS.FLASH} fallback.`);
        await sendStatusMessage(STATUS_MESSAGES.FLASH_SUCCESS);
        return result;
      } catch (fallbackError) {
        const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        const fallbackQuotaError = quotaManager.analyzeError(fallbackErrorMessage, MODELS.FLASH);
        
        // Provide quota-aware error message
        const fallbackErrorForMessage = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
        const finalMessage = fallbackQuotaError.type === 'quota_exceeded'
          ? `Both ${MODELS.PRO} and ${MODELS.FLASH} quotas exceeded. ${fallbackQuotaError.message}`
          : `${MODELS.PRO} quota exceeded, ${MODELS.FLASH} fallback failed: ${getQuotaAwareErrorMessage(fallbackErrorForMessage, MODELS.FLASH)}`;
          
        throw new Error(finalMessage);
      }
    } else if (quotaError.type === 'rate_limit') {
      Logger.warn(`Rate limit encountered: ${quotaError.message}`);
      throw new Error(`⏳ ${quotaError.message}`);
    } else {
      // For other errors, provide quota-aware messaging if applicable
      const errorForMessage = error instanceof Error ? error : new Error(String(error));
      throw new Error(getQuotaAwareErrorMessage(errorForMessage, currentModel));
    }
  } finally {
    // Always cleanup temp file if it was created
    if (tempFile) {
      try {
        unlinkSync(tempFile);
        Logger.info(`Cleaned up temporary file: ${tempFile}`);
      } catch (cleanupError) {
        Logger.warn(`Failed to cleanup temporary file ${tempFile}: ${cleanupError}`);
      }
    }
  }
}


// Placeholder
async function sendStatusMessage(message: string): Promise<void> {
  Logger.debug(`Status: ${message}`);
}