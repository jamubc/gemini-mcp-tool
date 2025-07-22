import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { getChunks } from '../utils/chunkCache.js';
import { formatChangeModeResponse, summarizeChangeModeEdits } from '../utils/changeModeTranslator.js';
import { Logger } from '../utils/logger.js';

const inputSchema = z.object({
  cacheKey: z.string().describe("The cache key provided in the initial changeMode response"),
  chunkIndex: z.number().min(1).describe("Which chunk to retrieve (1-based index)")
});

export const fetchChunkTool: UnifiedTool = {
  name: 'fetch-chunk',
  description: 'Retrieves cached chunks from a changeMode response. Use this to get subsequent chunks after receiving a partial changeMode response.',
  
  zodSchema: inputSchema,
  
  prompt: {
    description: 'Fetch the next chunk of a response',
    arguments: [
      {
        name: 'prompt',
        description: 'fetch-chunk cacheKey=<key> chunkIndex=<number>',
        required: true
      }
    ]
  },
  
  category: 'utility',
  
  execute: async (args: any, onProgress?: (newOutput: string) => void): Promise<string> => {
    const { cacheKey, chunkIndex } = args;
    
    Logger.toolInvocation('fetch-chunk', args);
    Logger.debug(`Fetching chunk ${chunkIndex} with cache key: ${cacheKey}`);
    
    // Retrieve cached chunks
    const chunks = getChunks(cacheKey);
    
    if (!chunks) {
      return `❌ Cache miss: No chunks found for cache key "${cacheKey}". 

  Possible reasons:
  1. The cache key is incorrect, Have you ran ask-gemini with changeMode enabled?
  2. The cache has expired (10 minute TTL)
  3. The MCP server was restarted and the file-based cache was cleared

Please re-run the original changeMode request to regenerate the chunks.`;
    }
    
    // Validate chunk index
    if (chunkIndex < 1 || chunkIndex > chunks.length) {
      return `❌ Invalid chunk index: ${chunkIndex}

Available chunks: 1 to ${chunks.length}
You requested: ${chunkIndex}

Please use a valid chunk index.`;
    }
    
    // Get the requested chunk
    const chunk = chunks[chunkIndex - 1];
    
    // Format the response
    let result = formatChangeModeResponse(
      chunk.edits,
      { current: chunkIndex, total: chunks.length, cacheKey }
    );
    
    // Add summary for first chunk
    if (chunkIndex === 1 && chunks.length > 1) {
      const allEdits = chunks.flatMap(c => c.edits);
      result = summarizeChangeModeEdits(allEdits, true) + '\n\n' + result;
    }
    
    Logger.debug(`Returning chunk ${chunkIndex} of ${chunks.length} with ${chunk.edits.length} edits`);
    
    return result;
  }
};