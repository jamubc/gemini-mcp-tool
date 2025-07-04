/**
 * Error Sanitization Utility
 * 
 * Provides centralized error message sanitization to prevent sensitive information
 * from being exposed in error messages sent to users.
 */

export interface SanitizationOptions {
  /**
   * Level of sanitization to apply
   * - 'strict': Maximum sanitization, removes all potentially sensitive info
   * - 'moderate': Balanced approach, keeps some debug info
   * - 'minimal': Light sanitization, mainly for production
   */
  level?: 'strict' | 'moderate' | 'minimal';
  
  /**
   * Whether to include stack traces in errors
   */
  includeStack?: boolean;
  
  /**
   * Whether to log original errors for debugging
   */
  logOriginal?: boolean;
  
  /**
   * Custom patterns to sanitize (regex patterns)
   */
  customPatterns?: RegExp[];
}

/**
 * Default sanitization options
 */
const DEFAULT_OPTIONS: SanitizationOptions = {
  level: 'moderate',
  includeStack: false,
  logOriginal: true,
  customPatterns: []
};

/**
 * Patterns for sensitive information that should be sanitized
 */
const SANITIZATION_PATTERNS = {
  // File paths with user directories
  userPaths: [
    /\/Users\/[^\/]+/g,
    /\/home\/[^\/]+/g,
    /C:\\Users\\[^\\]+/g,
    /\/root/g,
  ],
  
  // Absolute paths that might reveal system structure
  absolutePaths: [
    /\/[a-zA-Z0-9_\-\.\/]+\.(ts|js|json|py|rb|go)/g,
    /[a-zA-Z]:\\[^\\]+\\[^\\]+/g,
  ],
  
  // API keys, tokens, and secrets
  secrets: [
    /api[_-]?key["\s:=]+["']?[a-zA-Z0-9\-_]{20,}/gi,
    /token["\s:=]+["']?[a-zA-Z0-9\-_]{20,}/gi,
    /password["\s:=]+["']?[^\s"']+/gi,
    /secret["\s:=]+["']?[a-zA-Z0-9\-_]{20,}/gi,
    /bearer\s+[a-zA-Z0-9\-_\.]+/gi,
  ],
  
  // Environment variables that might contain secrets
  envVars: [
    /process\.env\.[A-Z_]+/g,
    /\$[A-Z_]+/g,
  ],
  
  // Error stack traces with system paths
  stackPaths: [
    /at\s+.*\s+\(\/[^\)]+\)/g,
    /at\s+.*\s+\([a-zA-Z]:[^\)]+\)/g,
  ],
  
  // Git repository paths
  gitPaths: [
    /\.git\/[^\s]+/g,
    /github\.com[/:][^\s]+/g,
  ],
  
  // Node modules paths
  nodeModules: [
    /node_modules\/[^\s]+/g,
  ],
};

/**
 * Replacement values for sanitized content
 */
const REPLACEMENTS = {
  userPath: '<user-directory>',
  absolutePath: '<file-path>',
  secret: '<redacted>',
  envVar: '<env-var>',
  stackPath: 'at <internal>',
  gitPath: '<git-path>',
  nodeModules: '<node_modules>',
};

/**
 * Sanitize an error message based on the provided options
 */
export function sanitizeError(
  error: Error | string | unknown,
  options: SanitizationOptions = DEFAULT_OPTIONS
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Convert error to string
  let message: string;
  let stack: string | undefined;
  
  if (error instanceof Error) {
    message = error.message;
    stack = error.stack;
    
    // Log original error if requested
    if (opts.logOriginal) {
      console.error('[Error Sanitizer] Original error:', error);
    }
  } else if (typeof error === 'string') {
    message = error;
  } else {
    message = String(error);
  }
  
  // Apply sanitization based on level
  let sanitized = message;
  
  switch (opts.level) {
    case 'strict':
      sanitized = applyStrictSanitization(sanitized);
      break;
    case 'moderate':
      sanitized = applyModerateSanitization(sanitized);
      break;
    case 'minimal':
      sanitized = applyMinimalSanitization(sanitized);
      break;
  }
  
  // Apply custom patterns
  if (opts.customPatterns && opts.customPatterns.length > 0) {
    for (const pattern of opts.customPatterns) {
      sanitized = sanitized.replace(pattern, REPLACEMENTS.secret);
    }
  }
  
  // Handle stack trace
  if (opts.includeStack && stack && opts.level !== 'strict') {
    const levelForStack = opts.level === 'minimal' ? 'minimal' : 'moderate';
    const sanitizedStack = sanitizeStackTrace(stack, levelForStack);
    sanitized += `\n\nStack trace:\n${sanitizedStack}`;
  }
  
  return sanitized;
}

/**
 * Apply strict sanitization (maximum security)
 */
function applyStrictSanitization(message: string): string {
  let result = message;
  
  // Replace all sensitive patterns
  for (const [category, patterns] of Object.entries(SANITIZATION_PATTERNS)) {
    for (const pattern of patterns) {
      const replacement = REPLACEMENTS[category as keyof typeof REPLACEMENTS] || REPLACEMENTS.secret;
      result = result.replace(pattern, replacement);
    }
  }
  
  // Additional strict replacements
  // Remove any remaining file paths
  result = result.replace(/[\/\\][a-zA-Z0-9_\-\.\/\\]+/g, REPLACEMENTS.absolutePath);
  
  // Remove any potential email addresses
  result = result.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '<email>');
  
  // Remove any potential URLs
  result = result.replace(/https?:\/\/[^\s]+/g, '<url>');
  
  return result;
}

