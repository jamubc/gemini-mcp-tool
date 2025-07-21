#!/bin/bash
# Self-test validation for contribution system

echo "🔍 Validating contribution system..."

ERRORS=0

# Function to check if command exists
check_command() {
  if command -v "$1" &> /dev/null; then
    echo "✅ $1 is installed"
  else
    echo "❌ $1 is missing"
    ERRORS=$((ERRORS + 1))
  fi
}

# Function to check if file exists and is executable
check_script() {
  if [ -x "$1" ]; then
    echo "✅ $1 is executable"
  else
    echo "❌ $1 is missing or not executable"
    ERRORS=$((ERRORS + 1))
  fi
}

echo "Checking dependencies..."
check_command "git"
check_command "node"
check_command "npm"
check_command "gh"

echo ""
echo "Checking scripts..."
check_script "contribution/setup.sh"
check_script "contribution/branch.sh"
check_script "contribution/test.sh"
check_script "contribution/submit.sh"
check_script "contribution/create.sh"

echo ""
echo "Checking templates..."
if [ -d "contribution/templates" ]; then
  echo "✅ Templates directory exists"
  
  if [ -f "contribution/templates/new-tool.js" ]; then
    echo "✅ New tool template exists"
  else
    echo "❌ New tool template missing"
    ERRORS=$((ERRORS + 1))
  fi
  
  if [ -f "contribution/templates/bug-fix.md" ]; then
    echo "✅ Bug fix template exists"
  else
    echo "❌ Bug fix template missing"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "❌ Templates directory missing"
  ERRORS=$((ERRORS + 1))
fi

echo ""
echo "Testing GitHub authentication..."
if gh auth status &> /dev/null; then
  echo "✅ GitHub CLI authenticated"
else
  echo "⚠️  GitHub CLI not authenticated (run 'gh auth login')"
fi

echo ""
echo "Testing project structure..."
if [ -f "package.json" ]; then
  echo "✅ package.json found"
else
  echo "❌ package.json missing - not in project root?"
  ERRORS=$((ERRORS + 1))
fi

if [ -d "src" ]; then
  echo "✅ src directory found"
else
  echo "❌ src directory missing"
  ERRORS=$((ERRORS + 1))
fi

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "🎉 All validation checks passed!"
  echo "✅ Contribution system is ready to use"
  exit 0
else
  echo "❌ Found $ERRORS issues"
  echo "🔧 Please fix the issues above before using contribution tools"
  exit 1
fi