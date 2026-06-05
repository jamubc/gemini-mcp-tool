import { GeminiProvider, ProviderId, ProviderRequest } from './types.js';
import { ENV } from '../constants.js';

/**
 * ApiProvider is a documented stub for a future direct-API backend.
 *
 * It throws an actionable error on every call so that misconfigured
 * deployments receive a clear message instead of a cryptic failure.
 * Implement run() here (or in a subclass) once GEMINI_API_KEY-based
 * access is supported.
 */
export class ApiProvider implements GeminiProvider {
  readonly id: ProviderId = 'api';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  run(_req: ProviderRequest): Promise<string> {
    return Promise.reject(new Error(
      `The API backend is not yet configured. ` +
      `To use it, set the ${ENV.GEMINI_API_KEY} environment variable and ` +
      `ensure an API-backed provider implementation is registered. ` +
      `The default 'cli' provider requires only the Gemini CLI to be installed.`,
    ));
  }
}
