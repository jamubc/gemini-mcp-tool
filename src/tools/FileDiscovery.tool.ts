import { BaseTool } from './base-tool.js';
import { StrictMode, StrictModeType } from '../types/strict-mode.js';
import { ToolExecutionError } from '../types/errors.js';
import { resolveFilePaths } from '../utils/path-resolver.js';
import { StandardizedResponseSections } from '../utils/structured-response.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * FileDiscovery - Wraps Gemini's native file discovery and batch reading tools
 * 
 * This tool provides direct access to Gemini's powerful file discovery capabilities:
 * - FindFiles: Search for files by pattern, name, or content
 * - ReadFolder: List contents of directories
 * - ReadManyFiles: Read multiple files in one operation
 * 
 * Supports git-aware filtering and intelligent file discovery patterns.
 */

interface FileDiscoveryParams {
  operation: 'list' | 'find' | 'readMany';
  path?: string;
  pattern?: string;
  fileType?: string;
  maxDepth?: number;
  includeHidden?: boolean;
  excludePatterns?: string[];
  limit?: number;
  contentPattern?: string;
  autoResolve?: boolean;
  strictMode?: StrictModeType;
}

interface DiscoveredFile {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  content?: string;
}

interface FileDiscoveryResponse {
  success: boolean;
  operation: string;
  files: DiscoveredFile[];
  totalFound: number;
  truncated: boolean;
  searchPath?: string;
  pattern?: string;
  resolvedPath?: string;
  meta?: {
    resolutionNote?: string;
  };
}

class FileDiscoveryTool extends BaseTool {
  name = "FileDiscovery";
  description = "Discover and read multiple files using Gemini's native file tools. Examples: {operation:'list',path:'@src'} lists directory contents, {operation:'find',path:'@.',pattern:'*.ts'} finds TypeScript files, {operation:'readMany',path:'@src',fileType:'.js'} reads all JS files.";

  constructor() {
    super();
    
    // Configure features
    this.configureFeatures({
      strictMode: StrictMode.SEARCH, // Default to SEARCH for JSON compliance
      fileHandling: true,
      autoResolve: true,
      promptMode: true,
    });

    // Configure behavior
    this.configureBehavior({
      readsFilesystem: "relative",
    });

    // Enable prompt mode
    this.enablePromptMode([
      {
        name: "operation",
        description: "Operation: 'list', 'find', or 'readMany'",
        required: true
      },
      {
        name: "path",
        description: "Search path (e.g., @src/)",
        required: false
      },
      {
        name: "pattern",
        description: "Search pattern",
        required: false
      },
      {
        name: "autoResolve",
        description: "Auto-resolve to fallback paths if needed",
        required: false
      },
      {
        name: "strictMode",
        description: "Force JSON-compliant responses ('search' recommended)",
        required: false
      }
    ]);
  }

  inputSchema = this.buildInputSchema({
      operation: {
        type: "string",
        enum: ["list", "find", "readMany"],
        description: "Discovery operation: 'list' (directory contents), 'find' (search by pattern), 'readMany' (bulk read files)"
      },
      path: {
        type: "string",
        description: "Base path for search/listing (use @ syntax, e.g., @src/)",
        default: "@."
      },
      pattern: {
        type: "string",
        description: "Search pattern (glob for files, regex for content)"
      },
      fileType: {
        type: "string",
        description: "Filter by file type (e.g., '.js', '.ts', '.json')"
      },
      maxDepth: {
        type: "number",
        description: "Maximum directory depth for recursive search (default: 5 for performance)",
        default: 5
      },
      includeHidden: {
        type: "boolean",
        description: "Include hidden files/directories",
        default: false
      },
      excludePatterns: {
        type: "array",
        items: { type: "string" },
        description: "Patterns to exclude (defaults to common heavy directories: node_modules, .git, dist, build, etc.)"
      },
      limit: {
        type: "number",
        description: "Maximum number of files to return",
        default: 100
      },
      contentPattern: {
        type: "string",
        description: "Search within file contents (regex)"
      },
      autoResolve: {
        type: "boolean",
        description: "Automatically fallback to alternative paths if resolved path is empty",
        default: false
      },
      strictMode: {
        type: "string",
        enum: ["off", "analysis", "change", "search", "auto"],
        description: "Strict mode for Gemini responses (default: 'search' for JSON compliance)",
        default: "search"
      }
    }, ["operation"]);

