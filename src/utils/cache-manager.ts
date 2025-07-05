import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  ttl: number;
  size: number;
  hits: number;
}

interface CacheConfig {
  ttl: number;
  maxSize: number;
  maxEntries: number;
  cleanupInterval: number;
  persistentCache: boolean;
  cacheDir: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  entryCount: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry>;
  private config: CacheConfig;
  private stats: CacheStats;
  private cleanupTimer?: NodeJS.Timeout;
  
  constructor() {
    this.cache = new Map();
  
    this.config = {
      ttl: parseInt(process.env.GEMINI_MCP_CACHE_TTL || '3600', 10) * 1000, // Convert to ms
      maxSize: parseInt(process.env.GEMINI_MCP_CACHE_MAX_SIZE || '100', 10) * 1024 * 1024, // Convert to bytes
      maxEntries: parseInt(process.env.GEMINI_MCP_CACHE_MAX_ENTRIES || '100', 10),
      cleanupInterval: parseInt(process.env.GEMINI_MCP_CACHE_CLEANUP_INTERVAL || '300', 10) * 1000, // 5 min default
      persistentCache: process.env.GEMINI_MCP_PERSISTENT_CACHE === 'true',
      cacheDir: process.env.GEMINI_MCP_CACHE_DIR || path.join(process.cwd(), '.cache', 'gemini')
    };
    
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0,
      entryCount: 0
    };
    
    // Start cleanup timer
    if (process.env.AUTO_CLEANUP_CACHE !== 'false') {
      this.startCleanupTimer();
    }
    
    // Load persistent cache if enabled
    if (this.config.persistentCache) {
      this.loadPersistentCache().catch(err => {
        console.warn('[Gemini MCP] Failed to load persistent cache:', err);
      });
    }
  }
  
  generateCacheKey(toolName: string, args: any): string {
    const keyData = {
      tool: toolName,
      args: args,
      // Include file contents if present for content-aware caching
      fileContents: args.file_path ? this.getFileContentHash(args.file_path) : null,
      version: process.env.GEMINI_MCP_VERSION || '1.0.0'
    };
    
    // Create SHA256 hash of the key data
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(keyData));
    return hash.digest('hex');
  }
  
  /**
   * Get file content hash for cache key generation
   */
  private async getFileContentHash(filePath: string): Promise<string | null> {
    try {
      const stats = await fs.stat(filePath);
      // Use file size and mtime for quick hash without reading entire file
      return `${stats.size}_${stats.mtime.getTime()}`;
    } catch {
      return null;
    }
  }
  
  /**
   * Get cached value if valid
   */
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.entryCount--;
      this.stats.totalSize -= entry.size;
      this.stats.misses++;
      return null;
    }
    
    // Update hit count and stats
    entry.hits++;
    this.stats.hits++;
    
    // Move to end for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.value;
  }
  
  /**
   * Set cache value with optional TTL override
   */
  set(key: string, value: any, ttl?: number): void {
    const size = this.estimateSize(value);
    
    // Check if we need to evict entries
    while (this.shouldEvict(size)) {
      this.evictLRU();
    }
    
    const entry: CacheEntry = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || this.config.ttl,
      size,
      hits: 0
    };
    
    // Update stats
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key)!;
      this.stats.totalSize -= oldEntry.size;
    } else {
      this.stats.entryCount++;
    }
    
    this.cache.set(key, entry);
    this.stats.totalSize += size;
    
    // Save to persistent cache if enabled
    if (this.config.persistentCache) {
      this.saveToPersistentCache(key, entry).catch(err => {
        console.warn('[Gemini MCP] Failed to save to persistent cache:', err);
      });
    }
  }
  
  /**
   * Check if we should evict entries
   */
  private shouldEvict(newSize: number): boolean {
    return (
      this.stats.totalSize + newSize > this.config.maxSize ||
      this.stats.entryCount >= this.config.maxEntries
    );
  }
  
  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    // Map maintains insertion order, so first entry is LRU
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      const entry = this.cache.get(firstKey)!;
      this.cache.delete(firstKey);
      this.stats.evictions++;
      this.stats.entryCount--;
      this.stats.totalSize -= entry.size;
      
      // Remove from persistent cache
      if (this.config.persistentCache) {
        this.removeFromPersistentCache(firstKey).catch(() => {});
      }
    }
  }
  
  /**
   * Estimate size of value in bytes
   */
  private estimateSize(value: any): number {
    if (typeof value === 'string') {
      return value.length * 2; // Rough estimate for UTF-16
    }
    return JSON.stringify(value).length * 2;
  }
  
  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }
  
  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      const entry = this.cache.get(key)!;
      this.cache.delete(key);
      this.stats.entryCount--;
      this.stats.totalSize -= entry.size;
      
      if (this.config.persistentCache) {
        this.removeFromPersistentCache(key).catch(() => {});
      }
    }
    
    if (keysToDelete.length > 0) {
      console.warn(`[Gemini MCP] Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0,
      entryCount: 0
    };
    
    // Clear persistent cache
    if (this.config.persistentCache) {
      this.clearPersistentCache().catch(err => {
        console.warn('[Gemini MCP] Failed to clear persistent cache:', err);
      });
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;
    
    return {
      ...this.stats,
      hitRate
    };
  }
  
  /**
   * Save entry to persistent cache
   */
  private async saveToPersistentCache(key: string, entry: CacheEntry): Promise<void> {
    try {
      await fs.mkdir(this.config.cacheDir, { recursive: true });
      const filePath = path.join(this.config.cacheDir, `${key}.json`);
      await fs.writeFile(filePath, JSON.stringify(entry));
    } catch (error) {
      // Fail silently for persistent cache operations
    }
  }
  
  /**
   * Load persistent cache on startup
   */
  private async loadPersistentCache(): Promise<void> {
    try {
      await fs.mkdir(this.config.cacheDir, { recursive: true });
      const files = await fs.readdir(this.config.cacheDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.config.cacheDir, file);
            const data = await fs.readFile(filePath, 'utf-8');
            const entry = JSON.parse(data) as CacheEntry;
            
            // Check if still valid
            if (Date.now() - entry.timestamp <= entry.ttl) {
              this.cache.set(entry.key, entry);
              this.stats.entryCount++;
              this.stats.totalSize += entry.size;
            } else {
              // Remove expired entry
              await fs.unlink(filePath);
            }
          } catch {
            // Skip invalid entries
          }
        }
      }
      
      console.warn(`[Gemini MCP] Loaded ${this.stats.entryCount} entries from persistent cache`);
    } catch (error) {
      // Fail silently for persistent cache operations
    }
  }
  
  /**
   * Remove entry from persistent cache
   */
  private async removeFromPersistentCache(key: string): Promise<void> {
    try {
      const filePath = path.join(this.config.cacheDir, `${key}.json`);
      await fs.unlink(filePath);
    } catch {
      // Fail silently
    }
  }
  
  /**
   * Clear persistent cache directory
   */
  private async clearPersistentCache(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.cacheDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.config.cacheDir, file)))
      );
    } catch {
      // Fail silently
    }
  }
  
  /**
   * Stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
}