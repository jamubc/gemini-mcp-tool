#!/bin/bash

echo "=== TESTING FILE-BASED CHUNK CACHE ==="
echo
echo "This test simulates the real MCP changeMode workflow:"
echo "1. Process 1: Cache chunks from large Gemini response"
echo "2. Process 1 exits (MCP server terminates)"
echo "3. Process 2: Retrieve chunks using cache key (new MCP server)"
echo
echo "Press Enter to start..."
read

# Run first process
echo ">>> Running Process 1 (initial changeMode request)..."
node test-cache-write.js

# Extract cache key from output
echo
echo ">>> Process 1 has exited. Simulating MCP server restart..."
echo ">>> Enter the cache key from above: "
read CACHE_KEY

# Run second process
echo
echo ">>> Running Process 2 (continuation request)..."
node test-cache-read.js "$CACHE_KEY"

echo
echo "=== TEST COMPLETE ==="