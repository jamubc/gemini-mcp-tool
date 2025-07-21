#!/bin/bash

if [ -z "$1" ]; then
  echo "❌ Please provide a feature name"
  echo "Usage: ./contribution/branch.sh your-feature-name"
  echo "Example: ./contribution/branch.sh add-new-tool"
  exit 1
fi

FEATURE_NAME="$1"
BRANCH_NAME="feature/$FEATURE_NAME"

echo "🌿 Creating feature branch: $BRANCH_NAME"

git checkout main
git pull upstream main

git checkout -b "$BRANCH_NAME"

echo "✅ Ready to work on: $BRANCH_NAME"
echo "🛠️  Make your changes, then run: ./contribution/submit.sh"