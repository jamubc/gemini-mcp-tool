export interface ChangeModeEdit {
    filename: string;
    oldStartLine: number;
    oldEndLine: number;
    oldCode: string;
    newStartLine: number;
    newEndLine: number;
    newCode: string;
}
export declare function parseChangeModeOutput(geminiResponse: string): ChangeModeEdit[];
export declare function validateChangeModeEdits(edits: ChangeModeEdit[]): {
    valid: boolean;
    errors: string[];
};
//# sourceMappingURL=changeModeParser.d.ts.map