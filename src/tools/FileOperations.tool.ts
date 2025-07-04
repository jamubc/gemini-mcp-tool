import { BaseTool } from './base-tool.js';
import { StrictMode } from '../types/strict-mode.js';
import { ToolExecutionError } from '../types/errors.js';
import { resolveFilePaths } from '../utils/path-resolver.js';
import { StandardizedResponseSections } from '../utils/structured-response.js';

/**
 * FileOperations - Wraps Gemini's native file manipulation tools
 * 
 * This tool provides direct access to Gemini's powerful built-in file operations:
 * - ReadFile: Read contents of any file
 * - WriteFile: Create or overwrite files
 * - Edit: Make precise edits to existing files
 * 
 * Supports structured prompt programming patterns for clear, reusable operations.
 */

interface FileOperationParams {
  operation: 'read' | 'write' | 'edit';
  path: string;
  content?: string;
  oldContent?: string;
  newContent?: string;
  encoding?: string;
  createBackup?: boolean;
}

interface FileOperationResponse {
  success: boolean;
  operation: string;
  path: string;
  content?: string;
  message?: string;
  metadata?: {
    size?: number;
    modified?: string;
    encoding?: string;
  };
}

class FileOperationsTool extends BaseTool {
  name = "FileOperations";
  description = "Direct file manipulation using Gemini's native ReadFile, WriteFile, and Edit tools. Supports reading, writing, and editing files with structured parameters.";

  constructor() {
    super();
    
    // Configure features
    this.configureFeatures({
      fileHandling: true,
      backupSupport: true,
      promptMode: true,
      strictMode: StrictMode.OFF,
    });

    // Configure behavior
    this.configureBehavior({
      readsFilesystem: "relative",
      writesFilesystem: true,
      idempotent: false, // may mutate files
    });

    // Enable prompt mode
    this.enablePromptMode([
      {
        name: "operation",
        description: "Operation: 'read', 'write', or 'edit'",
        required: true
      },
      {
        name: "path",
        description: "File path (e.g., @src/main.js)",
        required: true
      },
      {
        name: "content",
        description: "Content for write operations",
        required: false
      }
    ]);
  }

  inputSchema = this.buildInputSchema({
      operation: {
        type: "string",
        enum: ["read", "write", "edit"],
        description: "The file operation to perform"
      },
      path: {
        type: "string",
        description: "File path (use @ syntax for relative paths, e.g., @src/main.js)"
      },
      content: {
        type: "string",
        description: "Content to write (for 'write' operation)"
      },
      oldContent: {
        type: "string",
        description: "Content to replace (for 'edit' operation)"
      },
      newContent: {
        type: "string",
        description: "Replacement content (for 'edit' operation)"
      },
      encoding: {
        type: "string",
        description: "File encoding (default: utf8)",
        default: "utf8"
      },
      createBackup: {
        type: "boolean",
        description: "Create backup before write/edit operations",
        default: false
      }
    }, ["operation", "path"]);

  protected async preExecute(args: any): Promise<void> {
    const params = args as FileOperationParams;
    
    // Validate parameters
    this.validateParams(params);
  }

  protected async doExecute(args: any): Promise<FileOperationResponse> {
    const params = args as FileOperationParams;
    
    // Resolve file path if using @ syntax
    const resolvedPath = await this.resolveFilePath(params.path);
    
    // Execute the appropriate operation
    const response = await this.executeOperation(params, resolvedPath);
    
    return response;
  }

  protected buildResponseSections(response: FileOperationResponse, _args: any): StandardizedResponseSections {
    // Build analysis section
    let analysis = `Executed ${response.operation} operation on: ${response.path}\n`;
    analysis += `Status: ${response.success ? 'SUCCESS' : 'FAILED'}`;
    if (response.message) {
      analysis += `\n${response.message}`;
    }
    if (response.metadata) {
      if (response.metadata.size !== undefined) {
        analysis += `\nFile size: ${response.metadata.size} bytes`;
      }
      if (response.metadata.modified) {
        analysis += `\nLast modified: ${response.metadata.modified}`;
      }
    }
    
    // Determine content and next steps based on operation
    let updatedContent = '';
    let nextSteps = '';
    let changesSuggested: string | undefined;
    
    switch (response.operation) {
      case 'read':
        updatedContent = response.content || '[No content found]';
        nextSteps = 'Review the file contents above. Use FileOperations with "edit" or "write" operation to modify if needed.';
        break;
        
      case 'write':
        updatedContent = response.content || '[File written successfully]';
        changesSuggested = 'File has been created/overwritten with the provided content.';
        nextSteps = 'Verify the file was written correctly. Use FileOperations with "read" to confirm the contents.';
        break;
        
      case 'edit':
        updatedContent = '[Edit completed successfully]';
        changesSuggested = response.message || 'File has been edited with the specified changes.';
        nextSteps = 'Use FileOperations with "read" to verify the changes were applied correctly.';
        break;
    }
    
    return {
      analysis,
      changesSuggested,
      updatedContent,
      nextSteps
    };
  }

  protected getMetadata(result: FileOperationResponse): any {
    return {
      status: result.success ? "success" : "failed",
      execution_details: `File ${result.operation} via Gemini native tools`,
    };
  }

  /**
   * Validate operation parameters
   */
  private validateParams(params: FileOperationParams): void {
  switch (params.operation) {
    case 'write':
      if (!params.content) {
        throw new Error("Write operation requires 'content' parameter");
      }
      break;
    case 'edit':
      if (!params.oldContent || !params.newContent) {
        throw new Error("Edit operation requires both 'oldContent' and 'newContent' parameters");
      }
      break;
    case 'read':
      // No additional validation needed
      break;
    default:
      throw new Error(`Unknown operation: ${params.operation}`);
  }
}

