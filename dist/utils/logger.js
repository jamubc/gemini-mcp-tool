// WIP
import { LOG_PREFIX } from "../constants.js";
export class Logger {
    static formatMessage(message) {
        return `${LOG_PREFIX} ${message}` + "\n";
    }
    static log(message, ...args) {
        console.warn(this.formatMessage(message), ...args);
    }
    static warn(message, ...args) {
        console.warn(this.formatMessage(message), ...args);
    }
    static error(message, ...args) {
        console.error(this.formatMessage(message), ...args);
    }
    static debug(message, ...args) {
        console.warn(this.formatMessage(message), ...args);
    }
    static toolInvocation(toolName, args) {
        this.warn("Raw:", JSON.stringify(args, null, 2));
    }
    static toolParsedArgs(prompt, model, sandbox, changeMode) {
        this.warn(`Parsed prompt: "${prompt}"\nchangeMode: ${changeMode || false}`);
    }
    static commandExecution(command, args, startTime) {
        this.warn(`[${startTime}] Starting: ${command} ${args.map((arg) => `"${arg}"`).join(" ")}`);
        // Store command execution start for timing analysis
        this._commandStartTimes.set(startTime, { command, args, startTime });
    }
    // Track command start times for duration calculation
    static _commandStartTimes = new Map();
    static commandComplete(startTime, exitCode, outputLength) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        this.warn(`[${elapsed}s] Process finished with exit code: ${exitCode}`);
        if (outputLength !== undefined) {
            this.warn(`Response: ${outputLength} chars`);
        }
        // Clean up command tracking
        this._commandStartTimes.delete(startTime);
    }
}
//# sourceMappingURL=logger.js.map