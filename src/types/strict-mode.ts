/**
 * Strict mode types for Gemini CLI execution
 */

/**
 * String literal union type for strict mode options
 */
export type StrictModeType = 
  | "off"       // No wrapping, use tool's own prompt
  | "analysis"  // Current analysis wrapper for file analysis
  | "change"    // Current change detection wrapper
  | "search"    // Search-specific wrapper for focused results
  | "auto";     // Auto-detect based on prompt content (default)

/**
 * Enum-style constant for better IDE support and imports
 */
export const StrictMode = {
  OFF: "off" as const,
  ANALYSIS: "analysis" as const,
  CHANGE: "change" as const,
  SEARCH: "search" as const,
  AUTO: "auto" as const,
} as const;

/**
 * Type guard to check if a value is a valid StrictModeType
 */
export function isValidStrictMode(value: unknown): value is StrictModeType {
  return typeof value === "string" && 
    ["off", "analysis", "change", "search", "auto"].includes(value);
}

/**
 * Convert legacy boolean strictMode to new StrictModeType
 * @param strictMode Legacy boolean value
 * @returns Equivalent StrictModeType
 */
export function fromBooleanStrictMode(strictMode?: boolean): StrictModeType {
  if (strictMode === true) return "auto";
  if (strictMode === false) return "off";
  return "auto"; // Default for undefined
}