  /**
   * Resolve file path, handling @ syntax
   */
  private async resolveFilePath(path: string): Promise<string> {
  if (path.startsWith('@')) {
    // Use the existing path resolver for @ syntax
    const resolved = await resolveFilePaths(path);
    // Extract the actual path from the resolved format
    const match = resolved.match(/file: (.+?)(?:\n|$)/);
    return match ? match[1].trim() : path.substring(1);
  }
  return path;
}

  /**
   * Execute the file operation using Gemini
   */
  private async executeOperation(
  params: FileOperationParams, 
  resolvedPath: string
): Promise<FileOperationResponse> {
  let prompt: string;
  let response: FileOperationResponse = {
    success: false,
    operation: params.operation,
    path: resolvedPath
  };
  
  switch (params.operation) {
    case 'read':
      prompt = this.buildReadPrompt(resolvedPath, params.encoding);
      break;
    case 'write':
      if (params.createBackup) {
        await this.createBackup(resolvedPath);
      }
      prompt = this.buildWritePrompt(resolvedPath, params.content!, params.encoding);
      break;
    case 'edit':
      if (params.createBackup) {
        await this.createBackup(resolvedPath);
      }
      prompt = this.buildEditPrompt(
        resolvedPath, 
        params.oldContent!, 
        params.newContent!,
        params.encoding
      );
      break;
    default:
      throw new Error(`Unknown operation: ${params.operation}`);
  }
  
  // Execute via Gemini
  const result = await this.executeGemini(
    prompt,
    params,
    StrictMode.OFF
  );
  
  // Parse the result
  response = this.parseGeminiResponse(result, params.operation, resolvedPath);
  
  return response;
}

  /**
   * Build prompts for Gemini operations
   */
  private buildReadPrompt(path: string, encoding?: string): string {
  return `Use the ReadFile tool to read the contents of the file at path: ${path}
${encoding ? `Use encoding: ${encoding}` : ''}
Return the complete file contents and metadata (size, last modified date if available).`;
}

  private buildWritePrompt(path: string, content: string, encoding?: string): string {
  return `Use the WriteFile tool to write the following content to the file at path: ${path}
${encoding ? `Use encoding: ${encoding}` : ''}

Content to write:
"""
${content}
"""

Confirm the file was written successfully and return the file size.`;
}

  private buildEditPrompt(
  path: string, 
  oldContent: string, 
  newContent: string,
  encoding?: string
): string {
  return `Use the Edit tool to modify the file at path: ${path}
${encoding ? `Use encoding: ${encoding}` : ''}

Find this exact content:
"""
${oldContent}
"""

Replace it with:
"""
${newContent}
"""

Confirm the edit was successful and return the number of replacements made.`;
}

  /**
   * Create a backup of the file
   */
  private async createBackup(path: string): Promise<void> {
  const backupPath = `${path}.backup.${Date.now()}`;
  const backupPrompt = `Use the Shell tool to create a backup of the file:
cp "${path}" "${backupPath}"
Confirm the backup was created.`;
  
  await this.executeGemini(
    backupPrompt,
    {},
    StrictMode.OFF
  );
}

  /**
   * Parse Gemini's response into structured format
   */
  private parseGeminiResponse(
  rawResponse: string, 
  operation: string,
  path: string
): FileOperationResponse {
  const response: FileOperationResponse = {
    success: true,
    operation,
    path
  };
  
  // Extract relevant information based on operation
  switch (operation) {
    case 'read':
      // Extract file contents
      const contentMatch = rawResponse.match(/(?:contents?:|file contains:)\s*([\s\S]*?)(?:\n\n|$)/i);
      if (contentMatch) {
        response.content = contentMatch[1].trim();
      } else {
        // Fallback: assume the entire response is the content
        response.content = rawResponse;
      }
      
      // Try to extract metadata
      const sizeMatch = rawResponse.match(/(?:size|bytes):\s*(\d+)/i);
      const modifiedMatch = rawResponse.match(/(?:modified|last modified):\s*(.+?)(?:\n|$)/i);
      
      if (sizeMatch || modifiedMatch) {
        response.metadata = {};
        if (sizeMatch) response.metadata.size = parseInt(sizeMatch[1]);
        if (modifiedMatch) response.metadata.modified = modifiedMatch[1].trim();
      }
      break;
      
    case 'write':
      response.message = 'File written successfully';
      const writeSizeMatch = rawResponse.match(/(?:wrote|size).*?(\d+)\s*bytes/i);
      if (writeSizeMatch) {
        response.metadata = { size: parseInt(writeSizeMatch[1]) };
      }
      break;
      
    case 'edit':
      response.message = 'File edited successfully';
      const replacementMatch = rawResponse.match(/(\d+)\s*(?:replacement|occurrence|match)/i);
      if (replacementMatch) {
        response.message += ` (${replacementMatch[1]} replacement${parseInt(replacementMatch[1]) !== 1 ? 's' : ''})`;
      }
      break;
  }
  
  // Check for errors in the response
  if (rawResponse.toLowerCase().includes('error') || 
      rawResponse.toLowerCase().includes('failed') ||
      rawResponse.toLowerCase().includes('not found')) {
    response.success = false;
    response.message = rawResponse;
  }
  
  return response;
}

}

export const behavior = {
  idempotent: false, // may mutate files
  readsFilesystem: "relative",
  writesFilesystem: true,
  network: "none",
} as const;

// Create and export singleton instance
const fileOperationsTool = new FileOperationsTool();
export default fileOperationsTool;
