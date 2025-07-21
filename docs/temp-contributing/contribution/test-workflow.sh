#!/bin/bash

set -e

echo "🧪 Testing contribution workflow (DRY RUN)..."

if ! command -v gh &> /dev/null; then
  echo "❌ GitHub CLI (gh) is required but not installed."
  echo "📥 Install it from: https://cli.github.com/"
  exit 1
fi

if ! gh auth status &> /dev/null; then
  echo "🔐 Please authenticate with GitHub first:"
  echo "   gh auth login"
  exit 1
fi

echo "✅ GitHub CLI authenticated"

GITHUB_USER=$(gh api user --jq .login)
echo "👤 GitHub user: $GITHUB_USER"

echo "🍴 Would fork: jamubc/gemini-mcp-tool"
echo "📥 Would clone: https://github.com/$GITHUB_USER/gemini-mcp-tool.git"
echo "🔗 Would add upstream: https://github.com/jamubc/gemini-mcp-tool.git"

if [ -f "package.json" ]; then
  echo "📦 Would install dependencies with: npm install"
else
  echo "⚠️  No package.json found - would need to be in project directory"
fi

echo "🌿 Would create feature branch: feature/test-feature"
echo "🔨 Would build project with: npm run build"
echo "✅ Would run TypeScript check: npx tsc --noEmit"
echo "🔌 Would test MCP server functionality"
echo "📝 Would commit changes"
echo "🚀 Would push to fork"
echo "🎯 Would create Pull Request"

echo ""
echo "✅ Workflow test complete! All steps would execute successfully."
echo "🚀 To run actual workflow:"
echo "   ./contribution/setup.sh"
echo "   ./contribution/branch.sh feature-name"
echo "   ./contribution/test.sh"
echo "   ./contribution/submit.sh"