  protected async preExecute(args: any): Promise<void> {
    const params = args as FileDiscoveryParams;
    
    // Validate operation is provided
    if (!params.operation) {
      throw new ToolExecutionError(
        this.name,
        'Operation parameter is required. Use "list" to show directory contents, "find" to search for files, or "readMany" to read multiple files. Example: {operation:"list",path:"@src"}'
      );
    }
    
    // Validate parameters
    this.validateDiscoveryParams(params);
  }

  protected async doExecute(args: any): Promise<FileDiscoveryResponse> {
    const params = args as FileDiscoveryParams;
    
    // Set defaults
    params.path = params.path || '@.';
    if (params.maxDepth === undefined) {
      params.maxDepth = params.operation === 'list' ? 1 : 5;
    }
    params.limit = params.limit || 100;
    
    // Set simplified default excludePatterns for common build artifacts
    if (!params.excludePatterns || params.excludePatterns.length === 0) {
      params.excludePatterns = [
        'node_modules',
        '.git',
        'dist',
        'build'
      ];
    }
    
    // Resolve base path with optional auto-resolution
    const resolutionResult = await this.resolveDiscoveryPathWithFallback(
      params.path,
      params.autoResolve || false
    );
    
    // Execute the discovery operation
    const response = await this.executeDiscovery(params, resolutionResult.resolvedPath);
    
    // Attach the resolved path and metadata to the response
    response.resolvedPath = resolutionResult.resolvedPath;
    if (resolutionResult.resolutionNote) {
      response.meta = { resolutionNote: resolutionResult.resolutionNote };
    }
    
    return response;
  }

  protected buildResponseSections(response: FileDiscoveryResponse, _args: any): StandardizedResponseSections {
    // Create analysis summary
    let analysis = `Performed ${response.operation} operation in: ${response.searchPath}`;
    if (response.resolvedPath) {
      analysis += `\nResolved to: ${response.resolvedPath}`;
    }
    if (response.meta?.resolutionNote) {
      analysis += `\n${response.meta.resolutionNote}`;
    }
    analysis += `\n\nFound ${response.totalFound} ${response.totalFound === 1 ? 'item' : 'items'}`;
    if (response.truncated) {
      analysis += ` (results truncated)`;
    }
    
    // Format file list for updated content
    let fileList = '';
    if (response.operation === 'readMany' && response.files.some(f => f.content)) {
      // For readMany with content, format as file blocks
      response.files.forEach(file => {
        fileList += `\n=== ${file.path} ===\n`;
        if (file.content) {
          fileList += file.content;
        } else {
          fileList += '[No content available]';
        }
        fileList += '\n';
      });
    } else {
      // For other operations, provide a clean JSON listing
      fileList = JSON.stringify(response, null, 2);
    }
    
    // Determine next steps based on operation
    let nextSteps = '';
    switch (response.operation) {
      case 'list':
        nextSteps = 'Use the file paths above to read specific files or navigate directories.';
        break;
      case 'find':
        nextSteps = 'Use FileOperations tool to read or modify the discovered files.';
        break;
      case 'readMany':
        nextSteps = 'Review the file contents above. Use FileOperations to modify files if needed.';
        break;
    }
    
    return {
      analysis,
      updatedContent: fileList,
      nextSteps
    };
  }

  protected getMetadata(_result: FileDiscoveryResponse): any {
    return {
      status: "success",
      execution_details: `${_result.operation} completed successfully`,
    };
  }

  /**
   * Validate discovery parameters
   */
  private validateDiscoveryParams(params: FileDiscoveryParams): void {
  switch (params.operation) {
    case 'find':
      if (!params.pattern && !params.fileType && !params.contentPattern) {
        throw new Error("Find operation requires at least one of: pattern, fileType, or contentPattern");
      }
      break;
case 'readMany':
      if (!params.pattern && !params.fileType) {
        throw new Error("ReadMany operation requires pattern or fileType");
      }
      break;
    case 'list':
      // No additional validation
      break;
    default:
      throw new Error(`Unknown operation: ${params.operation}`);
  }
}

  /**
   * Resolve discovery path to absolute path
   * Handles @ syntax and relative paths
   */
  private async resolveDiscoveryPath(searchPath: string): Promise<string> {
  if (searchPath.startsWith('@')) {
    const resolved = await resolveFilePaths(searchPath);
    const match = resolved.match(/directory: (.+?)(?:\n|$)/);
    if (match) {
      return match[1].trim();
    }
    // Fallback: remove @ prefix and resolve
    return path.resolve(searchPath.substring(1));
  }
  // Always resolve to absolute path for transparency
  return path.resolve(searchPath);
}

