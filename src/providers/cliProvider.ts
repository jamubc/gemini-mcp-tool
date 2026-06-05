import { GeminiProvider, ProviderId, ProviderRequest } from './types.js';
import { executeGeminiCLI } from '../utils/geminiExecutor.js';

/**
 * Default executor: delegates to executeGeminiCLI with the same arguments.
 * Extracted as a separate function so it can be replaced in tests without
 * touching the singleton or spawning any subprocess.
 */
async function defaultExecutor(req: ProviderRequest): Promise<string> {
  return executeGeminiCLI(
    req.prompt,
    req.model,
    req.sandbox,
    req.changeMode,
    req.onProgress,
  );
}

/**
 * CliProvider wraps the Gemini CLI subprocess and is the default backend.
 *
 * An optional executor function may be injected at construction time; this is
 * intended for unit tests that need to assert forwarded arguments without
 * spawning a real process.
 */
export class CliProvider implements GeminiProvider {
  readonly id: ProviderId = 'cli';

  private readonly _executor: (req: ProviderRequest) => Promise<string>;

  constructor(executor?: (req: ProviderRequest) => Promise<string>) {
    this._executor = executor ?? defaultExecutor;
  }

  run(req: ProviderRequest): Promise<string> {
    return this._executor(req);
  }
}
