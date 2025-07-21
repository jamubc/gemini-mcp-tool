#!/bin/bash
# Auto-format code before submission

echo "🎨 Formatting code..."

# Check if prettier is available
if command -v npx &> /dev/null && npx prettier --version &> /dev/null 2>&1; then
  echo "✨ Running Prettier..."
  npx prettier --write "src/**/*.{js,ts,json}" "*.{js,ts,json,md}" 2>/dev/null || echo "⚠️  Some files couldn't be formatted"
else
  echo "ℹ️  Prettier not available, skipping formatting"
fi

# Check if there's a package.json lint script
if [ -f "package.json" ] && grep -q '"lint"' package.json; then
  echo "🔍 Running linter..."
  npm run lint --silent 2>/dev/null || echo "⚠️  Linting had warnings"
fi

echo "✅ Code formatting complete!"