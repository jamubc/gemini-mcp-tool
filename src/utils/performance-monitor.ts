import * as os from 'os';

export interface PerformanceMetrics {
  tool: string;
  duration: number;
  timestamp: number;
  metadata?: any;
  memory?: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    delta: {
      heapUsed: number;
      external: number;
    };
  };
  cpu?: {
    usage: number;
  };
}

interface PerformanceConfig {
  enabled: boolean;
  threshold: number;
  sampleRate: number;
  maxMetrics: number;
  includeMemory: boolean;
  includeCpu: boolean;
}

export interface PerformanceStats {
  totalOperations: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  slowOperations: number;
  byTool: Record<string, {
    count: number;
    totalDuration: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
  }>;
}

interface Timer {
  name: string;
  startTime: number;
  startMemory?: NodeJS.MemoryUsage;
  startCpu?: NodeJS.CpuUsage;
}

/**
 * Performance monitoring with nested timing support
 */
export class PerformanceMonitor {
  private timers: Map<string, Timer>;
  private metrics: PerformanceMetrics[];
  private config: PerformanceConfig;
  private nestedTimers: Map<string, Timer[]>;
  
  constructor() {
    this.timers = new Map();
    this.metrics = [];
    this.nestedTimers = new Map();
    
    // Load configuration from environment variables
    this.config = {
      enabled: process.env.GEMINI_MCP_PERFORMANCE_ENABLED !== 'false',
      threshold: parseInt(process.env.GEMINI_MCP_PERFORMANCE_THRESHOLD || '1000', 10),
      sampleRate: parseFloat(process.env.GEMINI_MCP_PERFORMANCE_SAMPLE_RATE || '1.0'),
      maxMetrics: parseInt(process.env.GEMINI_MCP_MAX_METRICS || '1000', 10),
      includeMemory: process.env.GEMINI_MCP_TRACK_MEMORY !== 'false',
      includeCpu: process.env.GEMINI_MCP_TRACK_CPU === 'true'
    };
    
    // Start periodic stats reporting if debug level is high
    const debugLevel = parseInt(process.env.DEBUG_LEVEL || '1', 10);
    if (debugLevel >= 2 && this.config.enabled) {
      this.startPeriodicReporting();
    }
  }
  
  /**
   * Start a timer for performance measurement
   */
  startTimer(name: string): void {
    if (!this.config.enabled) return;
    
    // Check sample rate
    if (Math.random() > this.config.sampleRate) return;
    
    const timer: Timer = {
      name,
      startTime: performance.now()
    };
    
    // Capture memory usage if enabled
    if (this.config.includeMemory) {
      timer.startMemory = process.memoryUsage();
    }
    
    // Capture CPU usage if enabled
    if (this.config.includeCpu) {
      timer.startCpu = process.cpuUsage();
    }
    
    // Support nested timers
    const parentTimer = this.findParentTimer(name);
    if (parentTimer) {
      const stack = this.nestedTimers.get(parentTimer) || [];
      stack.push(timer);
      this.nestedTimers.set(parentTimer, stack);
    }
    
    this.timers.set(name, timer);
  }
  
  /**
   * End a timer and return duration in milliseconds
   */
  endTimer(name: string): number {
    if (!this.config.enabled) return 0;
    
    const timer = this.timers.get(name);
    if (!timer) return 0;
    
    const duration = performance.now() - timer.startTime;
    
    // Clean up timer
    this.timers.delete(name);
    
    // Clean up nested timers
    this.nestedTimers.delete(name);
    
    return duration;
  }
  
  /**
   * Record performance metrics for a tool
   */
  recordMetrics(tool: string, duration: number, metadata?: any): void {
    if (!this.config.enabled) return;
    
    const metrics: PerformanceMetrics = {
      tool,
      duration,
      timestamp: Date.now(),
      metadata
    };
    
    // Get memory delta if we have start memory
    const timer = this.timers.get(`${tool}_execution`);
    if (timer && timer.startMemory && this.config.includeMemory) {
      const endMemory = process.memoryUsage();
      metrics.memory = {
        before: timer.startMemory,
        after: endMemory,
        delta: {
          heapUsed: endMemory.heapUsed - timer.startMemory.heapUsed,
          external: endMemory.external - timer.startMemory.external
        }
      };
    }
    
    // Get CPU usage if we have start CPU
    if (timer && timer.startCpu && this.config.includeCpu) {
      const endCpu = process.cpuUsage(timer.startCpu);
      metrics.cpu = {
        usage: (endCpu.user + endCpu.system) / 1000 // Convert to milliseconds
      };
    }
    
    this.metrics.push(metrics);
    
    // Enforce max metrics limit
    if (this.metrics.length > this.config.maxMetrics) {
      this.metrics.shift(); // Remove oldest
    }
    
    // Log slow operations
    if (duration > this.config.threshold) {
      this.logSlowOperation(tool, duration, metadata);
    }
  }
  
