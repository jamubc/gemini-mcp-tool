import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

interface SecurityConfig {
  allowParentTraversal: boolean;
  blockedExtensions: string[];
  blockedPaths: string[];
  sensitivePatterns: RegExp[];
  maxPathDepth: number;
  projectRoot: string;
}

export interface SecurityStats {
  validations: number;
  blocked: number;
  violations: {
    pathTraversal: number;
    sensitiveFile: number;
    systemPath: number;
    outsideProject: number;
  };
}

export class ValidationError extends Error {
  constructor(message: string, public code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Security validator for path and file access
 */
export class SecurityValidator {
  private config: SecurityConfig;
  private stats: SecurityStats;
  private projectBoundaries: Set<string>;
  
  constructor() {
    // Load configuration from environment variables
    const blockedExtensions = (process.env.GEMINI_MCP_BLOCKED_EXTENSIONS || '.env,.secret,.key,.pem,.p12,.pfx,.crt,.cer').split(',');
    const blockedPaths = (process.env.GEMINI_MCP_BLOCKED_PATHS || '/etc,/proc,/sys,/var,/private,/System,/Library').split(',');
    
    this.config = {
      allowParentTraversal: process.env.GEMINI_MCP_ALLOW_PARENT_TRAVERSAL === 'true',
      blockedExtensions: blockedExtensions.map(ext => ext.trim()),
      blockedPaths: blockedPaths.map(p => p.trim()),
      sensitivePatterns: this.createSensitivePatterns(),
      maxPathDepth: parseInt(process.env.GEMINI_MCP_MAX_PATH_DEPTH || '10', 10),
      projectRoot: process.cwd()
    };
    
    this.stats = {
      validations: 0,
      blocked: 0,
      violations: {
        pathTraversal: 0,
        sensitiveFile: 0,
        systemPath: 0,
        outsideProject: 0
      }
    };
    
    // Initialize project boundaries
    this.projectBoundaries = new Set([
      this.config.projectRoot,
      os.homedir(),
      path.join(os.homedir(), 'Documents'),
      path.join(os.homedir(), 'Desktop'),
      path.join(os.homedir(), 'Downloads')
    ]);
  }
  
  /**
   * Create regex patterns for sensitive file detection
   */
  private createSensitivePatterns(): RegExp[] {
    return [
      /\.env/i,
      /\.secret/i,
      /password/i,
      /private.*key/i,
      /id_rsa/i,
      /id_dsa/i,
      /id_ecdsa/i,
      /id_ed25519/i,
      /\.ssh\//,
      /\.gnupg\//,
      /\.aws\/credentials/i,
      /\.git\/config/i,
      /\.npmrc/i,
      /\.pypirc/i,
      /\.docker\/config/i,
      /kubeconfig/i,
      /\.kube\/config/i,
      /token/i,
      /api.*key/i,
      /auth/i,
      /credential/i
    ];
  }
  
  /**
   * Validate a file path for security concerns
   */
  async validatePath(filePath: string): Promise<void> {
    this.stats.validations++;
    
    try {
      // Normalize the path
      const normalizedPath = path.normalize(filePath);
      const absolutePath = path.resolve(normalizedPath);
      
      // Check for path traversal
      if (!this.config.allowParentTraversal && this.hasPathTraversal(filePath)) {
        this.recordViolation('pathTraversal');
        throw new ValidationError('Path traversal detected', 'PATH_TRAVERSAL');
      }
      
      // Check path depth
      const depth = absolutePath.split(path.sep).length;
      if (depth > this.config.maxPathDepth) {
        this.recordViolation('pathTraversal');
        throw new ValidationError(`Path depth exceeds maximum allowed (${this.config.maxPathDepth})`, 'PATH_DEPTH');
      }
      
      // Check for system paths
      if (this.isSystemPath(absolutePath)) {
        this.recordViolation('systemPath');
        throw new ValidationError('Access to system directory denied', 'SYSTEM_PATH');
      }
      
      // Check for sensitive files
      if (this.isSensitiveFile(absolutePath)) {
        this.recordViolation('sensitiveFile');
        throw new ValidationError('Access to sensitive file denied', 'SENSITIVE_FILE');
      }
      
      // Check file extension
      const ext = path.extname(absolutePath).toLowerCase();
      if (this.config.blockedExtensions.includes(ext)) {
        this.recordViolation('sensitiveFile');
        throw new ValidationError(`File type '${ext}' is blocked`, 'BLOCKED_EXTENSION');
      }
      
      // Check if path is within project boundaries
      if (!this.isWithinBoundaries(absolutePath)) {
        this.recordViolation('outsideProject');
        throw new ValidationError('Path is outside allowed boundaries', 'OUTSIDE_BOUNDARIES');
      }
      
      // Additional checks for existing files
      try {
        const stats = await fs.stat(absolutePath);
        
        // Check for symbolic links
        if (stats.isSymbolicLink()) {
          const realPath = await fs.realpath(absolutePath);
          // Recursively validate the real path
          await this.validatePath(realPath);
        }
        
        // Check file permissions (Unix-like systems)
        if (process.platform !== 'win32') {
          const mode = stats.mode;
          // Check if file has unusual permissions (e.g., setuid/setgid)
          if ((mode & 0o4000) || (mode & 0o2000)) {
            this.recordViolation('sensitiveFile');
            throw new ValidationError('File has special permissions', 'SPECIAL_PERMISSIONS');
          }
        }
      } catch (error: any) {
        // File doesn't exist, which is fine for write operations
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      // Re-throw other errors
      throw new ValidationError(`Validation failed: ${error}`, 'VALIDATION_FAILED');
    }
  }
  
  /**
   * Check for path traversal attempts
   */
  private hasPathTraversal(filePath: string): boolean {
    // Check for .. sequences
    if (filePath.includes('..')) {
      // Allow if it's part of a legitimate filename
      const segments = filePath.split(path.sep);
      return segments.some(segment => segment === '..');
    }
    
    // Check for absolute paths trying to escape
    if (path.isAbsolute(filePath)) {
      const normalized = path.normalize(filePath);
      const relative = path.relative(this.config.projectRoot, normalized);
      return relative.startsWith('..');
    }
    
    return false;
  }
  
  /**
   * Check if path is a system directory
   */
  private isSystemPath(absolutePath: string): boolean {
    const lowerPath = absolutePath.toLowerCase();
    
    return this.config.blockedPaths.some(blockedPath => {
      const normalizedBlocked = path.normalize(blockedPath).toLowerCase();
      return lowerPath === normalizedBlocked || lowerPath.startsWith(normalizedBlocked + path.sep);
    });
  }
  
  /**
   * Check if file matches sensitive patterns
   */
  private isSensitiveFile(absolutePath: string): boolean {
    const filename = path.basename(absolutePath);
    const fullPath = absolutePath.toLowerCase();
    
    return this.config.sensitivePatterns.some(pattern => {
      return pattern.test(filename) || pattern.test(fullPath);
    });
  }
  
  /**
   * Check if path is within allowed boundaries
   */
  private isWithinBoundaries(absolutePath: string): boolean {
    // Allow paths within any of the defined boundaries
    for (const boundary of this.projectBoundaries) {
      const relative = path.relative(boundary, absolutePath);
      if (!relative.startsWith('..')) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Record a security violation
   */
  private recordViolation(type: keyof SecurityStats['violations']): void {
    this.stats.blocked++;
    this.stats.violations[type]++;
    
    // Log violation if debug level is high enough
    const debugLevel = parseInt(process.env.DEBUG_LEVEL || '1', 10);
    if (debugLevel >= 2) {
      console.warn(`[Gemini MCP] Security violation: ${type}`);
    }
  }
  
  /**
   * Add an allowed boundary path
   */
  addBoundary(boundaryPath: string): void {
    this.projectBoundaries.add(path.resolve(boundaryPath));
  }
  
  /**
   * Remove an allowed boundary path
   */
  removeBoundary(boundaryPath: string): void {
    this.projectBoundaries.delete(path.resolve(boundaryPath));
  }
  
  /**
   * Get current statistics
   */
  getStats(): SecurityStats {
    return { ...this.stats };
  }
  
  /**
   * Reset statistics
   */
  reset(): void {
    this.stats = {
      validations: 0,
      blocked: 0,
      violations: {
        pathTraversal: 0,
        sensitiveFile: 0,
        systemPath: 0,
        outsideProject: 0
      }
    };
  }
  
  /**
   * Update configuration
   */
  updateConfig(updates: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...updates };
  }
  
  /**
   * Get current configuration (for debugging)
   */
  getConfig(): Readonly<SecurityConfig> {
    return { ...this.config };
  }
}