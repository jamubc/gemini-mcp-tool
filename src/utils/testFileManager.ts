import { promises as fs } from 'fs';
import { join } from 'path';
import { ChatManager } from '../managers/chatManager.js';
import { Logger } from './logger.js';

/**
 * Test utility for reliable file operations with verification and cleanup
 * Addresses ENOENT/EPERM issues in test execution
 */
export class TestFileManager {
  private static readonly createdFiles = new Set<string>();
  private static readonly TEMP_DIR = '.gemini';
  private static readonly MAX_WAIT_TIME = 2000; // 2 seconds max wait
  private static readonly CHECK_INTERVAL = 50;   // Check every 50ms

  /**
   * Create chat history file with verification and timeout handling
   * Solves ENOENT issues by ensuring file is actually created and readable
   */
  static async createAndVerifyFile(
    chatManager: ChatManager,
    chatId: number,
    prompt: string,
    agent: string,
    debug: boolean = true
  ): Promise<{ success: true; filePath: string; fileReference: string } | { success: false; error: string }> {
    try {
      // 1. Create file using ChatManager
      const result = await chatManager.generateChatHistoryFile(chatId, prompt, agent, debug);
      
      if (!result.success) {
        return { success: false, error: result.error || 'Unknown error' };
      }

      // 2. Verify file exists and is readable with timeout
      const filePath = result.filePath!;
      let totalWait = 0;

      while (totalWait < this.MAX_WAIT_TIME) {
        try {
          // Check file accessibility
          await fs.access(filePath, fs.constants.R_OK);
          
          // Check file has content
          const stats = await fs.stat(filePath);
          if (stats.size > 0) {
            // File exists and has content - track for cleanup
            this.createdFiles.add(filePath);
            Logger.debug(`Verified test file created: ${filePath} (${stats.size} bytes)`);
            
            return {
              success: true,
              filePath: filePath,
              fileReference: result.fileReference!
            };
          }
        } catch (error) {
          // File not ready yet, continue waiting
          Logger.debug(`File ${filePath} not ready, waiting... (${totalWait}ms elapsed)`);
        }
        
        await new Promise(resolve => setTimeout(resolve, this.CHECK_INTERVAL));
        totalWait += this.CHECK_INTERVAL;
      }

      // Timeout reached
      return {
        success: false,
        error: `File ${filePath} was not created or is empty after ${this.MAX_WAIT_TIME}ms`
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error('TestFileManager.createAndVerifyFile failed:', error);
      return {
        success: false,
        error: `File creation failed: ${errorMessage}`
      };
    }
  }

  /**
   * Verify file exists and can be read (for existing files)
   */
  static async verifyFileReadable(filePath: string, maxWaitMs: number = 1000): Promise<boolean> {
    let totalWait = 0;
    
    while (totalWait < maxWaitMs) {
      try {
        await fs.access(filePath, fs.constants.R_OK);
        const stats = await fs.stat(filePath);
        if (stats.size > 0) {
          return true;
        }
      } catch (error) {
        // File not accessible, continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, this.CHECK_INTERVAL));
      totalWait += this.CHECK_INTERVAL;
    }
    
    return false;
  }

  /**
   * Read and parse test file with retry logic
   */
  static async readTestFile(filePath: string): Promise<any> {
    // Wait for file to be readable
    const isReadable = await this.verifyFileReadable(filePath);
    if (!isReadable) {
      throw new Error(`File ${filePath} is not readable or empty`);
    }

    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to read/parse file ${filePath}: ${error}`);
    }
  }

  /**
   * Clean up all test files created during test execution
   * Uses retry logic to handle Windows file locks
   */
  static async cleanupTestFiles(): Promise<void> {
    if (this.createdFiles.size === 0) {
      return;
    }

    const cleanup = Array.from(this.createdFiles).map(async (filePath) => {
      await this.cleanupFileWithRetry(filePath);
    });
    
    await Promise.allSettled(cleanup);
    this.createdFiles.clear();
    Logger.debug(`Cleaned up ${cleanup.length} test files`);
  }

  /**
   * Cleanup individual file with retry logic for Windows EPERM issues
   */
  private static async cleanupFileWithRetry(filePath: string, maxRetries = 3): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await fs.unlink(filePath);
        return; // Success
      } catch (error: any) {
        if (error.code === 'EPERM' && i < maxRetries - 1) {
          // Windows file locking - wait and retry
          await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
          continue;
        }
        if (error.code !== 'ENOENT') {
          Logger.warn(`Failed to cleanup test file ${filePath} (attempt ${i + 1}):`, error);
        }
        return; // Don't throw on cleanup failures
      }
    }
  }

  /**
   * Clean up test directory and ensure it exists for next test
   */
  static async resetTestDirectory(): Promise<void> {
    const geminiDir = join(process.cwd(), this.TEMP_DIR);
    
    try {
      // Clean up any existing test files
      await this.cleanupTestFiles();
      
      // Clean any leftover files from previous test runs
      const files = await fs.readdir(geminiDir);
      const testFiles = files.filter(f => f.includes('test') || f.includes('tmp'));
      
      await Promise.all(testFiles.map(f => 
        this.cleanupFileWithRetry(join(geminiDir, f))
      ));
      
      // Ensure directory exists for next test
      await fs.mkdir(geminiDir, { recursive: true });
    } catch (error) {
      // If directory doesn't exist, create it
      if ((error as any).code === 'ENOENT') {
        await fs.mkdir(geminiDir, { recursive: true });
      } else {
        Logger.warn('TestFileManager.resetTestDirectory failed:', error);
      }
    }
  }

  /**
   * Generate unique test identifier for file isolation
   */
  static generateTestId(): string {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get count of tracked files (for debugging)
   */
  static getTrackedFileCount(): number {
    return this.createdFiles.size;
  }

  /**
   * Force cleanup all temp files in directory (emergency cleanup)
   */
  static async emergencyCleanup(): Promise<void> {
    const geminiDir = join(process.cwd(), this.TEMP_DIR);
    
    try {
      const files = await fs.readdir(geminiDir);
      const tempFiles = files.filter(f => 
        f.endsWith('.json') || f.includes('.tmp') || f.includes('test')
      );
      
      await Promise.all(tempFiles.map(f => 
        this.cleanupFileWithRetry(join(geminiDir, f))
      ));
      
      Logger.info(`Emergency cleanup completed: ${tempFiles.length} files removed`);
    } catch (error) {
      Logger.error('Emergency cleanup failed:', error);
    }
  }
}