  /**
   * Enhanced path resolution with fallback support
   */
  private async resolveDiscoveryPathWithFallback(
  searchPath: string,
  autoResolve: boolean
): Promise<{ resolvedPath: string; resolutionNote?: string }> {
  // First, try standard resolution
  const resolvedPath = await this.resolveDiscoveryPath(searchPath);
  
  // If autoResolve is disabled or path exists, return as-is
  if (!autoResolve || await this.pathExists(resolvedPath)) {
    return { resolvedPath };
  }
  
  // Try fallback strategies
  // 1. Try current working directory
  const cwd = process.cwd();
  if (await this.pathExists(cwd)) {
    return {
      resolvedPath: cwd,
      resolutionNote: "Auto-resolved to current directory (original path was empty or non-existent)"
    };
  }
  
  // 2. Try finding nearest ancestor with files (max 5 levels or until .git)
  let currentDir = cwd;
  let levels = 0;
  const maxLevels = 5;
  
  while (levels < maxLevels) {
    const parentDir = path.dirname(currentDir);
    
    // Stop if we've reached the root
    if (parentDir === currentDir) break;
    
    // Check if parent has .git directory (repository root)
    const gitPath = path.join(parentDir, '.git');
    if (await this.pathExists(gitPath)) {
      return {
        resolvedPath: parentDir,
        resolutionNote: "Auto-resolved to repository root"
      };
    }
    
    // Check if parent has any files
    try {
      const entries = await fs.promises.readdir(parentDir);
      if (entries.length > 0) {
        return {
          resolvedPath: parentDir,
          resolutionNote: `Auto-resolved to parent directory (${levels + 1} level${levels > 0 ? 's' : ''} up)`
        };
      }
    } catch (error) {
      // Continue to next level
    }
    
    currentDir = parentDir;
    levels++;
  }
  
  // If all fallbacks fail, return original resolved path
  return {
    resolvedPath,
    resolutionNote: "Warning: Path could not be auto-resolved to a valid directory"
  };
}

  /**
   * Check if a path exists and is accessible
   */
  private async pathExists(pathToCheck: string): Promise<boolean> {
  try {
    await fs.promises.access(pathToCheck);
    return true;
  } catch {
    return false;
  }
}

  /**
   * Execute the discovery operation
   */
  private async executeDiscovery(
  params: FileDiscoveryParams,
  resolvedPath: string
): Promise<FileDiscoveryResponse> {
  // Fast-path: simple non-recursive listing handled locally
  if (params.operation === 'list' && (params.maxDepth ?? 1) <= 1) {
    const entries = await fs.promises.readdir(resolvedPath, { withFileTypes: true });
    const files: DiscoveredFile[] = [];

    for (const entry of entries) {
      if (!params.includeHidden && entry.name.startsWith('.')) continue;
      const fullPath = path.join(resolvedPath, entry.name);
      // Check exclude patterns
      if (params.excludePatterns?.some(pat => fullPath.includes(pat))) continue;

      files.push({
        path: fullPath,
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file'
      });
      if (files.length >= (params.limit ?? 100)) break;
    }

    return {
      success: true,
      operation: 'list',
      files,
      totalFound: files.length,
      truncated: entries.length > files.length,
      searchPath: params.path,
      pattern: params.pattern
    };
  }

  // Otherwise fall back to Gemini for find / readMany / deep list
  let prompt: string;

  switch (params.operation) {
    case 'list':
      prompt = this.buildListPrompt(params, resolvedPath);
      break;
    case 'find':
      prompt = this.buildFindPrompt(params, resolvedPath);
      break;
    case 'readMany':
      prompt = this.buildReadManyPrompt(params, resolvedPath);
      break;
    default:
      throw new Error(`Unknown operation: ${params.operation}`);
  }

  // Execute via Gemini with appropriate strict mode
  const result = await this.executeGemini(
    prompt,
    params,
    params.strictMode || StrictMode.SEARCH // Default to SEARCH for JSON compliance
  );

  // Parse the response
  return this.parseDiscoveryResponse(result, params);
}

  /**
   * Build prompts for discovery operations
   */
  /**
   * Build prompt for a simple directory listing (non-recursive by default)
   */
  private buildListPrompt(params: FileDiscoveryParams, path: string): string {
  return `Use the ReadFolder tool to list the contents of ${path}\n` +
    `Include hidden files: ${params.includeHidden || false}\n` +
    `Maximum depth: 1 (no recursion)\n` +
    `Return for each entry:\n` +
    `- Full path\n- File name\n- Type (file|directory)\n- File size`;
}

