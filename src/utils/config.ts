/**
 * @module config
 * Manages the server's runtime configuration, primarily for determining the
 * target LLM environment. This allows the application to adapt its behavior,
 * such as tool schema generation, based on the specific model it's serving.
 *
 * The configuration is determined once at startup by checking command-line
 * arguments and environment variables, then exported as a read-only object.
 */
import { Logger } from './logger.js';

/**
 * Defines the possible schema compatibility targets for the server.
 */
export enum ModelTarget {
  /** Enables compatibility mode for Google Gemini, which requires a stricter tool schema. */
  GEMINI = 'gemini',
  /** Uses the standard, more expressive schema format for other models. */
  DEFAULT = 'default',
}

/**
 * An immutable, frozen object containing the server's runtime configuration.
 */
export interface AppConfig {
  /** The target model environment, used for feature switching like schema generation. */
  readonly target: ModelTarget;
}

/**
 * Initializes the application configuration by reading from the environment.
 * This function should only be executed once when the application starts.
 *
 * The configuration is resolved with the following precedence:
 * 1. Command-line argument: `--target-model gemini`
 * 2. Environment variable: `MCP_TARGET_MODEL=gemini`
 * 3. Default value (`ModelTarget.DEFAULT`)
 *
 * @returns A frozen `AppConfig` object.
 */
function initializeConfig(): AppConfig {
  let target = ModelTarget.DEFAULT;
  let detectedVia = '';

  // 1. Check for the command-line argument
  const argIndex = process.argv.indexOf('--target-model');
  if (argIndex > -1 && process.argv.length > argIndex + 1) {
    const modelArg = process.argv[argIndex + 1].toLowerCase();
    if (modelArg === ModelTarget.GEMINI) {
      target = ModelTarget.GEMINI;
      detectedVia = 'command-line argument';
    }
  }

  // 2. Check for the environment variable if not already set
  if (target === ModelTarget.DEFAULT) {
    const envVar = process.env.MCP_TARGET_MODEL?.toLowerCase();
    if (envVar === ModelTarget.GEMINI) {
      target = ModelTarget.GEMINI;
      detectedVia = 'environment variable';
    }
  }

  if (target === ModelTarget.GEMINI) {
    Logger.debug(`Gemini compatibility mode enabled via ${detectedVia}.`);
  }

  // Return a frozen, read-only configuration object
  return Object.freeze({ target });
}

/**
 * The single, application-wide configuration instance.
 * Initialized once at startup.
 */
export const config: AppConfig = initializeConfig();

/**
 * A utility function to quickly check if the Gemini compatibility mode is active.
 * This is the preferred way to check for the target in application logic.
 *
 * @returns `true` if the target model is Gemini, otherwise `false`.
 */
export function isGeminiTarget(): boolean {
  return config.target === ModelTarget.GEMINI;
}