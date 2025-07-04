import * as fs from 'fs';
import * as path from 'path';

/**
 * Session state for tracking write operations
 */
interface SessionState {
  hasWrite: boolean;
  trackedFiles: Map<string, number>; // filename -> mtime
  sessionId: string;
  startTime: number;
}

/**
 * Guard rail system for monitoring tool behavior
 */
class GuardRailSystem {
  private currentSession: SessionState | null = null;
  
  /**
   * Start a new session
   */
  startSession(): void {
    this.currentSession = {
      hasWrite: false,
      trackedFiles: new Map(),
      sessionId: `session-${Date.now()}`,
      startTime: Date.now()
    };
    console.warn(`[Guard Rails] Started new session: ${this.currentSession.sessionId}`);
  }
  
  /**
   * End the current session and check for unmodified files
   */
  endSession(): void {
    if (!this.currentSession) return;
    
    // Check all tracked files for modifications
    for (const [filePath, originalMtime] of this.currentSession.trackedFiles) {
      try {
        const stats = fs.statSync(filePath);
        const currentMtime = stats.mtime.getTime();
        
        if (currentMtime === originalMtime) {
          console.warn(`[Guard Rails] WARNING: Edit suggested but file mtime for ${filePath} is unchanged`);
        }
      } catch (error) {
        // File might have been deleted or moved
        console.warn(`[Guard Rails] Could not check mtime for ${filePath}: ${error}`);
      }
    }
    
    console.warn(`[Guard Rails] Ended session: ${this.currentSession.sessionId}`);
    this.currentSession = null;
  }
  
  /**
   * Mark that a write operation has occurred
   */
  markWriteOperation(toolName: string): void {
    if (!this.currentSession) {
      this.startSession();
    }
    
    this.currentSession!.hasWrite = true;
    console.warn(`[Guard Rails] Write operation detected from tool: ${toolName}`);
  }
  
  /**
   * Track a file that was suggested for editing
   */
  trackFileForEdit(filePath: string): void {
    if (!this.currentSession) {
      this.startSession();
    }
    
    try {
      const stats = fs.statSync(filePath);
      const mtime = stats.mtime.getTime();
      this.currentSession!.trackedFiles.set(filePath, mtime);
      console.warn(`[Guard Rails] Tracking file for edit: ${filePath} (mtime: ${mtime})`);
    } catch (error) {
      console.warn(`[Guard Rails] Could not track file ${filePath}: ${error}`);
    }
  }
  
  /**
   * Check if a write reminder is needed
   */
  shouldAppendWriteReminder(): boolean {
    if (!this.currentSession) return false;
    return !this.currentSession.hasWrite;
  }
  
  /**
   * Get the write reminder message
   */
  getWriteReminderMessage(): string {
    return '\n\nRemember to write your changes with the file-write tool.';
  }
  
  /**
   * Check if response suggests edits
   */
  responseContainsEditSuggestion(response: string): boolean {
    const editPatterns = [
      /\bHere is the revised\b/i,
      /\bUpdated Content\b/i,
      /\bPASTE THIS INTO YOUR FILE\b/i,
      /\bapply it yourself\b/i,
      /\b```[\s\S]*?```\b/, // Code blocks often contain suggested edits
    ];
    
    return editPatterns.some(pattern => pattern.test(response));
  }
  
  /**
   * Extract file paths mentioned in response
   */
  extractFilePaths(response: string): string[] {
    const paths: string[] = [];
    
    // Pattern to match file paths
    const pathPatterns = [
      /\b(?:\/[\w\-\.\/]+\.[\w]+)\b/g, // Absolute paths
      /\b(?:\.\/[\w\-\.\/]+\.[\w]+)\b/g, // Relative paths starting with ./
      /\b(?:src\/[\w\-\.\/]+\.[\w]+)\b/g, // Common src paths
      /\b(?:[\w\-]+\/[\w\-\.\/]+\.[\w]+)\b/g, // General paths with at least one directory
    ];
    
    for (const pattern of pathPatterns) {
      const matches = response.match(pattern);
      if (matches) {
        paths.push(...matches);
      }
    }
    
    // Deduplicate and resolve paths
    const uniquePaths = [...new Set(paths)];
    return uniquePaths.map(p => {
      if (path.isAbsolute(p)) return p;
      return path.resolve(process.cwd(), p);
    }).filter(p => {
      // Filter out paths that don't look like source files
      const ext = path.extname(p);
      return ext && !['.md', '.txt', '.json'].includes(ext.toLowerCase());
    });
  }
  
  /**
   * Process a response and apply guard rails
   */
  processResponse(response: string, toolName: string): string {
    // Check if this is a write-type tool
    const writeTools = ['FileOperations', 'Write', 'Edit', 'MultiEdit'];
    if (writeTools.includes(toolName)) {
      this.markWriteOperation(toolName);
    }
    
    // Check if response contains edit suggestions
    if (this.responseContainsEditSuggestion(response)) {
      // Extract and track file paths
      const filePaths = this.extractFilePaths(response);
      filePaths.forEach(fp => this.trackFileForEdit(fp));
      
      // If no write operation has occurred, schedule a reminder
      if (this.shouldAppendWriteReminder()) {
        // Use setTimeout to append reminder after the response is sent
        setTimeout(() => {
          if (this.shouldAppendWriteReminder()) {
            console.warn('[Guard Rails] No write operation detected after edit suggestion - reminder needed');
          }
        }, 0);
      }
    }
    
    return response;
  }
}

// Singleton instance
export const guardRails = new GuardRailSystem();