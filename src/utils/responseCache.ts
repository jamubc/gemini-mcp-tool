import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';
import { Logger } from './logger.js';
import { GeminiCLIOptions } from './geminiExecutor.js';

/**
 * LRU Cache for Gemini API responses
 * Caches responses to identical prompts with identical options
 *
 * Benefits:
 * - Near-instant responses for repeated queries
 * - Reduces API quota consumption
 * - 30-minute TTL ensures fresh data
 * - 10MB max size prevents memory bloat
 */
const responseCache = new LRUCache<string, string>({
  max: 100,  // Cache up to 100 recent responses
  ttl: 1000 * 60 * 30,  // 30 minutes
  maxSize: 10 * 1024 * 1024,  // 10MB max cache size
  sizeCalculation: (value) => value.length,
  dispose: (value, key) => {
    Logger.debug(`Cache evicted: ${key.substring(0, 16)}...`);
  }
});

/**
 * Generate a cache key from prompt and options
 */
export function generateCacheKey(prompt: string, options: GeminiCLIOptions): string {
  // Create deterministic hash of prompt + options
  const cacheInput = JSON.stringify({
    prompt,
    model: options.model,
    sandbox: options.sandbox,
    changeMode: options.changeMode,
    yolo: options.yolo,
    approvalMode: options.approvalMode,
    outputFormat: options.outputFormat,
    includeDirectories: options.includeDirectories,
    debug: options.debug,
    promptInteractive: options.promptInteractive,
    extensions: options.extensions,
    resume: options.resume
  });

  return createHash('sha256').update(cacheInput).digest('hex');
}

/**
 * Get cached response if available
 */
export function getCachedResponse(cacheKey: string): string | undefined {
  const cached = responseCache.get(cacheKey);
  if (cached) {
    Logger.debug(`Cache hit: ${cacheKey.substring(0, 16)}...`);
  }
  return cached;
}

/**
 * Cache a response
 */
export function cacheResponse(cacheKey: string, response: string): void {
  responseCache.set(cacheKey, response);
  Logger.debug(`Cached response: ${cacheKey.substring(0, 16)}... (${response.length} bytes)`);
}

/**
 * Clear the entire cache
 */
export function clearCache(): void {
  responseCache.clear();
  Logger.debug('Response cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: responseCache.size,
    maxSize: responseCache.max,
    calculatedSize: responseCache.calculatedSize,
    maxCalculatedSize: responseCache.maxSize
  };
}
