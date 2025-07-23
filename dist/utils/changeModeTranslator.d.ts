import { ChangeModeEdit } from './changeModeParser.js';
export declare function formatChangeModeResponse(edits: ChangeModeEdit[], chunkInfo?: {
    current: number;
    total: number;
    cacheKey?: string;
}): string;
export declare function summarizeChangeModeEdits(edits: ChangeModeEdit[], isPartialView?: boolean): string;
//# sourceMappingURL=changeModeTranslator.d.ts.map