import { BaseTool } from '../tools/base-tool.js';
import { CacheManager, CacheStats } from './cache-manager.js';
import { SecurityValidator, SecurityStats } from './security-validator.js';
import { PerformanceMonitor, PerformanceStats } from './performance-monitor.js';
import { createStructuredResponse } from './structured-response.js';
import { ToolBehavior } from '../types/tool-behavior.js';

interface Tool {
  name: string;
  description: string;
  inputSchema: any;
  execute: (args: any) => Promise<any>;
  behavior?: ToolBehavior;
  asPrompt?: any;
}

interface EnhancementConfig {
  cacheEnabled: boolean;
  securityEnabled: boolean;
  performanceEnabled: boolean;
  debugLevel: number;
  dryRun: boolean;
}

/**
 * Base class for tool enhancers
 */
abstract class ToolEnhancerBase implements Tool {
  protected tool: Tool;
  
  constructor(tool: Tool) {
    this.tool = tool;
  }
  
  get name() { return this.tool.name; }
  get description() { return this.tool.description; }
  get inputSchema() { return this.tool.inputSchema; }
  get behavior() { return this.tool.behavior; }
  get asPrompt() { return this.tool.asPrompt; }
  
  abstract execute(args: any): Promise<any>;
}

/**
 * Cached tool wrapper
 */
class CachedTool extends ToolEnhancerBase {
  private cacheManager: CacheManager;
  
  constructor(tool: Tool, cacheManager: CacheManager) {
    super(tool);
    this.cacheManager = cacheManager;
  }
  
  async execute(args: any): Promise<any> {
    const cacheKey = this.cacheManager.generateCacheKey(this.name, args);
    
    // Check cache first
    const cachedResult = this.cacheManager.get(cacheKey);
    if (cachedResult) {
      console.warn(`[Gemini MCP] Cache hit for ${this.name}`);
      
      // Add cache metadata to response if it's a structured response
      if (typeof cachedResult === 'string' && cachedResult.includes('[SYSTEM_METADATA]')) {
        const metadataMatch = cachedResult.match(/\[SYSTEM_METADATA\]: (.+)/);
        if (metadataMatch) {
          const metadata = JSON.parse(metadataMatch[1]);
          metadata.metadata = metadata.metadata || {};
          metadata.metadata.cache_hit = true;
          const updatedMetadata = `[SYSTEM_METADATA]: ${JSON.stringify(metadata)}`;
          return cachedResult.replace(/\[SYSTEM_METADATA\]: .+/, updatedMetadata);
        }
      }
      return cachedResult;
    }
    
    // Execute tool and cache result
    const result = await this.tool.execute(args);
    this.cacheManager.set(cacheKey, result);
    
    return result;
  }
}

/**
 * Security validated tool wrapper
 */
class SecurityValidatedTool extends ToolEnhancerBase {
  private securityValidator: SecurityValidator;
  
  constructor(tool: Tool, securityValidator: SecurityValidator) {
    super(tool);
    this.securityValidator = securityValidator;
  }
  
  async execute(args: any): Promise<any> {
    // Validate paths in arguments
    if (args.file_path) {
      await this.securityValidator.validatePath(args.file_path);
    }
    
    if (args.paths && Array.isArray(args.paths)) {
      for (const path of args.paths) {
        await this.securityValidator.validatePath(path);
      }
    }
    
    // Add security validation metadata
    const result = await this.tool.execute(args);
    
    if (typeof result === 'string' && result.includes('[SYSTEM_METADATA]')) {
      const metadataMatch = result.match(/\[SYSTEM_METADATA\]: (.+)/);
      if (metadataMatch) {
        const metadata = JSON.parse(metadataMatch[1]);
        metadata.metadata = metadata.metadata || {};
        metadata.metadata.security_validated = true;
        const updatedMetadata = `[SYSTEM_METADATA]: ${JSON.stringify(metadata)}`;
        return result.replace(/\[SYSTEM_METADATA\]: .+/, updatedMetadata);
      }
    }
    
    return result;
  }
}

/**
 * Performance monitored tool wrapper
 */
class PerformanceMonitoredTool extends ToolEnhancerBase {
  private performanceMonitor: PerformanceMonitor;
  
