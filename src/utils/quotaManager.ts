import { Logger } from './logger.js';
import { ERROR_MESSAGES, STATUS_MESSAGES, MODELS } from '../constants.js';

export interface QuotaStatus {
  isQuotaExceeded: boolean;
  quotaType: 'pro' | 'flash' | 'unknown';
  canFallback: boolean;
  errorDetails: string;
  retryAfter?: number; // seconds until quota resets
  suggestedAction: string;
}

export interface QuotaError {
  type: 'quota_exceeded' | 'rate_limit' | 'other';
  model: string;
  canRetry: boolean;
  fallbackAvailable: boolean;
  message: string;
}

/**
 * Comprehensive quota management and detection for Gemini CLI
 */
export class QuotaManager {
  private static instance: QuotaManager;
  private quotaResetTime: Map<string, number> = new Map(); // Track when quotas reset
  private failureCount: Map<string, number> = new Map(); // Track consecutive failures
  
  private constructor() {}
  
  public static getInstance(): QuotaManager {
    if (!QuotaManager.instance) {
      QuotaManager.instance = new QuotaManager();
    }
    return QuotaManager.instance;
  }

  /**
   * Analyze error message to determine if it's quota-related
   */
  public analyzeError(errorMessage: string, model: string = 'unknown'): QuotaError {
    const lowerError = errorMessage.toLowerCase();
    
    // Check for rate limiting first (more specific patterns)
    if (lowerError.includes('429') || lowerError.includes('too many requests') || lowerError.includes('rate limit')) {
      Logger.warn(`Rate limit detected for ${model} model`);
      return {
        type: 'rate_limit',
        model,
        canRetry: true, // Rate limits are usually temporary
        fallbackAvailable: model !== MODELS.FLASH,
        message: `Rate limit exceeded. Please wait a few seconds before retrying.`
      };
    }
    
    // Check for quota patterns (exclude rate limit patterns already handled above)
    const quotaOnlyPatterns = ERROR_MESSAGES.QUOTA_PATTERNS.filter(pattern => 
      !['429', 'Too Many Requests', 'Rate limit exceeded'].includes(pattern)
    );
    const isQuotaExceeded = quotaOnlyPatterns.some(pattern => 
      lowerError.includes(pattern.toLowerCase())
    );
    
    if (isQuotaExceeded) {
      // Determine which model's quota is exceeded
      let quotaModel = 'unknown';
      if (lowerError.includes('gemini 2.5 pro')) {
        quotaModel = 'pro';
      } else if (lowerError.includes('gemini 2.5 flash')) {
        quotaModel = 'flash';
      } else if (model) {
        quotaModel = model.includes('pro') ? 'pro' : model.includes('flash') ? 'flash' : 'unknown';
      }
      
      // Determine if fallback is possible
      const fallbackAvailable = quotaModel === 'pro' || (quotaModel === 'unknown' && model !== MODELS.FLASH);
      
      // Set quota reset time (typically 24 hours for daily quotas)
      const resetTime = this.calculateQuotaReset();
      this.quotaResetTime.set(quotaModel, resetTime);
      
      // Increment failure count
      const currentCount = this.failureCount.get(quotaModel) || 0;
      this.failureCount.set(quotaModel, currentCount + 1);
      
      Logger.warn(`Quota exceeded for ${quotaModel} model. Failure count: ${currentCount + 1}`);
      
      return {
        type: 'quota_exceeded',
        model: quotaModel,
        canRetry: false,
        fallbackAvailable,
        message: this.formatQuotaMessage(quotaModel, fallbackAvailable, resetTime)
      };
    }
    
    return {
      type: 'other',
      model,
      canRetry: true,
      fallbackAvailable: false,
      message: errorMessage
    };
  }

  /**
   * Check if quota is currently available for a model
   */
  public isQuotaAvailable(model: string): boolean {
    const modelKey = model.includes('pro') ? 'pro' : model.includes('flash') ? 'flash' : model;
    const resetTime = this.quotaResetTime.get(modelKey);
    
    if (!resetTime) {
      return true; // No recorded quota issues
    }
    
    const now = Date.now();
    if (now >= resetTime) {
      // Quota should have reset
      this.quotaResetTime.delete(modelKey);
      this.failureCount.delete(modelKey);
      Logger.info(`Quota reset detected for ${modelKey} model`);
      return true;
    }
    
    return false; // Still within quota exceeded period
  }

