import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { QuotaManager } from '../utils/quotaManager.js';
import { GeminiCliReliabilityManager } from '../utils/geminiCliReliabilityManager.js';
import { Logger } from '../utils/logger.js';

export const quotaStatusTool: UnifiedTool = {
  name: 'quota-status',
  category: 'gemini',
  description: 'Check current quota status and get recommendations for Gemini API usage',
  
  zodSchema: z.object({
    model: z.string().optional().describe('Specific model to check (gemini-2.5-pro or gemini-2.5-flash)'),
    detailed: z.boolean().default(false).describe('Include detailed quota information and history')
  }),

  async execute(args: { model?: string; detailed?: boolean }) {
    try {
      const quotaManager = QuotaManager.getInstance();
      
      if (args.model) {
        // Check specific model
        const status = quotaManager.getQuotaStatus(args.model);
        const availability = quotaManager.isQuotaAvailable(args.model);
        
        let result = `=== Quota Status for ${args.model.toUpperCase()} ===\n`;
        
        if (status.isQuotaExceeded) {
          result += `❌ Status: QUOTA EXCEEDED\n`;
          result += `📊 Details: ${status.errorDetails}\n`;
          result += `💡 Suggestion: ${status.suggestedAction}\n`;
          
          if (status.retryAfter) {
            const hours = Math.ceil(status.retryAfter / 3600);
            result += `⏰ Retry After: ~${hours} hours\n`;
          }
          
          if (status.canFallback) {
            result += `🔄 Fallback Available: Yes (use gemini-2.5-flash)\n`;
          }
        } else {
          result += `✅ Status: AVAILABLE\n`;
          result += `📊 Current State: Ready for requests\n`;
          result += `💡 Suggestion: ${status.suggestedAction}\n`;
        }
        
        result += `🔍 Real-time Check: ${availability ? 'Available' : 'Not Available'}\n`;
        
        return result;
      } else {
        // Check both models
        const proStatus = quotaManager.getQuotaStatus('gemini-2.5-pro');
        const flashStatus = quotaManager.getQuotaStatus('gemini-2.5-flash');
        
        let result = `=== Gemini API Quota Status ===\n\n`;
        
        // Pro model status
        result += `🚀 GEMINI 2.5 PRO:\n`;
        if (proStatus.isQuotaExceeded) {
          result += `   ❌ Status: QUOTA EXCEEDED\n`;
          result += `   📊 ${proStatus.errorDetails}\n`;
          result += `   💡 ${proStatus.suggestedAction}\n`;
          if (proStatus.retryAfter) {
            const hours = Math.ceil(proStatus.retryAfter / 3600);
            result += `   ⏰ Resets in: ~${hours} hours\n`;
          }
        } else {
          result += `   ✅ Status: AVAILABLE\n`;
          result += `   📊 Ready for requests\n`;
        }
        
        result += `\n⚡ GEMINI 2.5 FLASH:\n`;
        if (flashStatus.isQuotaExceeded) {
          result += `   ❌ Status: QUOTA EXCEEDED\n`;
          result += `   📊 ${flashStatus.errorDetails}\n`;
          result += `   💡 ${flashStatus.suggestedAction}\n`;
          if (flashStatus.retryAfter) {
            const hours = Math.ceil(flashStatus.retryAfter / 3600);
            result += `   ⏰ Resets in: ~${hours} hours\n`;
          }
        } else {
          result += `   ✅ Status: AVAILABLE\n`;
          result += `   📊 Ready for requests\n`;
        }
        
        // Recommendations
        result += `\n💭 RECOMMENDATIONS:\n`;
        if (!proStatus.isQuotaExceeded) {
          result += `   • Use gemini-2.5-pro for complex tasks requiring highest quality\n`;
        }
        if (!flashStatus.isQuotaExceeded) {
          result += `   • Use gemini-2.5-flash for faster responses and testing\n`;
        }
        if (proStatus.isQuotaExceeded && !flashStatus.isQuotaExceeded) {
          result += `   • Switch to gemini-2.5-flash until Pro quota resets\n`;
        }
        if (proStatus.isQuotaExceeded && flashStatus.isQuotaExceeded) {
          result += `   • Both models exceed quota - wait for reset (typically midnight UTC)\n`;
        }
        
        // CLI diagnostic information
        result += `\n🔧 CLI DIAGNOSTICS:\n`;
        const cliVersion = await GeminiCliReliabilityManager.getCliVersion();
        if (cliVersion) {
          result += `   ✅ CLI Version: ${cliVersion}\n`;
        } else {
          result += `   ❌ CLI not installed or not accessible\n`;
        }
        
        // Detailed report if requested
        if (args.detailed) {
          result += `\n${quotaManager.getQuotaReport()}`;
        }
        
        return result;
      }
    } catch (error) {
      Logger.error('Error checking quota status:', error);
      return `❌ Error checking quota status: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
};