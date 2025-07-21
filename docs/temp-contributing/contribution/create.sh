#!/bin/bash
# Create a new contribution from template

echo "🎨 Creating contribution from template..."

# Show available templates
echo "Available templates:"
echo "1) new-tool     - Add a new MCP tool"
echo "2) bug-fix      - Fix a bug"
echo "3) docs         - Improve documentation"
echo "4) custom       - Start from scratch"

read -p "Choose template (1-4): " TEMPLATE_CHOICE

case $TEMPLATE_CHOICE in
  1)
    TEMPLATE_TYPE="new-tool"
    echo "🛠️  Creating new tool contribution..."
    ;;
  2)
    TEMPLATE_TYPE="bug-fix"
    echo "🐛 Creating bug fix contribution..."
    ;;
  3)
    TEMPLATE_TYPE="docs"
    echo "📚 Creating documentation contribution..."
    ;;
  4)
    TEMPLATE_TYPE="custom"
    echo "🎯 Creating custom contribution..."
    ;;
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

# Get feature name
read -p "Enter feature name (e.g., 'calculator-tool', 'fix-memory-leak'): " FEATURE_NAME

# Create branch
./contribution/branch.sh "$FEATURE_NAME"

# Copy template files
if [ "$TEMPLATE_TYPE" = "new-tool" ]; then
  echo "📋 Setting up new tool template..."
  
  read -p "Tool name (e.g., calculator): " TOOL_NAME
  read -p "Tool description: " TOOL_DESC
  
  # Create tool file
  cp contribution/templates/new-tool.js "src/${TOOL_NAME}-tool.js"
  
  # Replace placeholders
  sed -i "" "s/{{TOOL_NAME}}/$TOOL_NAME/g" "src/${TOOL_NAME}-tool.js"
  sed -i "" "s/{{DESCRIPTION}}/$TOOL_DESC/g" "src/${TOOL_NAME}-tool.js"
  
  echo "✅ Created: src/${TOOL_NAME}-tool.js"
  echo "📝 Edit the file to implement your tool logic"
  
elif [ "$TEMPLATE_TYPE" = "bug-fix" ] || [ "$TEMPLATE_TYPE" = "docs" ]; then
  # Copy markdown template
  TEMPLATE_FILE="bug-fix"
  [ "$TEMPLATE_TYPE" = "docs" ] && TEMPLATE_FILE="docs-improvement"
  
  cp "contribution/templates/${TEMPLATE_FILE}.md" "CONTRIBUTION_NOTES.md"
  echo "✅ Created: CONTRIBUTION_NOTES.md"
  echo "📝 Fill out the template with details about your contribution"
fi

echo ""
echo "🎉 Template ready!"
echo "Next steps:"
echo "1. Make your changes"
echo "2. Test with: ./contribution/test.sh"
echo "3. Submit with: ./contribution/submit.sh"