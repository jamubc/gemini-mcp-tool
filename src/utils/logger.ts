import { LOG_PREFIX } from "../constants.js";

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private static currentLevel: LogLevel = this.getLogLevel();
  private static structured: boolean = this.getStructuredLogging();

  private static logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  private static getLogLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
    return ['debug', 'info', 'warn', 'error'].includes(envLevel) ? envLevel : 'info';
  }

  private static getStructuredLogging(): boolean {
    return process.env.LOG_FORMAT === 'json';
  }

  private static shouldLog(level: LogLevel): boolean {
    return this.logLevels[level] >= this.logLevels[this.currentLevel];
  }

  private static formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    
    if (this.structured) {
      // Structured JSON logging
      const logEntry = {
        timestamp,
        level: level.toUpperCase(),
        service: 'gemini-mcp',
        message,
        ...(args.length > 0 && { data: args.length === 1 ? args[0] : args })
      };
      return JSON.stringify(logEntry);
    } else {
      // Traditional text logging (maintain current format)
      const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ') : '';
      return `${LOG_PREFIX} ${message}${formattedArgs}`;
    }
  }

  static debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, ...args));
    }
  }

  static info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, ...args));
    }
  }

  static warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, ...args));
    }
  }

  static error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, ...args));
    }
  }

  static log(message: string, ...args: any[]): void {
    // Maintain backward compatibility
    this.info(message, ...args);
  }

  // Utility method to change log level at runtime
  static setLogLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  // Get current configuration for debugging
  static getConfig(): { level: LogLevel; structured: boolean } {
    return {
      level: this.currentLevel,
      structured: this.structured
    };
  }

  // Specialized logging methods (maintaining backward compatibility)
  static toolInvocation(toolName: string, args: any): void {
    this.debug(`Tool invocation - ${toolName}:`, JSON.stringify(args, null, 2));
  }

  static toolParsedArgs(prompt: string, model?: string, sandbox?: boolean, changeMode?: boolean): void {
    this.debug(`Parsed prompt: "${prompt}" | changeMode: ${changeMode || false}`);
  }

  static commandExecution(command: string, args: string[], startTime: number): void {
    this.debug(`[${startTime}] Starting: ${command} ${args.map((arg) => `"${arg}"`).join(" ")}`);
    
    // Store command execution start for timing analysis
    this._commandStartTimes.set(startTime, { command, args, startTime });
  }

  // Track command start times for duration calculation
  private static _commandStartTimes = new Map<number, { command: string; args: string[]; startTime: number }>();

  static commandComplete(startTime: number, exitCode: number | null, outputLength?: number): void {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    this.info(`[${elapsed}s] Process finished with exit code: ${exitCode}`);
    if (outputLength !== undefined) {
      this.debug(`Response: ${outputLength} chars`);
    }

    // Clean up command tracking
    this._commandStartTimes.delete(startTime);
  }
}