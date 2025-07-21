import { ChangeModeEdit } from './changeModeParser.js';

export interface EditChunk {
  edits: ChangeModeEdit[];
  chunkIndex: number;
  totalChunks: number;
  hasMore: boolean;
  estimatedChars: number;
}

function estimateEditSize(edit: ChangeModeEdit): number {
  const jsonOverhead = 250; const contentSize = edit.filename.length * 2 + edit.oldCode.length + edit.newCode.length;
  return jsonOverhead + contentSize;
}

function groupEditsByFile(edits: ChangeModeEdit[]): Map<string, ChangeModeEdit[]> {
  const groups = new Map<string, ChangeModeEdit[]>();
  for (const edit of edits) {
    const fileEdits = groups.get(edit.filename) || [];
    fileEdits.push(edit);
    groups.set(edit.filename, fileEdits);
  }
  return groups;
}
export function chunkChangeModeEdits(
  edits: ChangeModeEdit[],
  maxCharsPerChunk: number = 20000
): EditChunk[] {
  if (edits.length === 0) {
    return [{
      edits: [],
      chunkIndex: 1,
      totalChunks: 1,
      hasMore: false,
      estimatedChars: 0
    }];
  }
  
  const chunks: EditChunk[] = [];
  const fileGroups = groupEditsByFile(edits);
  let currentChunk: ChangeModeEdit[] = [];
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
    } else {
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

function createChunk(
  edits: ChangeModeEdit[],
  chunkIndex: number,
  totalChunks: number,
  estimatedChars: number
): EditChunk {
  return {
    edits,
    chunkIndex,
    totalChunks,
    hasMore: false,
    estimatedChars
  };
}
export function summarizeChunking(chunks: EditChunk[]): string {
  const totalEdits = chunks.reduce((sum, chunk) => sum + chunk.edits.length, 0);
  const totalChars = chunks.reduce((sum, chunk) => sum + chunk.estimatedChars, 0);
  
  return `Chunking Summary:
# edits: ${totalEdits}
# chunks: ${chunks.length}
est chars: ${totalChars.toLocaleString()}
mean size: ${Math.round(totalChars / chunks.length).toLocaleString()} chars

Chunks:
${chunks.map(chunk => 
  `  Chunk ${chunk.chunkIndex}: ${chunk.edits.length} edits, ~${chunk.estimatedChars.toLocaleString()} chars`
).join('\n')}`;
}