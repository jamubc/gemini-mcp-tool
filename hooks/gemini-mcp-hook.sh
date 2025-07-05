#!/bin/bash
# ABOUTME: Claude Code PreToolUse hook for gemini-mcp-tool
# This hook integrates with the TypeScript enhancement layer

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Read hook input from stdin
HOOK_INPUT=$(cat)

# Debug logging if enabled
if [ "$DEBUG_LEVEL" -ge "2" ] 2>/dev/null; then
  echo "[gemini-mcp-hook] Received tool call: $(echo "$HOOK_INPUT" | jq -r '.tool_name // "unknown"')" >&2
fi

# Extract tool name from input
TOOL_NAME=$(echo "$HOOK_INPUT" | jq -r '.tool_name // ""')

# Check if this is a tool we want to intercept
case "$TOOL_NAME" in
  "Read"|"Grep"|"Glob"|"Task")
    # These tools might benefit from Gemini delegation
    if [ "$DEBUG_LEVEL" -ge "2" ] 2>/dev/null; then
      echo "[gemini-mcp-hook] Intercepting $TOOL_NAME for potential enhancement" >&2
    fi
    
    # For now, pass through to allow TypeScript enhancements to work
    # Future: Could add pre-processing or delegation logic here
    echo "$HOOK_INPUT"
    exit 0
    ;;
  *)
    # Pass through other tools unchanged
    echo "$HOOK_INPUT"
    exit 0
    ;;
esac