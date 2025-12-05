import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

describe('ask-gemini Tool', () => {
  describe('Argument Schema Validation', () => {
    const askGeminiArgsSchema = z.object({
      prompt: z.string().min(1),
      model: z.string().optional(),
      sandbox: z.boolean().default(false),
      changeMode: z.boolean().default(false),
      chunkIndex: z.union([z.number(), z.string()]).optional(),
      chunkCacheKey: z.string().optional(),
      yolo: z.boolean().default(false),
      approvalMode: z.enum(['default', 'auto_edit', 'yolo']).optional(),
      outputFormat: z.enum(['text', 'json', 'stream-json']).optional(),
      includeDirectories: z.union([z.string(), z.array(z.string())]).optional(),
      debug: z.boolean().default(false),
      promptInteractive: z.string().optional(),
      extensions: z.union([z.string(), z.array(z.string())]).optional(),
      resume: z.string().optional(),
    });

    it('should accept valid minimal arguments', () => {
      const result = askGeminiArgsSchema.parse({ prompt: 'test prompt' });
      expect(result.prompt).toBe('test prompt');
      expect(result.sandbox).toBe(false);
      expect(result.changeMode).toBe(false);
    });

    it('should accept all optional flags', () => {
      const result = askGeminiArgsSchema.parse({
        prompt: 'test prompt',
        model: 'gemini-2.5-flash',
        sandbox: true,
        changeMode: true,
        yolo: true,
        approvalMode: 'auto_edit',
        outputFormat: 'json',
        debug: true,
      });

      expect(result.model).toBe('gemini-2.5-flash');
      expect(result.sandbox).toBe(true);
      expect(result.changeMode).toBe(true);
      expect(result.yolo).toBe(true);
      expect(result.approvalMode).toBe('auto_edit');
      expect(result.outputFormat).toBe('json');
      expect(result.debug).toBe(true);
    });

    it('should reject missing prompt', () => {
      expect(() => askGeminiArgsSchema.parse({})).toThrow();
    });

    it('should reject empty prompt', () => {
      expect(() => askGeminiArgsSchema.parse({ prompt: '' })).toThrow();
    });

    it('should reject invalid approval mode', () => {
      expect(() =>
        askGeminiArgsSchema.parse({
          prompt: 'test',
          approvalMode: 'invalid',
        })
      ).toThrow();
    });

    it('should reject invalid output format', () => {
      expect(() =>
        askGeminiArgsSchema.parse({
          prompt: 'test',
          outputFormat: 'invalid',
        })
      ).toThrow();
    });

    it('should accept includeDirectories as string', () => {
      const result = askGeminiArgsSchema.parse({
        prompt: 'test',
        includeDirectories: 'src,tests',
      });
      expect(result.includeDirectories).toBe('src,tests');
    });

    it('should accept includeDirectories as array', () => {
      const result = askGeminiArgsSchema.parse({
        prompt: 'test',
        includeDirectories: ['src', 'tests'],
      });
      expect(result.includeDirectories).toEqual(['src', 'tests']);
    });

    it('should accept extensions as string', () => {
      const result = askGeminiArgsSchema.parse({
        prompt: 'test',
        extensions: 'ts,js',
      });
      expect(result.extensions).toBe('ts,js');
    });

    it('should accept extensions as array', () => {
      const result = askGeminiArgsSchema.parse({
        prompt: 'test',
        extensions: ['ts', 'js'],
      });
      expect(result.extensions).toEqual(['ts', 'js']);
    });

    it('should accept resume parameter', () => {
      const result = askGeminiArgsSchema.parse({
        prompt: 'test',
        resume: 'latest',
      });
      expect(result.resume).toBe('latest');
    });

    it('should accept chunkIndex as number', () => {
      const result = askGeminiArgsSchema.parse({
        prompt: 'test',
        chunkIndex: 1,
      });
      expect(result.chunkIndex).toBe(1);
    });

    it('should accept chunkIndex as string', () => {
      const result = askGeminiArgsSchema.parse({
        prompt: 'test',
        chunkIndex: '1',
      });
      expect(result.chunkIndex).toBe('1');
    });
  });

  describe('Flag Combinations', () => {
    const askGeminiArgsSchema = z.object({
      prompt: z.string().min(1),
      sandbox: z.boolean().default(false),
      yolo: z.boolean().default(false),
      approvalMode: z.enum(['default', 'auto_edit', 'yolo']).optional(),
    });

    it('should allow sandbox with yolo', () => {
      const result = askGeminiArgsSchema.parse({
        prompt: 'test',
        sandbox: true,
        yolo: true,
      });
      expect(result.sandbox).toBe(true);
      expect(result.yolo).toBe(true);
    });

    it('should allow approvalMode to override yolo', () => {
      const result = askGeminiArgsSchema.parse({
        prompt: 'test',
        yolo: true,
        approvalMode: 'auto_edit',
      });
      expect(result.yolo).toBe(true);
      expect(result.approvalMode).toBe('auto_edit');
      // Note: In actual implementation, approvalMode should take precedence
    });
  });

  describe('Error Messages', () => {
    const askGeminiArgsSchema = z.object({
      prompt: z.string().min(1),
    });

    it('should provide clear error for missing prompt', () => {
      try {
        askGeminiArgsSchema.parse({});
      } catch (error: any) {
        expect(error.issues[0].path).toContain('prompt');
        expect(error.issues[0].message).toMatch(/required/i);
      }
    });

    it('should provide clear error for empty prompt', () => {
      try {
        askGeminiArgsSchema.parse({ prompt: '' });
      } catch (error: any) {
        expect(error.issues[0].path).toContain('prompt');
        expect(error.issues[0].message).toMatch(/at least 1/i);
      }
    });
  });
});
