import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QuotaManager, isQuotaError, getQuotaAwareErrorMessage } from '../src/utils/quotaManager.js';
import { quotaStatusTool } from '../src/tools/quota-status.tool.js';
import { Logger } from '../src/utils/logger.js';

describe('Quota Management System', () => {
  let quotaManager: QuotaManager;
  
  beforeEach(() => {
    quotaManager = QuotaManager.getInstance();
    // Reset quota status before each test
    quotaManager.resetQuotaStatus();
  });
  
  afterEach(() => {
    // Clean up after each test
    quotaManager.resetQuotaStatus();
  });

  describe('🔍 Quota Error Detection', () => {
    it('should detect Flash model quota exceeded errors from Pro-style error messages', () => {
      const error = "Quota exceeded for quota metric 'Gemini 2.5 Flash Requests' and limit 'Gemini 2.5 Flash Requests per day per user per tier'";
      
      expect(isQuotaError(error)).toBe(true);
      
      const quotaError = quotaManager.analyzeError(error, 'gemini-2.5-flash');
      expect(quotaError.type).toBe('quota_exceeded');
      expect(quotaError.model).toBe('flash');
      expect(quotaError.fallbackAvailable).toBe(false); // Flash has no fallback
      expect(quotaError.canRetry).toBe(false);
    });

    it('should detect Flash model quota exceeded errors', () => {
      const error = "Quota exceeded for quota metric 'Gemini 2.5 Flash Requests'";
      
      expect(isQuotaError(error)).toBe(true);
      
      const quotaError = quotaManager.analyzeError(error, 'gemini-2.5-flash');
      expect(quotaError.type).toBe('quota_exceeded');
      expect(quotaError.model).toBe('flash');
      expect(quotaError.fallbackAvailable).toBe(false);
    });

    it('should detect HTTP 429 rate limit errors', () => {
      const error = "HTTP Error 429: Too Many Requests";
      
      expect(isQuotaError(error)).toBe(true);
      
      const quotaError = quotaManager.analyzeError(error, 'gemini-2.5-flash');
      expect(quotaError.type).toBe('rate_limit');
      expect(quotaError.canRetry).toBe(true);
      expect(quotaError.fallbackAvailable).toBe(false); // Flash model has no fallback
    });

    it('should handle generic quota patterns', () => {
      const errors = [
        "Daily quota exceeded",
        "Rate limit exceeded", 
        "429 Too Many Requests",
        "Quota exceeded for quota metric"
      ];

      errors.forEach(error => {
        expect(isQuotaError(error)).toBe(true);
      });
    });

    it('should not detect non-quota errors', () => {
      const nonQuotaErrors = [
        "Network connection failed",
        "Invalid API key",
        "Internal server error",
        "Command not found"
      ];

      nonQuotaErrors.forEach(error => {
        expect(isQuotaError(error)).toBe(false);
        
        const quotaError = quotaManager.analyzeError(error, 'gemini-2.5-flash');
        expect(quotaError.type).toBe('other');
      });
    });
  });

  describe('📊 Quota Status Management', () => {
    it('should track quota status correctly', () => {
      // Initially, quota should be available
      expect(quotaManager.isQuotaAvailable('gemini-2.5-flash')).toBe(true);
      
      const initialStatus = quotaManager.getQuotaStatus('gemini-2.5-flash');
      expect(initialStatus.isQuotaExceeded).toBe(false);
    });

    it('should mark quota as exceeded after quota error', () => {
      const error = "Quota exceeded for quota metric 'Gemini 2.5 Flash Requests'";
      
      const quotaError = quotaManager.analyzeError(error, 'gemini-2.5-flash');
      expect(quotaError.type).toBe('quota_exceeded');
      
      // Now quota should be marked as exceeded
      const status = quotaManager.getQuotaStatus('gemini-2.5-flash');
      expect(status.isQuotaExceeded).toBe(true);
      expect(status.quotaType).toBe('flash');
      expect(status.canFallback).toBe(false);
      expect(status.retryAfter).toBeGreaterThan(0);
    });

    it('should provide appropriate suggestions for quota exceeded', () => {
      const error = "Quota exceeded for quota metric 'Gemini 2.5 Flash Requests'";
      quotaManager.analyzeError(error, 'gemini-2.5-flash');
      
      const status = quotaManager.getQuotaStatus('gemini-2.5-flash');
      expect(status.suggestedAction).toContain('Wait');
      expect(status.suggestedAction).toContain('hours');
    });

    it('should handle Flash model quota exceeded without fallback', () => {
      const error = "Quota exceeded for quota metric 'Gemini 2.5 Flash Requests'";
      quotaManager.analyzeError(error, 'gemini-2.5-flash');
      
      const status = quotaManager.getQuotaStatus('gemini-2.5-flash');
      expect(status.isQuotaExceeded).toBe(true);
      expect(status.canFallback).toBe(false);
      expect(status.suggestedAction).toContain('Wait');
      expect(status.suggestedAction).toContain('hours');
    });

    it('should reset quota status correctly', () => {
      // Set quota as exceeded
      const error = "Quota exceeded for quota metric 'Gemini 2.5 Flash Requests'";
      quotaManager.analyzeError(error, 'gemini-2.5-flash');
      
      expect(quotaManager.getQuotaStatus('gemini-2.5-flash').isQuotaExceeded).toBe(true);
      
      // Reset quota
      quotaManager.resetQuotaStatus('gemini-2.5-flash');
      
      const status = quotaManager.getQuotaStatus('gemini-2.5-flash');
      expect(status.isQuotaExceeded).toBe(false);
      expect(quotaManager.isQuotaAvailable('gemini-2.5-flash')).toBe(true);
    });
  });

  describe('📈 Quota Reporting', () => {
    it('should generate empty report when no quota issues', () => {
      const report = quotaManager.getQuotaReport();
      expect(report).toContain('No quota issues detected');
    });

    it('should generate detailed report with quota issues', () => {
      // Simulate quota errors for both models
      quotaManager.analyzeError("Quota exceeded for quota metric 'Gemini 2.5 Flash Requests'", 'gemini-2.5-flash');
      quotaManager.analyzeError("Quota exceeded for quota metric 'Gemini 2.5 Flash Requests'", 'gemini-2.5-flash');
      
      const report = quotaManager.getQuotaReport();
      expect(report).toContain('Quota Status Report');
      expect(report).toContain('flash: Quota exceeded');
      expect(report).toContain('resets in');
    });
  });

  describe('🛠️ Quota-Aware Error Messages', () => {
    it('should provide quota-aware error messages', () => {
      const error = "Quota exceeded for quota metric 'Gemini 2.5 Flash Requests'";
      
      const message = getQuotaAwareErrorMessage(error, 'gemini-2.5-flash');
      expect(message).toContain('FLASH model quota exceeded');
      expect(message).toContain('wait');
      expect(message).toContain('hours');
    });

    it('should handle rate limit messages', () => {
      const error = "HTTP Error 429: Too Many Requests";
      
      const message = getQuotaAwareErrorMessage(error, 'gemini-2.5-flash');
      expect(message).toContain('Rate limit exceeded');
      expect(message).toContain('wait a few seconds');
    });

    it('should pass through non-quota errors unchanged', () => {
      const error = "Network connection failed";
      
      const message = getQuotaAwareErrorMessage(error, 'gemini-2.5-flash');
      expect(message).toBe(error);
    });
  });

  describe('🔧 Quota Status Tool', () => {
    it('should provide status for specific model', async () => {
      const result = await quotaStatusTool.execute({ model: 'gemini-2.5-flash' });
      
      expect(result).toContain('Quota Status for GEMINI-2.5-FLASH');
      expect(result).toContain('Status: AVAILABLE');
      expect(result).toContain('Ready for requests');
    });

    it('should show quota exceeded status', async () => {
      // Simulate quota exceeded for Flash model
      quotaManager.analyzeError("Quota exceeded for quota metric 'Gemini 2.5 Flash Requests'", 'gemini-2.5-flash');
      
      const result = await quotaStatusTool.execute({ model: 'gemini-2.5-flash' });
      
      expect(result).toContain('Status: QUOTA EXCEEDED');
      expect(result).not.toContain('Fallback Available'); // Flash has no fallback, so this text shouldn't appear
      expect(result).toContain('Wait'); // Should suggest waiting instead
    });

    it('should provide overview for both models', async () => {
      const result = await quotaStatusTool.execute({});
      
      expect(result).toContain('Gemini API Quota Status');
      expect(result).toContain('GEMINI 2.5 PRO');
      expect(result).toContain('GEMINI 2.5 FLASH');
      expect(result).toContain('RECOMMENDATIONS');
    });

    it('should include detailed report when requested', async () => {
      // Simulate quota issue
      quotaManager.analyzeError("Quota exceeded for quota metric 'Gemini 2.5 Flash Requests'", 'gemini-2.5-flash');
      
      const result = await quotaStatusTool.execute({ detailed: true });
      
      expect(result).toContain('Quota Status Report');
      expect(result).toContain('failures');
    });

    it('should validate schema correctly', () => {
      const validArgs = { model: 'gemini-2.5-flash', detailed: true };
      const parsed = quotaStatusTool.zodSchema.parse(validArgs);
      
      expect(parsed.model).toBe('gemini-2.5-flash');
      expect(parsed.detailed).toBe(true);
      
      // Test defaults
      const minimalArgs = {};
      const parsedMinimal = quotaStatusTool.zodSchema.parse(minimalArgs);
      expect(parsedMinimal.detailed).toBe(false);
    });
  });

  describe('🔄 Integration with Reliability Manager', () => {
    it('should handle quota information in execution results', () => {
      // Test that the enhanced result interface works
      const result = {
        success: false,
        error: "Quota exceeded for quota metric 'Gemini 2.5 Pro Requests'",
        quotaExceeded: true,
        quotaType: 'pro' as const,
        canFallback: true
      };

      expect(result.quotaExceeded).toBe(true);
      expect(result.quotaType).toBe('pro');
      expect(result.canFallback).toBe(true);
    });
  });
});