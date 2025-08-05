/**
 * CircularBuffer - O(1) performance replacement for O(n²) array operations
 * Eliminates the performance bottleneck in chat history management
 */

export interface BufferItem<T> {
  data: T;
  timestamp: Date;
  size: number; // Precalculated size for efficient limit checking
}

export interface BufferMetrics {
  itemCount: number;
  totalSize: number;
  oldestItem?: Date;
  newestItem?: Date;
  utilizationPercent: number;
}

/**
 * High-performance circular buffer with automatic eviction
 * Replaces the O(n²) array.shift() operations with O(1) circular buffer
 */
export class CircularBuffer<T> {
  private buffer: (BufferItem<T> | null)[];
  private maxItems: number;
  private maxSize: number;
  private head: number = 0;
  private size: number = 0;
  private totalSize: number = 0;
  private sizeCalculator: (item: T) => number;

  constructor(
    maxItems: number,
    maxSize: number,
    sizeCalculator: (item: T) => number
  ) {
    this.maxItems = maxItems;
    this.maxSize = maxSize;
    this.buffer = new Array(maxItems).fill(null);
    this.sizeCalculator = sizeCalculator;
  }

  /**
   * Add item to buffer with automatic eviction - O(1) operation
   */
  add(item: T): BufferItem<T>[] {
    const itemSize = this.sizeCalculator(item);
    const bufferItem: BufferItem<T> = {
      data: item,
      timestamp: new Date(),
      size: itemSize
    };

    const evictedItems: BufferItem<T>[] = [];

    // Evict items if size limit would be exceeded
    while (this.totalSize + itemSize > this.maxSize && this.size > 0) {
      const evicted = this.evictOldest();
      if (evicted) {
        evictedItems.push(evicted);
      }
    }

    // Evict if item count would exceed limit
    if (this.size >= this.maxItems) {
      const evicted = this.evictOldest();
      if (evicted) {
        evictedItems.push(evicted);
      }
    }

    // Add new item
    const insertIndex = (this.head + this.size) % this.maxItems;
    this.buffer[insertIndex] = bufferItem;
    
    if (this.size < this.maxItems) {
      this.size++;
    } else {
      // Buffer is full, move head forward
      this.head = (this.head + 1) % this.maxItems;
    }
    
    this.totalSize += itemSize;
    return evictedItems;
  }

  /**
   * Get all items in chronological order - O(n) operation
   */
  getAll(): T[] {
    const items: T[] = [];
    
    for (let i = 0; i < this.size; i++) {
      const index = (this.head + i) % this.maxItems;
      const bufferItem = this.buffer[index];
      if (bufferItem) {
        items.push(bufferItem.data);
      }
    }
    
    return items;
  }

  /**
   * Get recent items up to specified count - O(k) operation where k = count
   */
  getRecent(count: number): T[] {
    const actualCount = Math.min(count, this.size);
    const items: T[] = [];
    
    for (let i = this.size - actualCount; i < this.size; i++) {
      const index = (this.head + i) % this.maxItems;
      const bufferItem = this.buffer[index];
      if (bufferItem) {
        items.push(bufferItem.data);
      }
    }
    
    return items;
  }

  /**
   * Get items within size limit, starting from most recent - O(n) operation
   */
  getWithinSizeLimit(sizeLimit: number): { items: T[], actualSize: number } {
    const items: T[] = [];
    let currentSize = 0;
    
    // Start from most recent and work backwards
    for (let i = this.size - 1; i >= 0; i--) {
      const index = (this.head + i) % this.maxItems;
      const bufferItem = this.buffer[index];
      
      if (bufferItem && currentSize + bufferItem.size <= sizeLimit) {
        items.unshift(bufferItem.data); // Add to beginning to maintain chronological order
        currentSize += bufferItem.size;
      } else {
        break; // Size limit reached
      }
    }
    
    return { items, actualSize: currentSize };
  }

  /**
   * Clear all items - O(1) operation
   */
  clear(): void {
    this.buffer.fill(null);
    this.head = 0;
    this.size = 0;
    this.totalSize = 0;
  }

  /**
   * Get buffer metrics for monitoring
   */
  getMetrics(): BufferMetrics {
    let oldestItem: Date | undefined;
    let newestItem: Date | undefined;

    if (this.size > 0) {
      const oldestIndex = this.head;
      const newestIndex = (this.head + this.size - 1) % this.maxItems;
      
      oldestItem = this.buffer[oldestIndex]?.timestamp;
      newestItem = this.buffer[newestIndex]?.timestamp;
    }

    return {
      itemCount: this.size,
      totalSize: this.totalSize,
      oldestItem,
      newestItem,
      utilizationPercent: (this.size / this.maxItems) * 100
    };
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Check if buffer is at capacity
   */
  isFull(): boolean {
    return this.size >= this.maxItems;
  }

  /**
   * Get current item count
   */
  count(): number {
    return this.size;
  }

  /**
   * Get current total size
   */
  getCurrentSize(): number {
    return this.totalSize;
  }

  /**
   * Private method to evict oldest item - O(1) operation
   */
  private evictOldest(): BufferItem<T> | null {
    if (this.size === 0) {
      return null;
    }

    const evictedItem = this.buffer[this.head];
    if (evictedItem) {
      this.buffer[this.head] = null;
      this.totalSize -= evictedItem.size;
      this.head = (this.head + 1) % this.maxItems;
      this.size--;
      return evictedItem;
    }

    return null;
  }
}