import { executeCommand } from "../utils/commandExecutor.js";
import { Logger } from "../utils/logger.js";
import {
  CLI,
  MODELS,
  ERROR_MESSAGES,
  APPROVAL_MODES,
  ENV,
  type ApprovalMode,
} from "../constants.js";
import type { Backend, BackendRunOptions } from "./types.js";

const VALID_APPROVAL_MODES = Object.values(APPROVAL_MODES) as string[];

/**
 * Resolve the approval mode: explicit arg > GEMINI_MCP_APPROVAL_MODE env. This
 * is OPT-IN — when neither is set we return undefined and pass no flag, so the
 * Gemini CLI behaves exactly as it does today for plain Q&A. (We deliberately do
 * NOT default to "plan": in headless `-p` mode that turns Gemini into an
 * autonomous planner that ignores simple questions and can error out.) Unknown
 * values are ignored rather than forced.
 */
export function resolveApprovalMode(arg?: string): ApprovalMode | undefined {
  const candidate = arg || process.env[ENV.APPROVAL_MODE];
  if (!candidate) return undefined;
  return VALID_APPROVAL_MODES.includes(candidate) ? (candidate as ApprovalMode) : undefined;
}

/**
 * Resolve the model to use: explicit per-call arg > GEMINI_MODEL env > undefined
 * (let the Gemini CLI pick its own default). The env default lets users pin a
 * model in their MCP config so Claude can't fall back to an older one (issue #49).
 */
export function resolveModel(argModel?: string): string | undefined {
  return argModel || process.env[ENV.MODEL]?.trim() || undefined;
}

/** The model the quota fallback retries on (GEMINI_FLASH_MODEL or the default). */
export function resolveFlashModel(): string {
  return process.env[ENV.FLASH_MODEL]?.trim() || MODELS.FLASH;
}

/** Build the Gemini CLI argv (minus the prompt, which may go on stdin). */
export function buildGeminiArgs(
  model: string | undefined,
  opts: BackendRunOptions,
): string[] {
  const args: string[] = [];
  if (model) args.push(CLI.FLAGS.MODEL, model);
  if (opts.sandbox) args.push(CLI.FLAGS.SANDBOX);
  const approval = resolveApprovalMode(opts.approvalMode);
  if (approval) args.push(CLI.FLAGS.APPROVAL_MODE, approval);
  // Native sessions: resume a prior session, or start/identify one by id.
  if (opts.resume) args.push(CLI.FLAGS.RESUME, opts.resume);
  else if (opts.sessionId) args.push(CLI.FLAGS.SESSION_ID, opts.sessionId);
  return args;
}

async function runOnce(
  prompt: string,
  model: string | undefined,
  opts: BackendRunOptions,
): Promise<string> {
  const args = buildGeminiArgs(model, opts);
  if (!opts.useStdin) args.push(CLI.FLAGS.PROMPT, prompt);
  return executeCommand(
    CLI.COMMANDS.GEMINI,
    args,
    opts.onProgress,
    opts.useStdin ? prompt : undefined,
  );
}

export const geminiBackend: Backend = {
  name: "gemini",
  supportsModelSelection: true,
  async run(prompt, opts) {
    const model = resolveModel(opts.model);
    const flashModel = resolveFlashModel();
    try {
      return await runOnce(prompt, model, opts);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // gemini-2.5-pro quota exhausted → retry once on flash (unless already flash).
      if (message.includes(ERROR_MESSAGES.QUOTA_EXCEEDED) && model !== flashModel) {
        Logger.warn(`${ERROR_MESSAGES.QUOTA_EXCEEDED}. Falling back to ${flashModel}.`);
        try {
          const result = await runOnce(prompt, flashModel, opts);
          Logger.warn(`Successfully executed with ${flashModel} fallback.`);
          return result;
        } catch (fallbackError) {
          const fe =
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          throw new Error(
            `${MODELS.PRO} quota exceeded, ${flashModel} fallback also failed: ${fe}`,
          );
        }
      }
      throw error;
    }
  },
};
