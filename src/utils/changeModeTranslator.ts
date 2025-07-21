import { ChangeModeEdit } from './changeModeParser.js';
export function formatChangeModeResponse(
  edits: ChangeModeEdit[],
  chunkInfo?: { current: number; total: number; cacheKey?: string }
): string {
  const header = chunkInfo && chunkInfo.total > 1 
    ? `[CHANGEMODE OUTPUT - Chunk ${chunkInfo.current} of ${chunkInfo.total}]

Gemini has analyzed your codebase and generated edits across ${chunkInfo.total} chunks.
This chunk contains ${edits.length} complete edit${edits.length === 1 ? '' : 's'} that can be applied independently.

Each chunk contains self-contained edits grouped by file. You can safely apply these edits
before fetching the next chunk.

`
    : `[CHANGEMODE OUTPUT - Gemini has analyzed the files and provided these edits]

I have prepared ${edits.length} modification${edits.length === 1 ? '' : 's'} for your codebase.

IMPORTANT: Apply these edits directly WITHOUT reading the files first. The edits below contain exact text matches from the current file contents.

`;

  const instructions = edits.map((edit, index) => {
    return `### Edit ${index + 1}: ${edit.filename}

Replace this exact text:
\`\`\`
${edit.oldCode}
\`\`\`

With this text:
\`\`\`
${edit.newCode}
\`\`\`
`;
  }).join('\n');

  let footer = `
---
Apply these edits in order. Each edit uses exact string matching, so the old_str must match exactly what appears between the code blocks.`;
  if (chunkInfo && chunkInfo.current < chunkInfo.total && chunkInfo.cacheKey) {
    footer += `

---
**Next Step**: After applying the edits above, retrieve the next chunk (${chunkInfo.current + 1} of ${chunkInfo.total}) using:

\`\`\`
fetch-chunk cacheKey="${chunkInfo.cacheKey}" chunkIndex=${chunkInfo.current + 1}
\`\`\`

There ${chunkInfo.total - chunkInfo.current === 1 ? 'is' : 'are'} ${chunkInfo.total - chunkInfo.current} more chunk${chunkInfo.total - chunkInfo.current === 1 ? '' : 's'} containing additional edits.

**CONTINUE**: You are working on a multi-chunk changeMode response. After applying these edits, fetch the next chunk to continue with the remaining modifications.`;
  }
  return header + instructions + footer;
}


export function summarizeChangeModeEdits(edits: ChangeModeEdit[], isPartialView?: boolean): string { // for user
  const fileGroups = new Map<string, number>();
  // Count edits per file
  for (const edit of edits) {
    fileGroups.set(edit.filename, (fileGroups.get(edit.filename) || 0) + 1);
  }
  const summary = Array.from(fileGroups.entries())
    .map(([file, count]) => `- ${file}: ${count} edit${count === 1 ? '' : 's'}`)
    .join('\n');
  const title = isPartialView 
    ? `ChangeMode Summary (Complete analysis across all chunks):`
    : `ChangeMode Summary:`;
  return `${title}
Total edits: ${edits.length}${isPartialView ? ' (across all chunks)' : ''}
Files affected: ${fileGroups.size}

${summary}`;
}