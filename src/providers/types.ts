/**
 * Core types for the pluggable Gemini execution provider seam.
 *
 * The CliProvider (id 'cli') is the default and preserves existing behavior
 * exactly. The ApiProvider (id 'api') is a documented stub for a future
 * direct-API backend. The 'antigravity' id is reserved for forward
 * compatibility.
 */

export type ProviderId = 'cli' | 'api' | 'antigravity';

/**
 * A provider-agnostic request to run a Gemini prompt.
 * All fields mirror the existing executeGeminiCLI signature.
 */
export interface ProviderRequest {
  prompt: string;
  model?: string;
  sandbox?: boolean;
  changeMode?: boolean;
  onProgress?: (s: string) => void;
}

/**
 * A GeminiProvider executes a ProviderRequest and returns the raw response
 * string (the same contract as executeGeminiCLI).
 */
export interface GeminiProvider {
  readonly id: ProviderId;
  run(req: ProviderRequest): Promise<string>;
}
