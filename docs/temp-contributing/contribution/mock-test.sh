#!/bin/bash
# Mock contribution to test the entire workflow

echo "🧪 Running mock contribution test..."

# Save current state
ORIGINAL_BRANCH=$(git branch --show-current)
echo "📌 Current branch: $ORIGINAL_BRANCH"

# Test branch creation
echo ""
echo "1️⃣ Testing branch creation..."
./contribution/branch.sh "test-mock-feature" || {
  echo "❌ Branch creation failed"
  exit 1
}

# Create a mock change
echo ""
echo "2️⃣ Creating mock change..."
echo "// Mock test file - safe to delete" > "mock-test-file.js"
echo "console.log('This is a test contribution');" >> "mock-test-file.js"

# Test the test script
echo ""
echo "3️⃣ Testing build and validation..."
./contribution/test.sh || {
  echo "❌ Test script failed"
  git checkout "$ORIGINAL_BRANCH"
  git branch -D "feature/test-mock-feature" 2>/dev/null
  exit 1
}

# Test commit (without actually pushing)
echo ""
echo "4️⃣ Testing commit process..."
git add mock-test-file.js
git commit -m "Add mock test file for contribution workflow validation"

echo ""
echo "5️⃣ Cleaning up mock test..."
# Remove mock file and commit
git reset --hard HEAD~1
rm -f mock-test-file.js

# Return to original branch
git checkout "$ORIGINAL_BRANCH"
git branch -D "feature/test-mock-feature"

echo ""
echo "🎉 Mock contribution test completed successfully!"
echo "✅ All contribution workflow components are working"
echo ""
echo "The contribution system is ready for real use!"