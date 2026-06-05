import { GeminiProvider, ProviderId } from './types.js';
import { CliProvider } from './cliProvider.js';
import { ApiProvider } from './apiProvider.js';
import { ENV } from '../constants.js';

const VALID_IDS: ReadonlySet<ProviderId> = new Set(['cli', 'api', 'antigravity']);

/** One instance per provider id for the life of the process. */
const cache = new Map<ProviderId, GeminiProvider>();

/**
 * Return the GeminiProvider for the given id, defaulting to the value of
 * GEMINI_MCP_PROVIDER (which itself defaults to 'cli').
 *
 * Instances are cached per id so callers always receive the same object
 * within a single process.
 *
 * @throws {Error} for any unknown provider id.
 */
export function getProvider(id?: ProviderId): GeminiProvider {
  const resolvedId: ProviderId = id ?? (process.env[ENV.GEMINI_MCP_PROVIDER] as ProviderId | undefined) ?? 'cli';

  if (!VALID_IDS.has(resolvedId)) {
    throw new Error(
      `Unknown provider id "${resolvedId}". ` +
      `Valid values are: ${[...VALID_IDS].join(', ')}. ` +
      `Check the ${ENV.GEMINI_MCP_PROVIDER} environment variable.`,
    );
  }

  const cached = cache.get(resolvedId);
  if (cached) return cached;

  const provider = createProvider(resolvedId);
  cache.set(resolvedId, provider);
  return provider;
}

/**
 * Clear the instance cache. Intended for use in tests that need to exercise
 * different provider configurations in isolation.
 */
export function resetProviderCache(): void {
  cache.clear();
}

function createProvider(id: ProviderId): GeminiProvider {
  switch (id) {
    case 'cli':
      return new CliProvider();
    case 'api':
      return new ApiProvider();
    case 'antigravity':
      // Reserved for future use; fall through to the CLI provider so the
      // system remains functional when this id is set experimentally.
      return new CliProvider();
  }
}

export type { GeminiProvider, ProviderId, ProviderRequest } from './types.js';
export { CliProvider } from './cliProvider.js';
export { ApiProvider } from './apiProvider.js';
