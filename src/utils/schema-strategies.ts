/**
 * @module schema-strategies
 * Provides a strategy pattern implementation for selecting the appropriate Zod schema
 * based on the application's runtime configuration. This allows tool definitions
 * to remain declarative while supporting multiple model-specific schema requirements.
 */

import { ZodTypeAny } from 'zod';
import { config } from './config.js';

/**
 * A schema strategy that selects the appropriate schema for the `chunkIndex` parameter
 * based on the current model target configuration.
 *
 * For the 'gemini' target, it returns the `gemini` schema. For all other targets,
 * it returns the `standard` schema.
 *
 * @param schemas An object containing the `standard` and `gemini` Zod schemas.
 * @returns The Zod schema chosen based on the active configuration.
 */
export const selectChunkIndexSchema = (schemas: {
  standard: ZodTypeAny;
  gemini: ZodTypeAny;
}): ZodTypeAny => {
  if (config.target === 'gemini') {
    return schemas.gemini;
  }
  return schemas.standard;
};