  constructor(tool: Tool, performanceMonitor: PerformanceMonitor) {
    super(tool);
    this.performanceMonitor = performanceMonitor;
  }
  
  async execute(args: any): Promise<any> {
    const timerName = `${this.name}_execution`;
    this.performanceMonitor.startTimer(timerName);
    
    try {
      const result = await this.tool.execute(args);
      const duration = this.performanceMonitor.endTimer(timerName);
      
      // Record metrics
      this.performanceMonitor.recordMetrics(this.name, duration, {
        args: JSON.stringify(args).length,
        resultSize: typeof result === 'string' ? result.length : JSON.stringify(result).length
      });
      
      // Add performance metadata
      if (typeof result === 'string' && result.includes('[SYSTEM_METADATA]')) {
        const metadataMatch = result.match(/\[SYSTEM_METADATA\]: (.+)/);
        if (metadataMatch) {
          const metadata = JSON.parse(metadataMatch[1]);
          metadata.metadata = metadata.metadata || {};
          metadata.metadata.timing = duration;
          metadata.metadata.performance_metrics = {
            execution_time_ms: duration,
            memory_usage_mb: process.memoryUsage().heapUsed / 1024 / 1024
          };
          const updatedMetadata = `[SYSTEM_METADATA]: ${JSON.stringify(metadata)}`;
          return result.replace(/\[SYSTEM_METADATA\]: .+/, updatedMetadata);
        }
      }
      
      return result;
    } catch (error) {
      this.performanceMonitor.endTimer(timerName);
      throw error;
    }
  }
}

/**
 * Main tool enhancer that applies all configured enhancements
 */
export class ToolEnhancer {
  private config: EnhancementConfig;
  private cacheManager: CacheManager;
  private securityValidator: SecurityValidator;
  private performanceMonitor: PerformanceMonitor;
  
  constructor() {
    // Load configuration from environment variables
    this.config = {
      cacheEnabled: process.env.GEMINI_MCP_CACHE_ENABLED !== 'false',
      securityEnabled: process.env.GEMINI_MCP_SECURITY_ENABLED !== 'false',
      performanceEnabled: process.env.GEMINI_MCP_PERFORMANCE_ENABLED !== 'false',
      debugLevel: parseInt(process.env.DEBUG_LEVEL || '1', 10),
      dryRun: process.env.DRY_RUN === 'true'
    };
    
    // Initialize components
    this.cacheManager = new CacheManager();
    this.securityValidator = new SecurityValidator();
    this.performanceMonitor = new PerformanceMonitor();
    
    if (this.config.debugLevel >= 1) {
      console.warn('[Gemini MCP] Tool enhancer initialized with config:', this.config);
    }
  }
  
  /**
   * Enhance a tool with configured features
   */
  enhance(tool: Tool | undefined): Tool | undefined {
    if (!tool) return undefined;
    
    let enhancedTool: Tool = tool;
    
    // Apply enhancements in order: performance -> security -> cache
    // This ensures performance metrics include all operations
    if (this.config.performanceEnabled) {
      enhancedTool = new PerformanceMonitoredTool(enhancedTool, this.performanceMonitor);
      if (this.config.debugLevel >= 2) {
        console.warn(`[Gemini MCP] Added performance monitoring to ${tool.name}`);
      }
    }
    
    if (this.config.securityEnabled) {
      enhancedTool = new SecurityValidatedTool(enhancedTool, this.securityValidator);
      if (this.config.debugLevel >= 2) {
        console.warn(`[Gemini MCP] Added security validation to ${tool.name}`);
      }
    }
    
    if (this.config.cacheEnabled) {
      enhancedTool = new CachedTool(enhancedTool, this.cacheManager);
      if (this.config.debugLevel >= 2) {
        console.warn(`[Gemini MCP] Added caching to ${tool.name}`);
      }
    }
    
    return enhancedTool;
  }
  
  /**
   * Get current enhancement statistics
   */
  getStats() {
    return {
      cache: this.cacheManager.getStats(),
      performance: this.performanceMonitor.getStats(),
      security: this.securityValidator.getStats()
    };
  }
  
  /**
   * Clear all caches and reset statistics
   */
  reset() {
    this.cacheManager.clear();
    this.performanceMonitor.reset();
    this.securityValidator.reset();
  }
}

// Export singleton instance
export const toolEnhancer = new ToolEnhancer();