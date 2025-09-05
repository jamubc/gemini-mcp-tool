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
 * An immutable, frozen object containing the server's runtime configuration.
 */
export interface AppConfig {
  /** The target model environment, used for feature switching like schema generation. */
  readonly target: string;
}

/**
 * Initializes the application configuration by reading from the environment.
 * This function should only be executed once when the application starts.
 *
 * The configuration is resolved with the following precedence:
 * 1. Command-line argument: `--target-model <value>`
 * 2. Environment variable: `MCP_TARGET_MODEL=<value>`
 * 3. Default value (`'default'`)
 *
 * @returns A frozen `AppConfig` object.
 */
function initializeConfig(): AppConfig {
  let target = 'default';
  let detectedVia = '';

  // 1. Check for the command-line argument
  const argIndex = process.argv.indexOf('--target-model');
  if (argIndex > -1 && process.argv.length > argIndex + 1) {
    target = process.argv[argIndex + 1].toLowerCase();
    detectedVia = 'command-line argument';
  }
  // 2. Check for the environment variable if not already set by arg
  else if (process.env.MCP_TARGET_MODEL) {
    target = process.env.MCP_TARGET_MODEL.toLowerCase();
    detectedVia = 'environment variable';
  }

  if (target !== 'default') {
    Logger.debug(`Target model set to "${target}" via ${detectedVia}.`);
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
  return config.target === 'gemini';
}