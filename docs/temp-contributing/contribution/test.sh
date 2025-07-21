#!/bin/bash

echo "🧪 Testing your changes..."

echo "[1/4] 🔨 Building..."
npm run build

echo "[2/4] ✅ Checking TypeScript..."
npx tsc --noEmit

echo "[3/4] 🎨 Checking code format..."
./contribution/format.sh

echo "[4/4] 🔌 Testing MCP server..."
node dist/index.js --help > /dev/null && echo "✅ MCP server responds" || echo "❌ MCP server test failed"

echo "✅ All tests passed!"
echo "📤 Ready to submit? Run: ./contribution/submit.sh"