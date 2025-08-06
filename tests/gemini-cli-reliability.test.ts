import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GeminiCliReliabilityManager } from '../src/utils/geminiCliReliabilityManager.js';
import { Logger } from '../src/utils/logger.js';

describe('Gemini CLI Reliability Manager Tests', () => {
  // Extended timeout for CLI operations
  const CLI_TIMEOUT = 45000; // 45 seconds for reliability testing

  beforeAll(() => {
    // Enable debug logging for troubleshooting
    process.env.LOG_LEVEL = 'debug';
  });

  afterAll(() => {
    delete process.env.LOG_LEVEL;
  });

  describe('🔧 Enhanced Timeout Handling', () => {
    it('should successfully execute simple command with reliability enhancements', async () => {
      const result = await GeminiCliReliabilityManager.executeGeminiCommandReliably(
        'Hello, please respond with exactly "Test successful"',
        {
          model: 'gemini-2.5-flash',
          timeout: 15000,
          maxRetries: 2,
          progressiveTimeout: true
        }
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.timeout).toBe(false);
      
      // Log result for debugging
      Logger.info(`Gemini CLI Response: "${result.output}"`);
    }, CLI_TIMEOUT);

    it('should handle timeout gracefully with progressive strategy', async () => {
      // Use extremely short timeout to test timeout handling
      const result = await GeminiCliReliabilityManager.executeGeminiCommandReliably(
        'Please write a very long response about the history of computing, include many details',
        {
          model: 'gemini-2.5-flash',
          timeout: 100, // Very short timeout to force timeout
          maxRetries: 1,
          progressiveTimeout: false
        }
      );

      // Should fail due to timeout but handle gracefully
      expect(result.success).toBe(false);
      expect(result.timeout).toBe(true);
      expect(result.error).toContain('timeout');
    }, CLI_TIMEOUT);

    it('should test Gemini CLI availability before execution', async () => {
      const isAvailable = await GeminiCliReliabilityManager.testGeminiAvailability();
      
      // Log availability status
      Logger.info(`Gemini CLI availability: ${isAvailable}`);
      
      // This test should pass if Gemini CLI is properly configured
      // If it fails, it indicates a setup issue
      expect(typeof isAvailable).toBe('boolean');
    }, CLI_TIMEOUT);

    it('should get appropriate timeout for test environment', () => {
      const timeout = GeminiCliReliabilityManager.getTestTimeout();
      
      // Should return a reasonable timeout value
      expect(timeout).toBeGreaterThan(10000); // At least 10 seconds
      expect(timeout).toBeLessThan(60000);    // Less than 60 seconds
      
      Logger.debug(`Recommended test timeout: ${timeout}ms`);
    });
  });

  describe('🛡️ Error Handling and Recovery', () => {
    it('should handle invalid command gracefully', async () => {
      const result = await GeminiCliReliabilityManager.executeGeminiCommandReliably(
        '', // Empty prompt to trigger error
        {
          model: 'gemini-2.5-flash',
          timeout: 5000,
          maxRetries: 1,
          progressiveTimeout: false
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    }, CLI_TIMEOUT);

    it('should handle model fallback scenarios', async () => {
      // Test with a model that might have quota issues
      const result = await GeminiCliReliabilityManager.executeGeminiCommandReliably(
        'Simple test message',
        {
          model: 'gemini-2.5-pro', // Pro model might have quota limits
          timeout: 15000,
          maxRetries: 1,
          progressiveTimeout: false
        }
      );

      // Result should be either successful or have meaningful error
      if (!result.success) {
        expect(result.error).toBeDefined();
        Logger.warn(`Model fallback test result: ${result.error}`);
      } else {
        expect(result.output).toBeDefined();
        Logger.info(`Model fallback test successful: ${result.output}`);
      }
    }, CLI_TIMEOUT);
  });

  describe('🚀 Performance and Optimization', () => {
    it('should execute multiple requests reliably', async () => {
      const promises = Array.from({ length: 3 }, (_, i) => 
        GeminiCliReliabilityManager.executeGeminiCommandReliably(
          `Request ${i + 1}: What is ${i + 1} + ${i + 1}?`,
          {
            model: 'gemini-2.5-flash',
            timeout: 10000,
            maxRetries: 1,
            progressiveTimeout: false
          }
        )
      );

      const results = await Promise.allSettled(promises);
      
      // Count successful and failed requests
      let successful = 0;
      let failed = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          successful++;
          Logger.debug(`Request ${index + 1} successful: ${result.value.output}`);
        } else {
          failed++;
          const error = result.status === 'rejected' 
            ? result.reason 
            : result.value.error;
          Logger.warn(`Request ${index + 1} failed: ${error}`);
        }
      });

      Logger.info(`Batch execution: ${successful} successful, ${failed} failed`);
      
      // At least one request should succeed if Gemini CLI is available
      expect(successful).toBeGreaterThan(0);
    }, CLI_TIMEOUT);
  });
});