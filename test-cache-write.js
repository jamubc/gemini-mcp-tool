#!/usr/bin/env node

// Part 1: Simulate first MCP call - cache chunks and exit
import { cacheChunks, getCacheStats } from './dist/utils/chunkCache.js';

console.log('=== PROCESS 1: MCP Server (First Call) ===\n');

// Simulate parsed changeMode edits from Gemini
const testChunks = [
  {
    edits: [
      { filename: 'src/big-file.js', oldCode: 'function old1() {}', newCode: 'function new1() {}', startLine: 100, endLine: 105 },
      { filename: 'src/big-file.js', oldCode: 'const x = 1;', newCode: 'const x = 2;', startLine: 200, endLine: 200 }
    ],
    chunkIndex: 1,
    totalChunks: 3,
    hasMore: true,
    estimatedChars: 180000
  },
  {
    edits: [
      { filename: 'src/another-file.js', oldCode: 'class OldClass {}', newCode: 'class NewClass {}', startLine: 50, endLine: 75 },
      { filename: 'src/another-file.js', oldCode: 'export default OldClass;', newCode: 'export default NewClass;', startLine: 100, endLine: 100 }
    ],
    chunkIndex: 2,
    totalChunks: 3,
    hasMore: true,
    estimatedChars: 180000
  },
  {
    edits: [
      { filename: 'src/final-file.js', oldCode: '// old comment', newCode: '// new comment', startLine: 1, endLine: 1 }
    ],
    chunkIndex: 3,
    totalChunks: 3,
    hasMore: false,
    estimatedChars: 50000
  }
];

// This is what happens in processChangeModeOutput when chunks > 1
const originalPrompt = 'changeMode: true - analyze @src and refactor all functions';
console.log('1. Caching chunks from changeMode response...');
console.log(`   Original prompt: "${originalPrompt}"`);
console.log(`   Total chunks: ${testChunks.length}`);

const cacheKey = cacheChunks(originalPrompt, testChunks);
console.log(`\n2. Cache key generated: ${cacheKey}`);
console.log('   (This key will be sent to Claude in the response)');

// Show cache location
const stats = getCacheStats();
console.log(`\n3. Cache location: ${stats.cacheDir}`);
console.log(`   Files cached: ${stats.size}`);

console.log('\n4. Returning chunk 1 to Claude with instructions:');
console.log(`   "To get chunk 2 of 3, use: ask-gemini with changeMode: true, chunkIndex: 2, chunkCacheKey: "${cacheKey}"`);

console.log('\n=== PROCESS 1 EXITS (MCP server terminates) ===');
process.exit(0);