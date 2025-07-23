function estimateEditSize(edit) {
    const jsonOverhead = 250;
    const contentSize = edit.filename.length * 2 + edit.oldCode.length + edit.newCode.length;
    return jsonOverhead + contentSize;
}
function groupEditsByFile(edits) {
    const groups = new Map();
    for (const edit of edits) {
        const fileEdits = groups.get(edit.filename) || [];
        fileEdits.push(edit);
        groups.set(edit.filename, fileEdits);
    }
    return groups;
}
export function chunkChangeModeEdits(edits, maxCharsPerChunk = 20000) {
    if (edits.length === 0) {
        return [{
                edits: [],
                chunkIndex: 1,
                totalChunks: 1,
                hasMore: false,
                estimatedChars: 0
            }];
    }
    const chunks = [];
    const fileGroups = groupEditsByFile(edits);
    let currentChunk = [];
    let currentSize = 0;
    for (const [filename, fileEdits] of fileGroups) {
        const fileSize = fileEdits.reduce((sum, edit) => sum + estimateEditSize(edit), 0);
        if (fileSize > maxCharsPerChunk) {
            if (currentChunk.length > 0) {
                chunks.push(createChunk(currentChunk, chunks.length + 1, 0, currentSize));
                currentChunk = [];
                currentSize = 0;
            }
            for (const edit of fileEdits) {
                const editSize = estimateEditSize(edit);
                if (currentSize + editSize > maxCharsPerChunk && currentChunk.length > 0) {
                    chunks.push(createChunk(currentChunk, chunks.length + 1, 0, currentSize));
                    currentChunk = [];
                    currentSize = 0;
                }
                currentChunk.push(edit);
                currentSize += editSize;
            }
        }
        else {
            if (currentSize + fileSize > maxCharsPerChunk && currentChunk.length > 0) {
                chunks.push(createChunk(currentChunk, chunks.length + 1, 0, currentSize));
                currentChunk = [];
                currentSize = 0;
            }
            currentChunk.push(...fileEdits);
            currentSize += fileSize;
        }
    }
    if (currentChunk.length > 0) {
        chunks.push(createChunk(currentChunk, chunks.length + 1, 0, currentSize));
    }
    const totalChunks = chunks.length;
    return chunks.map((chunk, index) => ({
        ...chunk,
        totalChunks,
        hasMore: index < totalChunks - 1
    }));
}
function createChunk(edits, chunkIndex, totalChunks, estimatedChars) {
    return {
        edits,
        chunkIndex,
        totalChunks,
        hasMore: false,
        estimatedChars
    };
}
export function summarizeChunking(chunks) {
    const totalEdits = chunks.reduce((sum, chunk) => sum + chunk.edits.length, 0);
    const totalChars = chunks.reduce((sum, chunk) => sum + chunk.estimatedChars, 0);
    return `Chunking Summary:
# edits: ${totalEdits}
# chunks: ${chunks.length}
est chars: ${totalChars.toLocaleString()}
mean size: ${Math.round(totalChars / chunks.length).toLocaleString()} chars

Chunks:
${chunks.map(chunk => `  Chunk ${chunk.chunkIndex}: ${chunk.edits.length} edits, ~${chunk.estimatedChars.toLocaleString()} chars`).join('\n')}`;
}
//# sourceMappingURL=changeModeChunker.js.map