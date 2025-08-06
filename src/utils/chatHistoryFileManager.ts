import { promises as fs } from 'fs';
import { join } from 'path';
import { Logger } from './logger.js';
import { Chat } from '../managers/chatManager.js';
import { ChatHistoryFormatter } from './chatHistoryFormatter.js';

export interface ChatHistoryFile {
  chatId: string;
  title: string;
  debugKeepFile: boolean;
  participants: string[];
  messages: Array<{
    agent: string;
    message: string;
    timestamp: string;
  }>;
  currentPrompt: string;
  metadata: {
    created: string;
    totalMessages: number;
    estimatedTokens: number;
  };
}

export interface FileOperationResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export class ChatHistoryFileManager {
  private static readonly TEMP_DIR = '.gemini';
  private static readonly FILE_PREFIX = 'chat-';
  private static readonly FILE_EXTENSION = '.json';
  private static readonly MAX_FILE_SIZE_MB = 10;
  private static readonly CLEANUP_BATCH_SIZE = 50;
  private static readonly FILE_PERMISSION = 0o644;
  private static readonly VALID_CHAT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
  
  private static activeLocks = new Map<string, Promise<void>>();
  private static formatter: ChatHistoryFormatter;
  private static cleanupLock: Promise<void> | null = null;

  /**
   * Creates a temporary JSON file with chat history for Gemini consumption
   * Uses atomic write operations to prevent corruption
   */
  static async createChatHistoryFile(
    chat: Chat,
    currentPrompt: string,
    debugKeepFile: boolean = false
  ): Promise<FileOperationResult> {
    const chatId = chat.id;
    
    // Validate chat ID to prevent path traversal attacks
    if (!chatId || !this.VALID_CHAT_ID_PATTERN.test(chatId.toString())) {
      return {
        success: false,
        error: `Invalid chat ID format: ${chatId}`
      };
    }
    const lockKey = `file-${chatId}`;
    
    // Initialize formatter if needed
    if (!this.formatter) {
      this.formatter = new ChatHistoryFormatter();
    }
    
    // Prevent concurrent file operations for same chat
    const existingLock = this.activeLocks.get(lockKey);
    if (existingLock) {
      try {
        await existingLock;
      } catch (error) {
        Logger.warn(`Previous file operation failed for chat ${chatId}:`, error);
      }
    }

    // Create new lock promise
    let lockResolve!: () => void;
    let lockReject!: (error: Error) => void;
    const lockPromise = new Promise<void>((resolve, reject) => {
      lockResolve = resolve;
      lockReject = reject;
    });
    this.activeLocks.set(lockKey, lockPromise);

    try {
      return await this.executeAtomicFileWrite(chat, currentPrompt, debugKeepFile);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`Failed to create chat history file for ${chatId}:`, error);
      lockReject(error instanceof Error ? error : new Error(errorMessage));
      return {
        success: false,
        error: `File creation failed: ${errorMessage}`
      };
    } finally {
      this.activeLocks.delete(lockKey);
      lockResolve();
    }
  }

  /**
   * Performs atomic file write operation with validation
   */
  private static async executeAtomicFileWrite(
    chat: Chat,
    currentPrompt: string,
    debugKeepFile: boolean
  ): Promise<FileOperationResult> {
    // 1. Ensure directory exists
    await this.ensureDirectoryExists();

    // 2. Generate optimized JSON structure with size estimation
    let chatHistoryData = this.formatter.formatChatForFile(
      chat,
      currentPrompt,
      debugKeepFile
    );

    // 3. Validate file size constraints (initial check)
    let jsonString = JSON.stringify(chatHistoryData, null, 2);
    let fileSizeMB = Buffer.byteLength(jsonString, 'utf8') / (1024 * 1024);
    
    // 4. If file too large, truncate and regenerate once
    if (fileSizeMB > this.MAX_FILE_SIZE_MB) {
      Logger.warn(`Chat ${chat.id} file size ${fileSizeMB.toFixed(2)}MB exceeds limit, truncating`);
      chatHistoryData = this.formatter.formatChatForFile(
        chat,
        currentPrompt,
        debugKeepFile,
        { truncateMessages: true, maxTokens: 8000 }
      );
      jsonString = JSON.stringify(chatHistoryData, null, 2);
    }

    // 5. Perform atomic write
    return this.writeFileAtomic(chat.id, jsonString);
  }

  /**
   * Enhanced atomic file write with verification and Windows file handling
   */
  private static async writeFileAtomic(
    chatId: string,
    content: string
  ): Promise<FileOperationResult> {
    const fileName = `${this.FILE_PREFIX}${chatId}${this.FILE_EXTENSION}`;
    const filePath = join(process.cwd(), this.TEMP_DIR, fileName);
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`;

    try {
      // 1. Write to temporary file first
      await fs.writeFile(tempPath, content, {
        encoding: 'utf8',
        mode: this.FILE_PERMISSION,
        flag: 'wx' // Exclusive write - fail if file exists
      });

      // 2. Verify temp file was written correctly
      const tempStats = await fs.stat(tempPath);
      if (tempStats.size === 0) {
        throw new Error(`Temporary file ${tempPath} is empty after write`);
      }

      // 3. Atomic rename to final location
      await fs.rename(tempPath, filePath);

      // 4. CRITICAL: Verify final file exists and is readable
      await fs.access(filePath, fs.constants.R_OK);
      const finalStats = await fs.stat(filePath);
      if (finalStats.size === 0) {
        throw new Error(`Final file ${filePath} is empty after rename`);
      }

      Logger.info(`Created and verified chat history file: ${filePath} (${content.length} chars)`);
      return {
        success: true,
        filePath
      };
    } catch (error) {
      // Enhanced cleanup with Windows file lock handling
      await this.cleanupTempFileWithRetry(tempPath);
      throw error;
    }
  }

  /**
   * Cleanup temporary file with retry logic for Windows file locks
   */
  private static async cleanupTempFileWithRetry(tempPath: string, maxRetries = 3): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await fs.unlink(tempPath);
        return;
      } catch (error: any) {
        if (error.code === 'EPERM' && i < maxRetries - 1) {
          // Windows file locking - wait and retry
          await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
          continue;
        }
        if (error.code !== 'ENOENT') {
          Logger.warn(`Failed to cleanup temp file ${tempPath} (attempt ${i + 1}):`, error);
        }
        return;
      }
    }
  }

  /**
   * Ensures .gemini directory exists with proper permissions
   */
  private static async ensureDirectoryExists(): Promise<void> {
    const dirPath = join(process.cwd(), this.TEMP_DIR);
    
    try {
      await fs.access(dirPath);
    } catch (error) {
      try {
        await fs.mkdir(dirPath, { mode: 0o755, recursive: true });
        Logger.info(`Created temp directory: ${dirPath}`);
      } catch (mkdirError) {
        throw new Error(`Failed to create temp directory ${dirPath}: ${mkdirError}`);
      }
    }
  }

  /**
   * Cleanup temporary files with batching and error recovery
   * Prevents concurrent cleanup operations
   */
  static async cleanupTempFiles(keepDebugFiles: boolean = false): Promise<void> {
    // Prevent concurrent cleanup operations
    if (this.cleanupLock) {
      await this.cleanupLock;
      return;
    }

    this.cleanupLock = this.executeCleanup(keepDebugFiles);
    
    try {
      await this.cleanupLock;
    } finally {
      this.cleanupLock = null;
    }
  }

  /**
   * Internal cleanup execution method
   */
  private static async executeCleanup(keepDebugFiles: boolean): Promise<void> {
    const dirPath = join(process.cwd(), this.TEMP_DIR);
    
    try {
      const files = await fs.readdir(dirPath);
      const chatFiles = files.filter(file => 
        file.startsWith(this.FILE_PREFIX) && file.endsWith(this.FILE_EXTENSION)
      );

      if (chatFiles.length === 0) {
        Logger.debug('No chat history files to cleanup');
        return;
      }

      let cleanupCount = 0;
      let errorCount = 0;

      // Process in batches to avoid overwhelming filesystem
      for (let i = 0; i < chatFiles.length; i += this.CLEANUP_BATCH_SIZE) {
        const batch = chatFiles.slice(i, i + this.CLEANUP_BATCH_SIZE);
        
        await Promise.allSettled(
          batch.map(async (file) => {
            const filePath = join(dirPath, file);
            
            try {
              // Check if file should be kept (debug files)
              if (keepDebugFiles) {
                const content = await fs.readFile(filePath, 'utf8');
                const data = JSON.parse(content) as ChatHistoryFile;
                if (data.debugKeepFile) {
                  return; // Skip debug files
                }
              }

              await fs.unlink(filePath);
              cleanupCount++;
            } catch (error) {
              errorCount++;
              Logger.warn(`Failed to cleanup file ${filePath}:`, error);
            }
          })
        );
      }

      Logger.info(`Cleanup completed: ${cleanupCount} files removed, ${errorCount} errors`);
    } catch (error) {
      Logger.error('Failed to cleanup temp files:', error);
    }
  }

  /**
   * Server startup cleanup - called from index.ts
   */
  static async initializeCleanup(): Promise<void> {
    Logger.info('Initializing chat history file cleanup...');
    await this.cleanupTempFiles(false); // Remove all files on startup
    
    // Schedule periodic cleanup (every 30 minutes)
    setInterval(async () => {
      try {
        await this.cleanupTempFiles(true); // Keep debug files during runtime
      } catch (error) {
        Logger.error('Periodic cleanup failed:', error);
      }
    }, 30 * 60 * 1000);
  }

  /**
   * Generate file reference for Gemini CLI
   */
  static generateFileReference(chatId: string): string {
    const fileName = `${this.FILE_PREFIX}${chatId}${this.FILE_EXTENSION}`;
    return `@${this.TEMP_DIR}/${fileName}`;
  }
}