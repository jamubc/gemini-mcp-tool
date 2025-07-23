import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logger } from './logger.js';
const CACHE_DIR = path.join(os.tmpdir(), 'gemini-mcp-chunks');
const CACHE_TTL = 10 * 60 * 1000;
const MAX_CACHE_FILES = 50;
function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}
/**
 * Caches chunks from a changeMode response
 * @param prompt The original prompt (used for hash generation)
 * @param chunks The parsed and chunked edits
 * @returns A short cache key for retrieval
 */
export function cacheChunks(prompt, chunks) {
    ensureCacheDir();
    cleanExpiredFiles(); // Cleanup on each write
    // Generate deterministic cache key from prompt
    const promptHash = createHash('sha256').update(prompt).digest('hex');
    const cacheKey = promptHash.slice(0, 8);
    const filePath = path.join(CACHE_DIR, `${cacheKey}.json`);
    // Store with metadata
    const cacheData = {
        chunks,
        timestamp: Date.now(),
        promptHash
    };
    try {
        fs.writeFileSync(filePath, JSON.stringify(cacheData));
        Logger.debug(`Cached ${chunks.length} chunks to file: ${cacheKey}.json`);
    }
    catch (error) {
        Logger.error(`Failed to cache chunks: ${error}`);
    }
    enforceFileLimits();
    return cacheKey;
}
/**
 * Retrieves cached chunks if they exist and haven't expired
 * @param cacheKey The cache key returned from cacheChunks
 * @returns The cached chunks or null if expired/not found
 */
export function getChunks(cacheKey) {
    const filePath = path.join(CACHE_DIR, `${cacheKey}.json`);
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent);
        if (Date.now() - data.timestamp > CACHE_TTL) {
            fs.unlinkSync(filePath);
            Logger.debug(`Cache expired for ${cacheKey}, deleted file`);
            return null;
        }
        Logger.debug(`Cache hit for ${cacheKey}, returning ${data.chunks.length} chunks`);
        return data.chunks;
    }
    catch (error) {
        Logger.debug(`Cache read error for ${cacheKey}: ${error}`);
        try {
            fs.unlinkSync(filePath); // Clean up bad file
        }
        catch { }
        return null;
    }
}
function cleanExpiredFiles() {
    try {
        ensureCacheDir();
        const files = fs.readdirSync(CACHE_DIR);
        const now = Date.now();
        let cleaned = 0;
        for (const file of files) {
            if (!file.endsWith('.json'))
                continue;
            const filePath = path.join(CACHE_DIR, file);
            try {
                const stats = fs.statSync(filePath);
                if (now - stats.mtimeMs > CACHE_TTL) {
                    fs.unlinkSync(filePath);
                    cleaned++;
                }
            }
            catch (error) {
                // Individual file error - continue with others
                Logger.debug(`Error checking file ${file}: ${error}`);
            }
        }
        if (cleaned > 0) {
            Logger.debug(`Cleaned ${cleaned} expired cache files`);
        }
    }
    catch (error) {
        // Non-critical, just log
        Logger.debug(`Cache cleanup error: ${error}`);
    }
}
// maximum file count limit (FIFO) --> LRU?
function enforceFileLimits() {
    try {
        const files = fs.readdirSync(CACHE_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => ({
            name: f,
            path: path.join(CACHE_DIR, f),
            mtime: fs.statSync(path.join(CACHE_DIR, f)).mtimeMs
        }))
            .sort((a, b) => a.mtime - b.mtime); // Oldest first
        // Remove oldest files if over limit
        if (files.length > MAX_CACHE_FILES) {
            const toRemove = files.slice(0, files.length - MAX_CACHE_FILES);
            for (const file of toRemove) {
                try {
                    fs.unlinkSync(file.path);
                }
                catch { }
            }
            Logger.debug(`Removed ${toRemove.length} old cache files to enforce limit`);
        }
    }
    catch (error) {
        Logger.debug(`Error enforcing file limits: ${error}`);
    }
}
export function getCacheStats() {
    ensureCacheDir();
    let size = 0;
    try {
        const files = fs.readdirSync(CACHE_DIR);
        size = files.filter(f => f.endsWith('.json')).length;
    }
    catch { }
    return {
        size,
        ttl: CACHE_TTL,
        maxSize: MAX_CACHE_FILES,
        cacheDir: CACHE_DIR
    };
}
export function clearCache() {
    try {
        ensureCacheDir();
        const files = fs.readdirSync(CACHE_DIR);
        for (const file of files) {
            if (file.endsWith('.json')) {
                fs.unlinkSync(path.join(CACHE_DIR, file));
            }
        }
        Logger.debug('Cache emptied');
    }
    catch (error) {
        Logger.error(`Failed to empty cache: ${error}`);
    }
}
//# sourceMappingURL=chunkCache.js.map