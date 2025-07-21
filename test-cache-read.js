#!/usr/bin/env node

// Part 2: Simulate second MCP call - retrieve cached chunks from disk
import { getChunks, getCacheStats } from './dist/utils/chunkCache.js';

console.log('=== PROCESS 2: NEW MCP Server (Continuation Request) ===\n');

// This is the cache key from the previous run
const cacheKey = process.argv[2];

if (!cacheKey) {
  console.error('Usage: node test-cache-read.js <cacheKey>');
  console.error('Run test-cache-write.js first to get a cache key');
  process.exit(1);
}

console.log(`1. User requested chunk 2 with cache key: ${cacheKey}`);
console.log('   (This is a completely new MCP server process)');

// Check cache stats
const stats = getCacheStats();
console.log(`\n2. Checking cache at: ${stats.cacheDir}`);
console.log(`   Files in cache: ${stats.size}`);

// Try to retrieve chunks
console.log('\n3. Attempting to retrieve cached chunks...');
const chunks = getChunks(cacheKey);

if (chunks === null) {
  console.error('\n❌ CACHE MISS! Chunks not found.');
  console.error('   This means the cache did not survive the restart.');
  console.error('   The file-based cache implementation has failed.');
  process.exit(1);
}

console.log(`\n✅ SUCCESS! Retrieved ${chunks.length} chunks from disk cache.`);
console.log('\n4. Chunk details:');
chunks.forEach((chunk, i) => {
  console.log(`   Chunk ${i + 1}: ${chunk.edits.length} edits, ~${chunk.estimatedChars.toLocaleString()} chars`);
});

// Simulate returning chunk 2
const requestedChunkIndex = 2;
if (requestedChunkIndex <= chunks.length) {
  const chunk = chunks[requestedChunkIndex - 1];
  console.log(`\n5. Returning chunk ${requestedChunkIndex} to Claude:`);
  console.log(`   Contains ${chunk.edits.length} edits for files:`);
  const files = [...new Set(chunk.edits.map(e => e.filename))];
  files.forEach(f => console.log(`   - ${f}`));
  
  if (chunk.hasMore) {
    console.log(`\n6. More chunks available. Next request would be:`);
    console.log(`   fetch-chunk cacheKey="${cacheKey}" chunkIndex=${requestedChunkIndex + 1}`);
  }
}

console.log('\n=== FILE-BASED CACHE WORKS! Chunks survived MCP restart ===');