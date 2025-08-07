import { readFile, access, stat } from 'fs/promises';
import { resolve, join, isAbsolute, sep } from 'path';
import { Logger } from './logger.js';

/**
 * Maximum file size allowed for processing (1MB)
 */
const MAX_FILE_SIZE = 1024 * 1024; // 1MB

/**
 * Maximum number of concurrent file operations
 */
const MAX_CONCURRENT_FILES = 3;

/**
 * Allowed file extensions for security
 */
const ALLOWED_EXTENSIONS = new Set([
  '.ts', '.js', '.jsx', '.tsx', '.json', '.md', '.txt', '.yaml', '.yml',
  '.py', '.rb', '.go', '.rs', '.java', '.cpp', '.c', '.h', '.cs',
  '.php', '.sql', '.html', '.css', '.scss', '.less', '.xml', '.toml',
  '.ini', '.cfg', '.conf', '.env', '.gitignore', '.dockerignore',
  '.dockerfile', '.makefile', '.cmake', '.gradle', '.properties'
]);

/**
 * Result of file reference processing
 */
export interface ProcessResult {
  /** The processed prompt with file contents substituted */
  processedPrompt: string;
  /** List of files that were successfully processed */
  processedFiles: string[];
  /** List of files that failed to process with error messages */
  failedFiles: Array<{ path: string; error: string }>;
  /** Whether any file references were found in the prompt */
  hasFileReferences: boolean;
}

/**
 * Custom error types for different failure scenarios
 */
export class FileProcessingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly filePath?: string
  ) {
    super(message);
    this.name = 'FileProcessingError';
  }
}

export class SecurityError extends FileProcessingError {
  constructor(message: string, filePath?: string) {
    super(message, 'SECURITY_VIOLATION', filePath);
    this.name = 'SecurityError';
  }
}

export class FileSizeError extends FileProcessingError {
  constructor(message: string, filePath?: string) {
    super(message, 'FILE_TOO_LARGE', filePath);
    this.name = 'FileSizeError';
  }
}

/**
 * FileReferenceProcessor handles parsing and processing of @ syntax file references
 * in user prompts. It reads referenced files and substitutes their content while
 * maintaining security and performance constraints.
 */
export class FileReferenceProcessor {
  private readonly workingDirectory: string;

  constructor(workingDirectory?: string) {
    this.workingDirectory = workingDirectory || process.cwd();
    Logger.debug('FileReferenceProcessor initialized', { workingDirectory: this.workingDirectory });
  }

  /**
   * Process a prompt containing @ syntax file references
   * @param prompt - The user prompt potentially containing @file references
   * @returns Promise resolving to ProcessResult with substituted content
   */
  async processPrompt(prompt: string): Promise<ProcessResult> {
    const startTime = Date.now();
    Logger.debug('Starting file reference processing', { promptLength: prompt.length });

    // Early return if no @ syntax detected
    if (!this.containsFileReferences(prompt)) {
      Logger.debug('No file references detected, returning original prompt');
      return {
        processedPrompt: prompt,
        processedFiles: [],
        failedFiles: [],
        hasFileReferences: false
      };
    }

    // Extract file references from prompt
    const fileReferences = this.extractFileReferences(prompt);
    Logger.info(`Found ${fileReferences.length} file references`, { files: fileReferences });

    // Process files with concurrency control
    const fileResults = await this.processFiles(fileReferences);
    
    // Substitute file contents in prompt
    const processedPrompt = this.substituteFileContents(prompt, fileResults);

    const elapsed = Date.now() - startTime;
    const result: ProcessResult = {
      processedPrompt,
      processedFiles: fileResults.filter(r => r.success).map(r => r.path),
      failedFiles: fileResults.filter(r => !r.success).map(r => ({ path: r.path, error: r.error! })),
      hasFileReferences: true
    };

    Logger.info(`File reference processing completed in ${elapsed}ms`, {
      processedFiles: result.processedFiles.length,
      failedFiles: result.failedFiles.length,
      originalLength: prompt.length,
      processedLength: result.processedPrompt.length
    });

    return result;
  }

  /**
   * Check if prompt contains @ syntax file references
   */
  private containsFileReferences(prompt: string): boolean {
    // Match @ followed by a valid file path pattern
    const fileReferencePattern = /@[^\s@]+/g;
    return fileReferencePattern.test(prompt);
  }

  /**
   * Extract all file references from the prompt
   */
  private extractFileReferences(prompt: string): string[] {
    // Match @ followed by file path (non-whitespace, non-@ characters)
    const fileReferencePattern = /@([^\s@]+)/g;
    const matches: string[] = [];
    let match;

    while ((match = fileReferencePattern.exec(prompt)) !== null) {
      const filePath = match[1];
      if (filePath && !matches.includes(filePath)) {
        matches.push(filePath);
      }
    }

    return matches;
  }

