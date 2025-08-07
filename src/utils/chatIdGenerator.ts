import { createHash } from 'crypto';

/**
 * Generate a deterministic hash-based chat ID from a title
 * Uses SHA-256 to create a consistent, collision-resistant ID
 */
export class ChatIdGenerator {
  /**
   * Generate a hash-based chat ID from title
   * @param title The chat title to hash
   * @param truncateLength Optional length to truncate hash (default: 8 chars)
   * @returns A deterministic hash string
   */
  static generateFromTitle(title: string, truncateLength: number = 8): string {
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new Error('Title must be a non-empty string');
    }

    // Normalize title: trim, lowercase, replace multiple spaces with single space
    const normalizedTitle = title.trim().toLowerCase().replace(/\s+/g, ' ');
    
    // Generate SHA-256 hash
    const hash = createHash('sha256').update(normalizedTitle).digest('hex');
    
    // Return truncated hash (default 8 characters for readability)
    return hash.substring(0, truncateLength);
  }

  /**
   * Generate a hash-based chat ID with collision handling
   * @param title The chat title to hash
   * @param existingIds Set of existing IDs to avoid collisions
   * @param maxAttempts Maximum collision resolution attempts (default: 10)
   * @returns A unique hash string
   */
  static generateUniqueFromTitle(
    title: string, 
    existingIds: Set<string>, 
    maxAttempts: number = 10
  ): string {
    let baseId = this.generateFromTitle(title);
    
    // If no collision, return the base ID
    if (!existingIds.has(baseId)) {
      return baseId;
    }

    // Handle collisions by appending incremental suffixes
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const candidateId = `${baseId}-${attempt}`;
      if (!existingIds.has(candidateId)) {
        return candidateId;
      }
    }

    // Fallback to timestamp-based suffix if max attempts exceeded
    const timestamp = Date.now().toString(36);
    return `${baseId}-${timestamp}`;
  }

  /**
   * Validate if a string looks like a hash-based chat ID
   * @param id The ID to validate
   * @returns boolean indicating if it's a valid hash format
   */
  static isValidHashId(id: string): boolean {
    if (!id || typeof id !== 'string') {
      return false;
    }

    // Valid formats:
    // - 8 hex chars (base hash)
    // - 8 hex chars + dash + number (collision resolution)
    // - 8 hex chars + dash + timestamp (fallback)
    const hashIdPattern = /^[a-f0-9]{8}(-[a-z0-9]+)?$/;
    return hashIdPattern.test(id);
  }

  /**
   * Extract the base hash from a collision-resolved ID
   * @param id The full chat ID (may include collision suffix)
   * @returns The base 8-character hash
   */
  static getBaseHash(id: string): string {
    if (!this.isValidHashId(id)) {
      throw new Error(`Invalid hash ID format: ${id}`);
    }

    const dashIndex = id.indexOf('-');
    return dashIndex === -1 ? id : id.substring(0, dashIndex);
  }

  /**
   * Create a human-readable chat reference combining title and hash
   * @param title The original title
   * @param hashId The generated hash ID
   * @returns A formatted string like "Analysis Session (abc123ef)"
   */
  static formatChatReference(title: string, hashId: string): string {
    const truncatedTitle = title.length > 50 
      ? title.substring(0, 47) + '...' 
      : title;
    return `${truncatedTitle} (${hashId})`;
  }
}