/**
 * Apply moderate sanitization (balanced approach)
 */
function applyModerateSanitization(message: string): string {
  let result = message;
  
  // User paths and secrets are always sanitized
  for (const pattern of SANITIZATION_PATTERNS.userPaths) {
    result = result.replace(pattern, REPLACEMENTS.userPath);
  }
  
  for (const pattern of SANITIZATION_PATTERNS.secrets) {
    result = result.replace(pattern, REPLACEMENTS.secret);
  }
  
  // Sanitize environment variables
  for (const pattern of SANITIZATION_PATTERNS.envVars) {
    result = result.replace(pattern, REPLACEMENTS.envVar);
  }
  
  // Keep file names but remove full paths
  result = result.replace(/([\/\\][\w\-\.]+)+\.(ts|js|json|py|rb|go)/g, (match) => {
    const parts = match.split(/[\/\\]/);
    return `.../${parts[parts.length - 1]}`;
  });
  
  return result;
}

/**
 * Apply minimal sanitization (production use)
 */
function applyMinimalSanitization(message: string): string {
  let result = message;
  
  // Only sanitize obvious secrets and user paths
  for (const pattern of SANITIZATION_PATTERNS.secrets) {
    result = result.replace(pattern, REPLACEMENTS.secret);
  }
  
  // Replace home directories but keep relative paths
  result = result.replace(/\/Users\/[^\/]+/g, '~');
  result = result.replace(/\/home\/[^\/]+/g, '~');
  result = result.replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\...');
  
  return result;
}

/**
 * Sanitize stack traces specifically
 */
function sanitizeStackTrace(stack: string, level: 'moderate' | 'minimal'): string {
  if (level === 'moderate') {
    // Remove full paths but keep file names
    return stack.replace(/\(([\/\\][^)]+)\)/g, (match, path) => {
      const parts = path.split(/[\/\\]/);
      return `(.../${parts[parts.length - 1]})`;
    });
  } else {
    // Minimal sanitization - just remove user paths
    return stack
      .replace(/\/Users\/[^\/]+/g, '~')
      .replace(/\/home\/[^\/]+/g, '~')
      .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\...');
  }
}

/**
 * Create a sanitized error object
 */
export function createSanitizedError(
  message: string,
  originalError?: Error | unknown,
  options: SanitizationOptions = DEFAULT_OPTIONS
): Error {
  const sanitizedMessage = sanitizeError(message, options);
  const error = new Error(sanitizedMessage);
  
  // Preserve error name if it's a known error type
  if (originalError instanceof Error && originalError.name !== 'Error') {
    error.name = originalError.name;
  }
  
  // Add sanitized stack if requested
  if (options.includeStack && originalError instanceof Error && originalError.stack) {
    error.stack = sanitizeStackTrace(
      originalError.stack,
      options.level === 'strict' ? 'moderate' : (options.level === 'minimal' ? 'minimal' : 'moderate')
    );
  }
  
  return error;
}

/**
 * Utility to check if sanitization is enabled via environment
 */
export function isSanitizationEnabled(): boolean {
  return process.env.GEMINI_MCP_SANITIZE_ERRORS !== 'false';
}

/**
 * Get sanitization level from environment
 */
export function getSanitizationLevel(): SanitizationOptions['level'] {
  const level = process.env.GEMINI_MCP_SANITIZATION_LEVEL;
  if (level === 'strict' || level === 'moderate' || level === 'minimal') {
    return level;
  }
  return 'moderate'; // default
}

/**
 * Quick helper for common use case
 */
export function sanitize(error: Error | string | unknown): string {
  if (!isSanitizationEnabled()) {
    return error instanceof Error ? error.message : String(error);
  }
  
  return sanitizeError(error, {
    level: getSanitizationLevel(),
    includeStack: process.env.NODE_ENV === 'development',
    logOriginal: process.env.NODE_ENV === 'development',
  });
}

/**
 * Sanitize command arguments before logging
 * Prevents sensitive information from being exposed in logs
 */
export function sanitizeCommandArgs(command: string, args: string[]): { command: string; args: string[] } {
  if (!isSanitizationEnabled()) {
    return { command, args };
  }
  
  const level = getSanitizationLevel();
  const sanitizedArgs = args.map(arg => sanitizeCommandArg(arg, level));
  
  return { command, args: sanitizedArgs };
}

/**
 * Sanitize a single command argument
 */
function sanitizeCommandArg(arg: string, level: SanitizationOptions['level']): string {
  // Don't sanitize flags (arguments starting with -)
  if (arg.startsWith('-')) {
    return arg;
  }
  
  // Apply sanitization based on level
  let sanitized = arg;
  
  // Always sanitize obvious secrets
  for (const pattern of SANITIZATION_PATTERNS.secrets) {
    if (pattern.test(sanitized)) {
      return '<redacted>';
    }
  }
  
  // For strict mode, sanitize more aggressively
  if (level === 'strict') {
    // Sanitize file paths
    for (const pattern of SANITIZATION_PATTERNS.userPaths) {
      sanitized = sanitized.replace(pattern, REPLACEMENTS.userPath);
    }
    
    // Sanitize absolute paths
    if (sanitized.includes('/') || sanitized.includes('\\')) {
      return '<file-path>';
    }
    
    // Sanitize URLs
    if (sanitized.match(/^https?:\/\//)) {
      return '<url>';
    }
  } else if (level === 'moderate') {
    // Sanitize user paths
    for (const pattern of SANITIZATION_PATTERNS.userPaths) {
      sanitized = sanitized.replace(pattern, REPLACEMENTS.userPath);
    }
  }
  
  return sanitized;
}