  /**
   * Process multiple files with concurrency control
   */
  private async processFiles(filePaths: string[]): Promise<FileProcessingResult[]> {
    const results: FileProcessingResult[] = [];
    
    // Process files in batches to control concurrency
    for (let i = 0; i < filePaths.length; i += MAX_CONCURRENT_FILES) {
      const batch = filePaths.slice(i, i + MAX_CONCURRENT_FILES);
      const batchPromises = batch.map(path => this.processFile(path));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Process a single file reference
   */
  private async processFile(filePath: string): Promise<FileProcessingResult> {
    try {
      Logger.debug(`Processing file: ${filePath}`);

      // Security validation first (before any file system access)
      const resolvedPath = this.validateAndResolvePath(filePath);
      
      // Validate file extension early for security
      this.validateFileExtension(resolvedPath);
      
      // Check file existence and permissions
      await access(resolvedPath);
      
      // Check file size
      const stats = await stat(resolvedPath);
      if (stats.size > MAX_FILE_SIZE) {
        throw new FileSizeError(
          `File too large: ${(stats.size / (1024 * 1024)).toFixed(1)}MB (max: ${MAX_FILE_SIZE / (1024 * 1024)}MB)`,
          filePath
        );
      }

      // Read file content
      const content = await readFile(resolvedPath, 'utf-8');
      
      Logger.debug(`Successfully read file: ${filePath}`, { 
        size: stats.size, 
        contentLength: content.length 
      });

      return {
        path: filePath,
        resolvedPath,
        content,
        success: true
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.warn(`Failed to process file: ${filePath}`, { error: errorMessage });

      return {
        path: filePath,
        resolvedPath: '',
        content: '',
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Validate file path and resolve it securely
   */
  private validateAndResolvePath(filePath: string): string {
    // Prevent directory traversal attacks
    if (filePath.includes('..') || filePath.includes('~')) {
      throw new SecurityError(`Path traversal not allowed: ${filePath}`, filePath);
    }

    // Resolve path relative to working directory
    const resolvedPath = isAbsolute(filePath) 
      ? filePath 
      : resolve(this.workingDirectory, filePath);

    // Ensure resolved path is within working directory
    const normalizedWorking = resolve(this.workingDirectory);
    const normalizedResolved = resolve(resolvedPath);
    
    if (!normalizedResolved.startsWith(normalizedWorking + sep) && 
        normalizedResolved !== normalizedWorking) {
      throw new SecurityError(`Access denied: path outside working directory: ${filePath}`, filePath);
    }

    return resolvedPath;
  }

  /**
   * Validate file extension for security
   */
  private validateFileExtension(filePath: string): void {
    const extension = filePath.toLowerCase().split('.').pop();
    if (!extension || !ALLOWED_EXTENSIONS.has(`.${extension}`)) {
      throw new SecurityError(`File type not allowed: ${extension || 'no extension'}`, filePath);
    }
  }

  /**
   * Substitute file contents in the original prompt
   */
  private substituteFileContents(prompt: string, fileResults: FileProcessingResult[]): string {
    let processedPrompt = prompt;

    // Create a map for quick lookup
    const resultMap = new Map<string, FileProcessingResult>();
    fileResults.forEach(result => resultMap.set(result.path, result));

    // Replace each @file reference with appropriate content
    const fileReferencePattern = /@([^\s@]+)/g;
    
    processedPrompt = processedPrompt.replace(fileReferencePattern, (match, filePath) => {
      const result = resultMap.get(filePath);
      
      if (!result) {
        return `[ERROR: File reference not processed: ${filePath}]`;
      }

      if (!result.success) {
        return `[ERROR: Could not read ${filePath}: ${result.error}]`;
      }

      // Format file content with clear boundaries
      return `[File: ${filePath}]\n\`\`\`\n${result.content}\n\`\`\`\n[End: ${filePath}]`;
    });

    return processedPrompt;
  }
}

/**
 * Internal interface for file processing results
 */
interface FileProcessingResult {
  path: string;
  resolvedPath: string;
  content: string;
  success: boolean;
  error?: string;
}

/**
 * Default instance for convenience
 */
export const defaultFileProcessor = new FileReferenceProcessor();

/**
 * Convenience function for processing prompts with file references
 * @param prompt - The prompt to process
 * @param workingDirectory - Optional working directory (defaults to process.cwd())
 * @returns Promise resolving to ProcessResult
 */
export async function processFileReferences(
  prompt: string, 
  workingDirectory?: string
): Promise<ProcessResult> {
  const processor = workingDirectory 
    ? new FileReferenceProcessor(workingDirectory)
    : defaultFileProcessor;
  
  return processor.processPrompt(prompt);
}