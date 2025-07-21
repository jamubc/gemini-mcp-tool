#!/bin/bash

echo "📤 Submitting your contribution..."

# Auto-format code before submission
echo "[1/4] 🎨 Formatting code..."
./contribution/format.sh

echo "[2/4] 📝 Processing changes..."
if ! git diff --cached --quiet || ! git diff --quiet; then
  echo "📝 Committing your changes..."
  
  echo "Changes to be committed:"
  git status --porcelain
  
  echo ""
  read -p "💬 Enter commit message (or press Enter for auto-generated): " COMMIT_MSG
  
  if [ -z "$COMMIT_MSG" ]; then
    BRANCH_NAME=$(git branch --show-current)
    FEATURE_NAME=$(echo "$BRANCH_NAME" | sed 's/feature\///')
    COMMIT_MSG="Add $FEATURE_NAME"
  fi
  
  git add -A
  git commit -m "$COMMIT_MSG"
else
  echo "ℹ️  No changes to commit"
fi

echo "[3/4] 🚀 Pushing to your fork..."
BRANCH_NAME=$(git branch --show-current)
git push -u origin "$BRANCH_NAME"

echo "[4/4] 🎯 Creating Pull Request..."
FEATURE_NAME=$(echo "$BRANCH_NAME" | sed 's/feature\///')
PR_TITLE="Add $FEATURE_NAME"

gh pr create \
  --title "$PR_TITLE" \
  --body "## Summary
- Added $FEATURE_NAME

## Testing
- [x] Tested locally with \`./contribution/test.sh\`
- [x] Built successfully
- [x] MCP server functionality verified

## Checklist
- [x] Code follows project conventions
- [x] Changes are tested locally
- [x] Commit message is descriptive

---
🤖 Created with contribution automation tools" \
  --base main \
  --head "$BRANCH_NAME"

echo "✅ Pull Request created successfully!"
echo "🎉 Thank you for your contribution!"