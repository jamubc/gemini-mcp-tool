import {
  StandardizedResponseSections
} from "../interfaces.js"; // Import enhanced interfaces

/**
 * Format final response with structured sections and chunking
 */
export function formatStructuredResponse(sections: StandardizedResponseSections): string {
  let fullResponse = `## Analysis\n${sections.analysis}\n\n## Suggested Changes\n${sections.changesSuggested}\n\n## Next Steps\n${sections.nextSteps}`;
  
  // Optimize large OLD sections
  fullResponse = optimizeLargeOldSections(fullResponse);
  
  // Check if chunking is needed
  if (fullResponse.length > 25000) {
    const chunks = chunkLargeEdits(fullResponse);
    if (chunks.length > 1) {
      // Return first chunk with continuation info
      return `${chunks[0]}\n\n---\n\n**📄 Large Response Detected:** This response was split into ${chunks.length} parts to avoid token limits. Use the tool again to get the next batch of edits.\n\n**💡 Tip:** For very large changes, consider asking Gemini to focus on specific sections or functions.`;
    }
  }
  
  return fullResponse;
}

/**
 * Optimize large OLD sections for readability
 */
export function optimizeLargeOldSections(result: string): string {
  // For OLD sections > 50 lines, show first/last 10 lines with [...] in middle
  return result.replace(/OLD:\n```[\s\S]*?\n([\s\S]{1000,}?)\n```/g, (match, content) => {
    const lines = content.split('\n');
    if (lines.length > 50) {
      const first10 = lines.slice(0, 10).join('\n');
      const last10 = lines.slice(-10).join('\n');
      return match.replace(content, `${first10}\n\n[... ${lines.length - 20} lines omitted for brevity ...]\n\n${last10}`);
    }
    return match;
  });
}

/**
 * Intelligent chunking for large edit responses
 */
export function chunkLargeEdits(result: string): string[] {
  const chunks: string[] = [];
  const maxChunkSize = 20000; // ~5k tokens per chunk
  
  // If small enough, return as single chunk
  if (result.length <= maxChunkSize) {
    return [result];
  }
  
  // Split by logical edit boundaries - keep OLD/NEW pairs together
  const sections = result.split(/(?=\n## |\n\*\*File:)/);
  let currentChunk = '';
  let chunkNumber = 1;
  
  for (const section of sections) {
    if ((currentChunk + section).length > maxChunkSize && currentChunk) {
      // Add chunk header and close current chunk
      chunks.push(`## Edit Batch ${chunkNumber}/${Math.ceil(result.length / maxChunkSize)}\n\n${currentChunk}`);
      currentChunk = section;
      chunkNumber++;
    } else {
      currentChunk += section;
    }
  }
  
  // Add final chunk
  if (currentChunk) {
    chunks.push(`## Edit Batch ${chunkNumber}/${Math.ceil(result.length / maxChunkSize)}\n\n${currentChunk}`);
  }
  
  return chunks;
}