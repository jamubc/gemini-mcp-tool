/**
 * TokenEstimator - Accurate token and byte counting for chat history management
 * Replaces naive character counting with proper Unicode and token estimation
 */

export interface TokenEstimate {
  characters: number;
  bytes: number;
  tokens: number;
  truncationSafe: boolean;
}

export interface EstimationConfig {
  tokensPerCharacterRatio: number; // Typical: 0.75 for English text
  maxTokens: number; // Gemini model limit: ~2M tokens
  maxBytes: number; // Platform limits: Windows CLI ~8KB
  safetyMargin: number; // Reserve space: 0.1 = 10%
}

/**
 * Provides accurate token and byte estimation for chat content
 * Addresses the character vs byte confusion in the original implementation
 */
export class TokenEstimator {
  private config: EstimationConfig;

  constructor(config?: Partial<EstimationConfig>) {
    this.config = {
      tokensPerCharacterRatio: 0.75,
      maxTokens: 2000000, // Gemini 2.5 Pro limit
      maxBytes: 8000, // Windows CLI safe limit
      safetyMargin: 0.1,
      ...config
    };
  }

  /**
   * Estimate tokens, bytes, and safety metrics for given text
   */
  estimate(text: string): TokenEstimate {
    const characters = text.length;
    
    // Use TextEncoder for accurate byte counting (UTF-8)
    const bytes = new TextEncoder().encode(text).length;
    
    // Estimate tokens based on character count and language model ratios
    const tokens = Math.ceil(characters * this.config.tokensPerCharacterRatio);
    
    // Determine if content is within safe limits
    const withinTokenLimit = tokens <= (this.config.maxTokens * (1 - this.config.safetyMargin));
    const withinByteLimit = bytes <= (this.config.maxBytes * (1 - this.config.safetyMargin));
    
    return {
      characters,
      bytes,
      tokens,
      truncationSafe: withinTokenLimit && withinByteLimit
    };
  }

  /**
   * Estimate combined size for multiple text pieces
   */
  estimateBatch(texts: string[]): TokenEstimate {
    const combinedText = texts.join('');
    return this.estimate(combinedText);
  }

  /**
   * Calculate safe truncation point for given text to fit within limits
   */
  calculateSafeTruncationPoint(text: string): number {
    const estimate = this.estimate(text);
    
    if (estimate.truncationSafe) {
      return text.length;
    }

    // Binary search for optimal truncation point
    let left = 0;
    let right = text.length;
    let bestPoint = 0;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const substring = text.substring(0, mid);
      const subEstimate = this.estimate(substring);

      if (subEstimate.truncationSafe) {
        bestPoint = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return bestPoint;
  }

  /**
   * Update configuration for different contexts (e.g., different models)
   */
  updateConfig(newConfig: Partial<EstimationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current estimation configuration
   */
  getConfig(): EstimationConfig {
    return { ...this.config };
  }
}

/**
 * Default instance for common use cases
 */
export const defaultTokenEstimator = new TokenEstimator();