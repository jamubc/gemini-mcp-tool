#!/bin/bash
# Rollback/undo contribution changes

echo "🔄 Contribution rollback utility..."

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

if [[ "$CURRENT_BRANCH" != feature/* ]]; then
  echo "❌ Not on a feature branch. Rollback only works on feature branches."
  echo "Current branch: $CURRENT_BRANCH"
  exit 1
fi

echo "Current branch: $CURRENT_BRANCH"
echo ""
echo "Rollback options:"
echo "1) Discard uncommitted changes"
echo "2) Remove last commit (keep changes)"
echo "3) Remove last commit (discard changes)"
echo "4) Delete feature branch and return to main"
echo "5) Cancel"

read -p "Choose option (1-5): " ROLLBACK_CHOICE

case $ROLLBACK_CHOICE in
  1)
    echo "🗑️  Discarding uncommitted changes..."
    git checkout -- .
    git clean -fd
    echo "✅ Uncommitted changes discarded"
    ;;
  2)
    echo "⏪ Removing last commit (keeping changes)..."
    git reset --soft HEAD~1
    echo "✅ Last commit removed, changes kept in staging"
    ;;
  3)
    echo "🗑️  Removing last commit and changes..."
    git reset --hard HEAD~1
    echo "✅ Last commit and changes removed"
    ;;
  4)
    echo "🚨 This will delete the entire feature branch!"
    read -p "Are you sure? (y/N): " CONFIRM
    if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
      echo "🔄 Returning to main branch..."
      git checkout main
      echo "🗑️  Deleting feature branch: $CURRENT_BRANCH"
      git branch -D "$CURRENT_BRANCH"
      echo "✅ Feature branch deleted"
    else
      echo "❌ Cancelled"
    fi
    ;;
  5)
    echo "❌ Cancelled"
    ;;
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "🎯 Rollback complete!"