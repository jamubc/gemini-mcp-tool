export declare function executeGeminiCLI(prompt: string, model?: string, sandbox?: boolean, changeMode?: boolean, onProgress?: (newOutput: string) => void): Promise<string>;
export declare function processChangeModeOutput(rawResult: string, chunkIndex?: number, chunkCacheKey?: string, prompt?: string): Promise<string>;
//# sourceMappingURL=geminiExecutor.d.ts.map