import { ChangeModeEdit } from './changeModeParser.js';
export interface EditChunk {
    edits: ChangeModeEdit[];
    chunkIndex: number;
    totalChunks: number;
    hasMore: boolean;
    estimatedChars: number;
}
export declare function chunkChangeModeEdits(edits: ChangeModeEdit[], maxCharsPerChunk?: number): EditChunk[];
export declare function summarizeChunking(chunks: EditChunk[]): string;
//# sourceMappingURL=changeModeChunker.d.ts.map