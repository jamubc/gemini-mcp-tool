import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatIdGenerator } from '../src/utils/chatIdGenerator.js';

describe('ChatIdGenerator', () => {
  describe('generateFromTitle', () => {
    it('should generate consistent hash from title', () => {
      const title = 'Test Analysis Session';
      const hash1 = ChatIdGenerator.generateFromTitle(title);
      const hash2 = ChatIdGenerator.generateFromTitle(title);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(8);
      expect(hash1).toMatch(/^[a-f0-9]{8}$/);
    });

    it('should generate different hashes for different titles', () => {
      const title1 = 'Code Review Session';
      const title2 = 'Bug Analysis Session';
      
      const hash1 = ChatIdGenerator.generateFromTitle(title1);
      const hash2 = ChatIdGenerator.generateFromTitle(title2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should normalize title before hashing (case insensitive)', () => {
      const title1 = 'Test Session';
      const title2 = 'TEST SESSION';
      const title3 = 'test session';
      
      const hash1 = ChatIdGenerator.generateFromTitle(title1);
      const hash2 = ChatIdGenerator.generateFromTitle(title2);
      const hash3 = ChatIdGenerator.generateFromTitle(title3);
      
      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('should normalize whitespace', () => {
      const title1 = 'Test   Session';
      const title2 = 'Test Session';
      const title3 = '  Test Session  ';
      
      const hash1 = ChatIdGenerator.generateFromTitle(title1);
      const hash2 = ChatIdGenerator.generateFromTitle(title2);
      const hash3 = ChatIdGenerator.generateFromTitle(title3);
      
      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('should handle custom truncate length', () => {
      const title = 'Test Session';
      
      const hash4 = ChatIdGenerator.generateFromTitle(title, 4);
      const hash12 = ChatIdGenerator.generateFromTitle(title, 12);
      
      expect(hash4).toHaveLength(4);
      expect(hash12).toHaveLength(12);
      expect(hash4).toMatch(/^[a-f0-9]{4}$/);
      expect(hash12).toMatch(/^[a-f0-9]{12}$/);
    });

    it('should throw error for empty title', () => {
      expect(() => ChatIdGenerator.generateFromTitle('')).toThrow('Title must be a non-empty string');
      expect(() => ChatIdGenerator.generateFromTitle('   ')).toThrow('Title must be a non-empty string');
    });

    it('should throw error for non-string input', () => {
      expect(() => ChatIdGenerator.generateFromTitle(null as any)).toThrow('Title must be a non-empty string');
      expect(() => ChatIdGenerator.generateFromTitle(undefined as any)).toThrow('Title must be a non-empty string');
      expect(() => ChatIdGenerator.generateFromTitle(123 as any)).toThrow('Title must be a non-empty string');
    });
  });

  describe('generateUniqueFromTitle', () => {
    it('should return base hash when no collision', () => {
      const title = 'Unique Session';
      const existingIds = new Set(['abc12345', 'def67890']);
      
      const uniqueId = ChatIdGenerator.generateUniqueFromTitle(title, existingIds);
      const baseId = ChatIdGenerator.generateFromTitle(title);
      
      expect(uniqueId).toBe(baseId);
      expect(uniqueId).toHaveLength(8);
    });

    it('should handle single collision with numeric suffix', () => {
      const title = 'Test Session';
      const baseId = ChatIdGenerator.generateFromTitle(title);
      const existingIds = new Set([baseId]);
      
      const uniqueId = ChatIdGenerator.generateUniqueFromTitle(title, existingIds);
      
      expect(uniqueId).toBe(`${baseId}-1`);
      expect(uniqueId).toMatch(/^[a-f0-9]{8}-1$/);
    });

    it('should handle multiple collisions', () => {
      const title = 'Test Session';
      const baseId = ChatIdGenerator.generateFromTitle(title);
      const existingIds = new Set([baseId, `${baseId}-1`, `${baseId}-2`]);
      
      const uniqueId = ChatIdGenerator.generateUniqueFromTitle(title, existingIds);
      
      expect(uniqueId).toBe(`${baseId}-3`);
    });

    it('should fallback to timestamp when max attempts exceeded', () => {
      const title = 'Test Session';
      const baseId = ChatIdGenerator.generateFromTitle(title);
      
      // Create existing IDs for base + 1-10
      const existingIds = new Set([baseId]);
      for (let i = 1; i <= 10; i++) {
        existingIds.add(`${baseId}-${i}`);
      }
      
      const uniqueId = ChatIdGenerator.generateUniqueFromTitle(title, existingIds, 10);
      
      expect(uniqueId).toMatch(new RegExp(`^${baseId}-[a-z0-9]+$`));
      expect(uniqueId).not.toBe(`${baseId}-10`);
    });

    it('should respect custom maxAttempts', () => {
      const title = 'Test Session';
      const baseId = ChatIdGenerator.generateFromTitle(title);
      const existingIds = new Set([baseId, `${baseId}-1`]);
      
      const uniqueId = ChatIdGenerator.generateUniqueFromTitle(title, existingIds, 1);
      
      // Should fallback to timestamp after 1 attempt
      expect(uniqueId).toMatch(new RegExp(`^${baseId}-[a-z0-9]+$`));
      expect(uniqueId).not.toBe(`${baseId}-1`);
    });
  });

  describe('isValidHashId', () => {
    it('should validate base hash format', () => {
      expect(ChatIdGenerator.isValidHashId('abc12345')).toBe(true);
      expect(ChatIdGenerator.isValidHashId('0123abcd')).toBe(true);
    });

    it('should validate collision-resolved format', () => {
      expect(ChatIdGenerator.isValidHashId('abc12345-1')).toBe(true);
      expect(ChatIdGenerator.isValidHashId('abc12345-99')).toBe(true);
      expect(ChatIdGenerator.isValidHashId('abc12345-abc')).toBe(true);
    });

    it('should validate timestamp fallback format', () => {
      expect(ChatIdGenerator.isValidHashId('abc12345-1a2b3c')).toBe(true);
      expect(ChatIdGenerator.isValidHashId('abc12345-xyz789')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(ChatIdGenerator.isValidHashId('')).toBe(false);
      expect(ChatIdGenerator.isValidHashId('abc123')).toBe(false); // too short
      expect(ChatIdGenerator.isValidHashId('abc123456')).toBe(false); // too long
      expect(ChatIdGenerator.isValidHashId('ABC12345')).toBe(false); // uppercase
      expect(ChatIdGenerator.isValidHashId('abc1234g')).toBe(false); // invalid hex
      expect(ChatIdGenerator.isValidHashId('abc12345-')).toBe(false); // empty suffix
      expect(ChatIdGenerator.isValidHashId('abc12345--1')).toBe(false); // double dash
    });

    it('should reject non-string inputs', () => {
      expect(ChatIdGenerator.isValidHashId(null as any)).toBe(false);
      expect(ChatIdGenerator.isValidHashId(undefined as any)).toBe(false);
      expect(ChatIdGenerator.isValidHashId(123 as any)).toBe(false);
    });
  });

  describe('getBaseHash', () => {
    it('should return the same ID for base hash', () => {
      const baseId = 'abc12345';
      expect(ChatIdGenerator.getBaseHash(baseId)).toBe(baseId);
    });

    it('should extract base hash from collision-resolved ID', () => {
      const baseId = 'abc12345';
      expect(ChatIdGenerator.getBaseHash(`${baseId}-1`)).toBe(baseId);
      expect(ChatIdGenerator.getBaseHash(`${baseId}-99`)).toBe(baseId);
      expect(ChatIdGenerator.getBaseHash(`${baseId}-abc123`)).toBe(baseId);
    });

    it('should throw error for invalid hash ID format', () => {
      expect(() => ChatIdGenerator.getBaseHash('invalid')).toThrow('Invalid hash ID format: invalid');
      expect(() => ChatIdGenerator.getBaseHash('')).toThrow('Invalid hash ID format: ');
    });
  });

  describe('formatChatReference', () => {
    it('should format short title with hash', () => {
      const title = 'Test Session';
      const hashId = 'abc12345';
      
      const reference = ChatIdGenerator.formatChatReference(title, hashId);
      
      expect(reference).toBe('Test Session (abc12345)');
    });

    it('should truncate long titles', () => {
      const longTitle = 'This is a very long chat title that exceeds fifty characters and should be truncated';
      const hashId = 'abc12345';
      
      const reference = ChatIdGenerator.formatChatReference(longTitle, hashId);
      
      expect(reference).toBe('This is a very long chat title that exceeds fif... (abc12345)');
      expect(reference.length).toBeLessThanOrEqual(65); // 47 + "... (" + 8 + ")" = 59, but actual is 61
    });

    it('should handle collision-resolved hash IDs', () => {
      const title = 'Duplicate Session';
      const hashId = 'abc12345-1';
      
      const reference = ChatIdGenerator.formatChatReference(title, hashId);
      
      expect(reference).toBe('Duplicate Session (abc12345-1)');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle common chat titles consistently', () => {
      const commonTitles = [
        'Code Review Session',
        'Bug Analysis',
        'Feature Planning',
        'Architecture Discussion',
        'Performance Optimization'
      ];
      
      commonTitles.forEach(title => {
        const hash = ChatIdGenerator.generateFromTitle(title);
        expect(hash).toMatch(/^[a-f0-9]{8}$/);
        expect(ChatIdGenerator.isValidHashId(hash)).toBe(true);
        
        // Test deterministic nature
        const hash2 = ChatIdGenerator.generateFromTitle(title);
        expect(hash).toBe(hash2);
      });
    });

    it('should handle edge case titles', () => {
      const edgeCases = [
        'a', // very short
        'A'.repeat(200), // very long
        '123 456', // numbers and spaces
        'Special chars: @#$%^&*()', // special characters
        '中文标题', // non-ASCII
        '  Multiple    Spaces   ', // extra whitespace
      ];
      
      edgeCases.forEach(title => {
        const hash = ChatIdGenerator.generateFromTitle(title);
        expect(hash).toMatch(/^[a-f0-9]{8}$/);
        expect(ChatIdGenerator.isValidHashId(hash)).toBe(true);
      });
    });

    it('should demonstrate collision resolution workflow', () => {
      const title = 'Test Session';
      const existingIds = new Set<string>();
      
      // First instance: no collision
      const id1 = ChatIdGenerator.generateUniqueFromTitle(title, existingIds);
      existingIds.add(id1);
      expect(id1).toMatch(/^[a-f0-9]{8}$/);
      
      // Second instance: collision resolved with -1
      const id2 = ChatIdGenerator.generateUniqueFromTitle(title, existingIds);
      existingIds.add(id2);
      expect(id2).toMatch(/^[a-f0-9]{8}-1$/);
      
      // Third instance: collision resolved with -2
      const id3 = ChatIdGenerator.generateUniqueFromTitle(title, existingIds);
      existingIds.add(id3);
      expect(id3).toMatch(/^[a-f0-9]{8}-2$/);
      
      // Verify all IDs are unique
      expect(new Set([id1, id2, id3]).size).toBe(3);
    });
  });
});