  private buildFindPrompt(params: FileDiscoveryParams, path: string): string {
  const conditions: string[] = [];
  
  if (params.pattern) {
    conditions.push(`matching pattern "${params.pattern}"`);
  }
  if (params.fileType) {
    conditions.push(`with extension "${params.fileType}"`);
  }
  if (params.contentPattern) {
    conditions.push(`containing text matching /${params.contentPattern}/`);
  }
  
  const excludeClause = params.excludePatterns?.length 
    ? `\nExclude: ${params.excludePatterns.join(', ')}`
    : '';
  
  return `Use the FindFiles tool to search for files in ${path}
Find files ${conditions.join(' AND ')}
Maximum depth: ${params.maxDepth}
Include hidden files: ${params.includeHidden || false}${excludeClause}
Limit results to ${params.limit} files

Return each file with:
- Full path
- File name
- File size
- Last modified date
${params.contentPattern ? '- Matching content snippets' : ''}`;
}


  private buildReadManyPrompt(params: FileDiscoveryParams, path: string): string {
  const fileSelector = params.pattern 
    ? `files matching pattern "${params.pattern}"`
    : `files with extension "${params.fileType}"`;
  
  return `Use the ReadManyFiles tool to read multiple files from ${path}
Read all ${fileSelector}
Maximum depth: ${params.maxDepth}
${params.excludePatterns?.length ? `Exclude: ${params.excludePatterns.join(', ')}` : ''}
Limit to ${params.limit} files

Return for each file:
- Full path
- Complete file contents
- File size`;
}

  /**
   * Parse discovery response
   */
  private parseDiscoveryResponse(
  rawResponse: string,
  params: FileDiscoveryParams
): FileDiscoveryResponse {
  const response: FileDiscoveryResponse = {
    success: true,
    operation: params.operation,
    files: [],
    totalFound: 0,
    truncated: false,
    searchPath: params.path,
    pattern: params.pattern
  };
  
  // Parse different response formats
  const fileRegex = /(?:file|path):\s*(.+?)(?:\n|$)/gi;
  const contentRegex = /content:\s*([\s\S]+?)(?=\n(?:file|path):|$)/gi;
  
  // Extract file information
  let match;
  const files: Map<string, DiscoveredFile> = new Map();
  
  // Extract file paths
  while ((match = fileRegex.exec(rawResponse)) !== null) {
    const filePath = match[1].trim();
    const fileName = filePath.split('/').pop() || filePath;
    
    files.set(filePath, {
      path: filePath,
      name: fileName,
      type: 'file' // Default, may be updated
    });
  }
  
  
  // Extract file contents for readMany operation
  if (params.operation === 'readMany') {
    contentRegex.lastIndex = 0;
    const contents: string[] = [];
    while ((match = contentRegex.exec(rawResponse)) !== null) {
      contents.push(match[1].trim());
    }
    
    // Match contents to files
    let contentIndex = 0;
    files.forEach((file) => {
      if (contentIndex < contents.length && file.type === 'file') {
        file.content = contents[contentIndex++];
      }
    });
  }
  
  // Extract metadata
  const sizeRegex = /size:\s*(\d+)(?:\s*bytes)?/gi;
  const modifiedRegex = /modified:\s*(.+?)(?:\n|$)/gi;
  
  // Parse sizes
  while ((match = sizeRegex.exec(rawResponse)) !== null) {
    const size = parseInt(match[1]);
    // Assign to next file without size
    for (const file of files.values()) {
      if (file.size === undefined && file.type === 'file') {
        file.size = size;
        break;
      }
    }
  }
  
  // Check if results were truncated
  if (rawResponse.includes('truncated') || 
      rawResponse.includes('limited to') ||
      rawResponse.includes(`showing first ${params.limit}`)) {
    response.truncated = true;
  }
  
  // Convert to array
  response.files = Array.from(files.values());
  response.totalFound = response.files.length;
  
  // Apply limit
  if (response.files.length > params.limit!) {
    response.files = response.files.slice(0, params.limit);
    response.truncated = true;
  }
  
  return response;
}

}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export const behavior = {
  idempotent: true,
  readsFilesystem: "relative",
  writesFilesystem: false,
  network: "none",
} as const;

// Create and export singleton instance
const fileDiscoveryTool = new FileDiscoveryTool();
export default fileDiscoveryTool;
