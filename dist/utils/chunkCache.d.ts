import { EditChunk } from './changeModeChunker.js';
/**
 * Caches chunks from a changeMode response
 * @param prompt The original prompt (used for hash generation)
 * @param chunks The parsed and chunked edits
 * @returns A short cache key for retrieval
 */
export declare function cacheChunks(prompt: string, chunks: EditChunk[]): string;
/**
 * Retrieves cached chunks if they exist and haven't expired
 * @param cacheKey The cache key returned from cacheChunks
 * @returns The cached chunks or null if expired/not found
 */
export declare function getChunks(cacheKey: string): EditChunk[] | null;
export declare function getCacheStats(): {
    size: number;
    ttl: number;
    maxSize: number;
    cacheDir: string;
};
export declare function clearCache(): void;
//# sourceMappingURL=chunkCache.d.ts.map