  /**
   * Find parent timer for nested timing
   */
  private findParentTimer(name: string): string | null {
    // Simple heuristic: find the most recent timer that could be a parent
    const activeTimers = Array.from(this.timers.keys());
    
    for (let i = activeTimers.length - 1; i >= 0; i--) {
      const timerName = activeTimers[i];
      if (timerName !== name && name.startsWith(timerName.split('_')[0])) {
        return timerName;
      }
    }
    
    return null;
  }
  
  /**
   * Log slow operation for debugging
   */
  private logSlowOperation(tool: string, duration: number, metadata?: any): void {
    console.warn(`[Gemini MCP] Slow operation detected:`);
    console.warn(`  Tool: ${tool}`);
    console.warn(`  Duration: ${duration.toFixed(2)}ms`);
    
    if (metadata) {
      console.warn(`  Metadata: ${JSON.stringify(metadata, null, 2)}`);
    }
    
    // Include memory info if available
    const recentMetric = this.metrics[this.metrics.length - 1];
    if (recentMetric && recentMetric.memory) {
      console.warn(`  Memory delta: ${(recentMetric.memory.delta.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }
  }
  
  /**
   * Get performance statistics
   */
  getStats(): PerformanceStats {
    if (this.metrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        slowOperations: 0,
        byTool: {}
      };
    }
    
    const stats: PerformanceStats = {
      totalOperations: this.metrics.length,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      slowOperations: 0,
      byTool: {}
    };
    
    let totalDuration = 0;
    
    for (const metric of this.metrics) {
      totalDuration += metric.duration;
      stats.minDuration = Math.min(stats.minDuration, metric.duration);
      stats.maxDuration = Math.max(stats.maxDuration, metric.duration);
      
      if (metric.duration > this.config.threshold) {
        stats.slowOperations++;
      }
      
      // Aggregate by tool
      if (!stats.byTool[metric.tool]) {
        stats.byTool[metric.tool] = {
          count: 0,
          totalDuration: 0,
          averageDuration: 0,
          minDuration: Infinity,
          maxDuration: 0
        };
      }
      
      const toolStats = stats.byTool[metric.tool];
      toolStats.count++;
      toolStats.totalDuration += metric.duration;
      toolStats.minDuration = Math.min(toolStats.minDuration, metric.duration);
      toolStats.maxDuration = Math.max(toolStats.maxDuration, metric.duration);
    }
    
    // Calculate averages
    stats.averageDuration = totalDuration / stats.totalOperations;
    
    for (const tool in stats.byTool) {
      const toolStats = stats.byTool[tool];
      toolStats.averageDuration = toolStats.totalDuration / toolStats.count;
    }
    
    return stats;
  }
  
  /**
   * Get recent metrics
   */
  getRecentMetrics(count: number = 10): PerformanceMetrics[] {
    return this.metrics.slice(-count);
  }
  
  /**
   * Get metrics for a specific tool
   */
  getToolMetrics(toolName: string): PerformanceMetrics[] {
    return this.metrics.filter(m => m.tool === toolName);
  }
  
  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = [];
    this.timers.clear();
    this.nestedTimers.clear();
  }
  
  /**
   * Start periodic reporting of performance stats
   */
  private startPeriodicReporting(): void {
    const interval = parseInt(process.env.GEMINI_MCP_PERF_REPORT_INTERVAL || '300000', 10); // 5 minutes default
    
    setInterval(() => {
      const stats = this.getStats();
      if (stats.totalOperations > 0) {
        console.warn('[Gemini MCP] Performance Report:');
        console.warn(`  Total operations: ${stats.totalOperations}`);
        console.warn(`  Average duration: ${stats.averageDuration.toFixed(2)}ms`);
        console.warn(`  Slow operations: ${stats.slowOperations} (>${this.config.threshold}ms)`);
        
        // Report top 3 slowest tools
        const toolsArray = Object.entries(stats.byTool)
          .sort((a, b) => b[1].averageDuration - a[1].averageDuration)
          .slice(0, 3);
        
        if (toolsArray.length > 0) {
          console.warn('  Top 3 slowest tools:');
          for (const [tool, toolStats] of toolsArray) {
            console.warn(`    ${tool}: avg ${toolStats.averageDuration.toFixed(2)}ms (${toolStats.count} calls)`);
          }
        }
        
        // Report system resources
        const memUsage = process.memoryUsage();
        console.warn('  Memory usage:');
        console.warn(`    Heap: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB / ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`);
        console.warn(`    RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`);
      }
    }, interval);
  }
  
  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      config: this.config,
      stats: this.getStats(),
      metrics: this.metrics
    }, null, 2);
  }
  
  /**
   * Import metrics from JSON
   */
  importMetrics(json: string): void {
    try {
      const data = JSON.parse(json);
      if (data.metrics && Array.isArray(data.metrics)) {
        this.metrics = data.metrics;
      }
    } catch (error) {
      console.error('[Gemini MCP] Failed to import metrics:', error);
    }
  }
}