  /**
   * Get detailed quota status for a model
   */
  public getQuotaStatus(model: string): QuotaStatus {
    const modelKey = model.includes('pro') ? 'pro' : model.includes('flash') ? 'flash' : 'unknown';
    const resetTime = this.quotaResetTime.get(modelKey);
    const failureCount = this.failureCount.get(modelKey) || 0;
    
    if (!resetTime || Date.now() >= resetTime) {
      return {
        isQuotaExceeded: false,
        quotaType: modelKey as 'pro' | 'flash' | 'unknown',
        canFallback: false,
        errorDetails: '',
        suggestedAction: `${model} is available for use`
      };
    }
    
    const secondsUntilReset = Math.ceil((resetTime - Date.now()) / 1000);
    const hoursUntilReset = Math.ceil(secondsUntilReset / 3600);
    
    return {
      isQuotaExceeded: true,
      quotaType: modelKey as 'pro' | 'flash' | 'unknown',
      canFallback: modelKey === 'pro', // Can fallback from Pro to Flash
      errorDetails: `Quota exceeded ${failureCount} time(s)`,
      retryAfter: secondsUntilReset,
      suggestedAction: modelKey === 'pro' 
        ? `Use 'gemini-2.5-flash' model or wait ${hoursUntilReset} hours for quota reset`
        : `Wait ${hoursUntilReset} hours for quota reset`
    };
  }

  /**
   * Reset quota status for testing or manual override
   */
  public resetQuotaStatus(model?: string): void {
    if (model) {
      const modelKey = model.includes('pro') ? 'pro' : model.includes('flash') ? 'flash' : model;
      this.quotaResetTime.delete(modelKey);
      this.failureCount.delete(modelKey);
      Logger.info(`Reset quota status for ${modelKey} model`);
    } else {
      this.quotaResetTime.clear();
      this.failureCount.clear();
      Logger.info('Reset all quota statuses');
    }
  }

  /**
   * Get quota report for debugging and monitoring
   */
  public getQuotaReport(): string {
    const report: string[] = ['=== Quota Status Report ==='];
    
    if (this.quotaResetTime.size === 0) {
      report.push('✅ No quota issues detected');
      return report.join('\n');
    }
    
    for (const [model, resetTime] of this.quotaResetTime.entries()) {
      const failureCount = this.failureCount.get(model) || 0;
      const secondsUntilReset = Math.max(0, Math.ceil((resetTime - Date.now()) / 1000));
      const hoursUntilReset = Math.ceil(secondsUntilReset / 3600);
      
      if (secondsUntilReset > 0) {
        report.push(`❌ ${model}: Quota exceeded (${failureCount} failures), resets in ${hoursUntilReset}h`);
      } else {
        report.push(`✅ ${model}: Quota should be available (was exceeded ${failureCount} times)`);
      }
    }
    
    return report.join('\n');
  }

  private calculateQuotaReset(): number {
    // Assume daily quota resets at midnight UTC
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }

  private formatQuotaMessage(quotaModel: string, fallbackAvailable: boolean, resetTime: number): string {
    const hoursUntilReset = Math.ceil((resetTime - Date.now()) / (1000 * 60 * 60));
    
    if (fallbackAvailable) {
      return `${quotaModel.toUpperCase()} model quota exceeded. Fallback to Flash model available. Quota resets in ~${hoursUntilReset} hours.`;
    } else {
      return `${quotaModel.toUpperCase()} model quota exceeded. Please wait ~${hoursUntilReset} hours for quota reset.`;
    }
  }
}

/**
 * Convenience function to check if an error is quota-related
 */
export function isQuotaError(error: string | Error): boolean {
  const errorMessage = error instanceof Error ? error.message : error;
  return ERROR_MESSAGES.QUOTA_PATTERNS.some(pattern => 
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Convenience function to get quota-aware error message
 */
export function getQuotaAwareErrorMessage(error: string | Error, model?: string): string {
  const errorMessage = error instanceof Error ? error.message : error;
  const quotaManager = QuotaManager.getInstance();
  const quotaError = quotaManager.analyzeError(errorMessage, model);
  
  if (quotaError.type === 'quota_exceeded') {
    return quotaError.message;
  } else if (quotaError.type === 'rate_limit') {
    return `⏳ ${quotaError.message}`;
  }
  
  return errorMessage;
}