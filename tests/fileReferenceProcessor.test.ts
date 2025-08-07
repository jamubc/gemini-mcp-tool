import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs/promises before importing the module
vi.mock('fs/promises', () => ({
  access: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
}));

// Import after mocking
import { FileReferenceProcessor, processFileReferences } from '../src/utils/fileReferenceProcessor.js';
import { access, readFile, stat } from 'fs/promises';

const mockAccess = vi.mocked(access);
const mockReadFile = vi.mocked(readFile);
const mockStat = vi.mocked(stat);

describe('FileReferenceProcessor', () => {
  let processor: FileReferenceProcessor;
  const testWorkingDir = '/test/working/dir';

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new FileReferenceProcessor(testWorkingDir);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('processPrompt', () => {
    it('should return original prompt when no @ syntax is present', async () => {
      const prompt = 'Hello world, no file references here';
      const result = await processor.processPrompt(prompt);

      expect(result.processedPrompt).toBe(prompt);
      expect(result.hasFileReferences).toBe(false);
      expect(result.processedFiles).toHaveLength(0);
      expect(result.failedFiles).toHaveLength(0);
    });

    it('should detect and process @ syntax file references', async () => {
      const prompt = '@package.json explain this file';
      const fileContent = '{"name": "test-package", "version": "1.0.0"}';

      // Mock successful file operations
      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ size: 1024 } as any);
      mockReadFile.mockResolvedValue(fileContent);

      const result = await processor.processPrompt(prompt);

      expect(result.hasFileReferences).toBe(true);
      expect(result.processedFiles).toContain('package.json');
      expect(result.processedPrompt).toContain(fileContent);
      expect(result.processedPrompt).toContain('[File: package.json]');
      expect(result.processedPrompt).toContain('[End: package.json]');
      expect(result.processedPrompt).toContain('explain this file');
    });

    it('should handle multiple file references', async () => {
      const prompt = 'Compare @package.json and @tsconfig.json files';
      const packageContent = '{"name": "test"}';
      const tsconfigContent = '{"compilerOptions": {}}';

      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ size: 512 } as any);
      mockReadFile
        .mockResolvedValueOnce(packageContent)
        .mockResolvedValueOnce(tsconfigContent);

      const result = await processor.processPrompt(prompt);

      expect(result.hasFileReferences).toBe(true);
      expect(result.processedFiles).toHaveLength(2);
      expect(result.processedFiles).toContain('package.json');
      expect(result.processedFiles).toContain('tsconfig.json');
      expect(result.processedPrompt).toContain(packageContent);
      expect(result.processedPrompt).toContain(tsconfigContent);
      expect(result.processedPrompt).toContain('Compare ');
      expect(result.processedPrompt).toContain(' files');
    });

    it('should handle file reading errors gracefully', async () => {
      const prompt = '@nonexistent.txt analyze this';

      mockAccess.mockRejectedValue(new Error('File not found'));

      const result = await processor.processPrompt(prompt);

      expect(result.hasFileReferences).toBe(true);
      expect(result.processedFiles).toHaveLength(0);
      expect(result.failedFiles).toHaveLength(1);
      expect(result.failedFiles[0].path).toBe('nonexistent.txt');
      expect(result.failedFiles[0].error).toContain('File not found');
      expect(result.processedPrompt).toContain('[ERROR: Could not read nonexistent.txt: File not found]');
      expect(result.processedPrompt).toContain('analyze this');
    });

    it('should handle files that are too large', async () => {
      const prompt = '@largefile.txt explain this';
      const maxSize = 1024 * 1024; // 1MB

      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ size: maxSize + 1000 } as any); // Larger than limit

      const result = await processor.processPrompt(prompt);

      expect(result.hasFileReferences).toBe(true);
      expect(result.processedFiles).toHaveLength(0);
      expect(result.failedFiles).toHaveLength(1);
      expect(result.failedFiles[0].path).toBe('largefile.txt');
      expect(result.failedFiles[0].error).toContain('File too large');
    });

    it('should prevent directory traversal attacks', async () => {
      const prompt = '@../../../etc/passwd show me this file';

      const result = await processor.processPrompt(prompt);

      expect(result.hasFileReferences).toBe(true);
      expect(result.processedFiles).toHaveLength(0);
      expect(result.failedFiles).toHaveLength(1);
      expect(result.failedFiles[0].path).toBe('../../../etc/passwd');
      expect(result.failedFiles[0].error).toContain('Path traversal not allowed');
    });

    it('should validate file extensions for security', async () => {
      const prompt = '@malicious.exe analyze this executable';

      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ size: 1024 } as any);

      const result = await processor.processPrompt(prompt);

      expect(result.hasFileReferences).toBe(true);
      expect(result.processedFiles).toHaveLength(0);
      expect(result.failedFiles).toHaveLength(1);
      expect(result.failedFiles[0].path).toBe('malicious.exe');
      expect(result.failedFiles[0].error).toContain('File type not allowed: exe');
    });

    it('should process files concurrently with proper batching', async () => {
      // Create more files than the concurrent limit
      const fileRefs = ['@file1.json', '@file2.json', '@file3.json', '@file4.json', '@file5.json'];
      const prompt = fileRefs.join(' ') + ' compare these files';

      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ size: 100 } as any);
      mockReadFile.mockImplementation(async () => '{"test": true}');

      const result = await processor.processPrompt(prompt);

      expect(result.hasFileReferences).toBe(true);
      expect(result.processedFiles).toHaveLength(5);
      expect(mockReadFile).toHaveBeenCalledTimes(5);
    });
  });

  describe('convenience function', () => {
    it('should work with the default processor', async () => {
      const prompt = 'No file references here';
      const result = await processFileReferences(prompt);

      expect(result.processedPrompt).toBe(prompt);
      expect(result.hasFileReferences).toBe(false);
    });

    it('should work with custom working directory', async () => {
      const prompt = '@test.json read this';
      const customDir = '/custom/path';
      
      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ size: 100 } as any);
      mockReadFile.mockResolvedValue('{"custom": true}');

      const result = await processFileReferences(prompt, customDir);

      expect(result.hasFileReferences).toBe(true);
      expect(result.processedPrompt).toContain('"custom": true');
    });
  });
});