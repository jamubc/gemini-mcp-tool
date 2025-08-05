// WIP
import { LOG_PREFIX } from "../constants.js";

export class Logger {
  private static formatMessage(message: string): string {
    return `${LOG_PREFIX} ${message}` + "\n";
  }

  static log(message: string, ...args: any[]): void {
    console.warn(this.formatMessage(message), ...args);
  }

  static warn(message: string, ...args: any[]): void {
    console.warn(this.formatMessage(message), ...args);
  }

  static error(message: string, ...args: any[]): void {
    console.error(this.formatMessage(message), ...args);
  }

  static debug(message: string, ...args: any[]): void {
    console.warn(this.formatMessage(message), ...args);
  }

  static toolInvocation(toolName: string, args: any): void {
    this.warn("Raw:", JSON.stringify(args, null, 2));
  }

  static toolParsedArgs(prompt: string, model?: string, sandbox?: boolean, changeMode?: boolean): void {
    this.warn(`Parsed prompt: "${prompt}"\nchangeMode: ${changeMode || false}`);
  }

  static commandExecution(command: string, args: string[], startTime: number): void {
    this.warn(`[${startTime}] Starting: ${command} ${args.map((arg) => `"${arg}"`).join(" ")}`);
    
    // Store command execution start for timing analysis
    this._commandStartTimes.set(startTime, { command, args, startTime });
  }

  // Track command start times for duration calculation
  private static _commandStartTimes = new Map<number, { command: string; args: string[]; startTime: number }>();

  static commandComplete(startTime: number, exitCode: number | null, outputLength?: number): void {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    this.warn(`[${elapsed}s] Process finished with exit code: ${exitCode}`);
    if (outputLength !== undefined) {
      this.warn(`Response: ${outputLength} chars`);
    }

    // Clean up command tracking
    this._commandStartTimes.delete(startTime);
  }
}