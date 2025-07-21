#!/bin/bash

set -e

echo "🚀 Setting up your contribution environment..."

# Function to install missing dependencies
install_dependency() {
  local dep=$1
  local install_cmd=$2
  
  echo "📥 Installing $dep..."
  if command -v brew &> /dev/null; then
    brew install "$install_cmd"
  elif command -v apt-get &> /dev/null; then
    sudo apt-get update && sudo apt-get install -y "$install_cmd"
  elif command -v yum &> /dev/null; then
    sudo yum install -y "$install_cmd"
  elif command -v winget &> /dev/null; then
    winget install "$install_cmd"
  else
    echo "❌ Cannot auto-install $dep. Please install manually from: https://docs.github.com/en/github-cli/github-cli/about-github-cli"
    exit 1
  fi
}

# Check and install dependencies
echo "🔍 Checking dependencies..."

if ! command -v git &> /dev/null; then
  echo "⚠️  Git not found, attempting to install..."
  install_dependency "Git" "git"
fi

if ! command -v node &> /dev/null; then
  echo "⚠️  Node.js not found, attempting to install..."
  install_dependency "Node.js" "node"
fi

if ! command -v gh &> /dev/null; then
  echo "⚠️  GitHub CLI not found, attempting to install..."
  install_dependency "GitHub CLI" "gh"
fi

echo "✅ All dependencies ready!"

if ! gh auth status &> /dev/null; then
  echo "🔐 Please authenticate with GitHub first:"
  gh auth login
fi

echo "🍴 Forking repository..."
gh repo fork jamubc/gemini-mcp-tool --clone=false

echo "📥 Cloning your fork..."
GITHUB_USER=$(gh api user --jq .login)
git clone https://github.com/$GITHUB_USER/gemini-mcp-tool.git gemini-mcp-tool-contrib
cd gemini-mcp-tool-contrib

echo "🔗 Setting up upstream remote..."
git remote add upstream https://github.com/jamubc/gemini-mcp-tool.git

echo "📦 Installing dependencies..."
npm install

echo "✅ Setup complete!"
echo ""
echo "📁 Your contribution workspace: gemini-mcp-tool-contrib/"
echo "🌟 Next steps:"
echo "   cd gemini-mcp-tool-contrib"
echo "   ./contribution/branch.sh your-feature-name"
echo ""
echo "   ./contribution/submit.sh"