export declare class Logger {
    private static formatMessage;
    static log(message: string, ...args: any[]): void;
    static warn(message: string, ...args: any[]): void;
    static error(message: string, ...args: any[]): void;
    static debug(message: string, ...args: any[]): void;
    static toolInvocation(toolName: string, args: any): void;
    static toolParsedArgs(prompt: string, model?: string, sandbox?: boolean, changeMode?: boolean): void;
    static commandExecution(command: string, args: string[], startTime: number): void;
    private static _commandStartTimes;
    static commandComplete(startTime: number, exitCode: number | null, outputLength?: number): void;
}
//# sourceMappingURL=logger.d.ts.map