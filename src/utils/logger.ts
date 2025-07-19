import { LOG_PREFIX } from "../constants.js";

export class Logger {
  private static formatMessage(message: string): string {
    return `${LOG_PREFIX} ${message}` + "\n";
  }

  static log(message: string, ...args: any[]): void {
    console.log(this.formatMessage(message), ...args);
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
    // this.warn("=== TOOL INVOCATION ===");
    // this.warn(`Tool: "${toolName}"`);
    this.warn("Raw arguments:", JSON.stringify(args, null, 2));
  }

  static toolParsedArgs(prompt: string, model?: string, sandbox?: boolean, changeMode?: boolean): void {
    this.warn(`Parsed prompt: "${prompt}"\nchangeMode: ${changeMode || false}`);
    //this.warn(`Parsed model: ${model || "default"}`);
    //this.warn(`Parsed sandbox: ${sandbox || false}`);
  }

  static commandExecution(command: string, args: string[], startTime: number): void {
    this.warn(`[${startTime}] Starting: ${command} ${args.map((arg) => `"${arg}"`).join(" ")}`);
  }

  // static progressUpdate(startTime: number, stdout: number, stderr: number): void {
  //   const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  //   this.warn(`[${elapsed}s] Still running... stdout: ${stdout} bytes, stderr: ${stderr} bytes`);
  // }

  
  // WTF
  static commandComplete(startTime: number, exitCode: number | null, outputLength?: number): void {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    this.warn(`[${elapsed}s] Process finished with exit code: ${exitCode}`);
    if (outputLength !== undefined) {
      this.warn(`Success! Output length: ${outputLength} bytes`);
    }
  }

  static validation(toolName: string, instructions: string, warnings: string[]): void {
    this.warn(`Validation for ${toolName}:`);
    this.warn(`Instructions: ${instructions}`);
    if (warnings.length > 0) {
      this.warn(`Warnings: ${warnings.join(", ")}`);
    }
  }
}