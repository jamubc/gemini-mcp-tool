#!/bin/bash
# Local project hook installer for gemini-mcp-tool
# Run this script from any project directory to set up local hooks

echo "🚀 gemini-mcp-tool Local Hook Installer"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Global variables
CURRENT_DIR="$(pwd)"
CLAUDE_SETTINGS_FILE="$CURRENT_DIR/.claude/settings.json"
HOOKS_DIR="$CURRENT_DIR/.gemini-mcp-hooks"
BACKUP_SUFFIX=$(date +%Y%m%d_%H%M%S)

# Log function
log() {
    local level="$1"
    local message="$2"
    
    case $level in
        "info") echo -e "${GREEN}✅${NC} $message" ;;
        "warn") echo -e "${YELLOW}⚠️${NC}  $message" ;;
        "error") echo -e "${RED}❌${NC} $message" ;;
        "debug") echo -e "${BLUE}🔍${NC} $message" ;;
    esac
}

# Error handling
error_exit() {
    log "error" "$1"
    echo ""
    echo "💥 Installation aborted!"
    exit 1
}

# Check prerequisites
check_requirements() {
    log "info" "Checking prerequisites..."
    
    # jq for JSON processing
    if ! command -v jq &> /dev/null; then
        log "warn" "jq not found. Install with:"
        echo "  macOS: brew install jq"
        echo "  Linux: sudo apt-get install jq"
        error_exit "jq is required for JSON processing"
    fi
    log "debug" "jq found: $(which jq)"
    
    log "info" "All prerequisites met"
}

# Auto-detect gemini-mcp-tool installation
find_gemini_mcp_tool() {
    log "info" "Locating gemini-mcp-tool installation..." >&2
    
    # Common locations to check
    local search_paths=(
        "$HOME/Documents/GitHub/gemini-mcp-tool"
        "$HOME/Documents/gemini-mcp-tool"
        "$HOME/gemini-mcp-tool"
        "$HOME/Projects/gemini-mcp-tool"
        "$HOME/Code/gemini-mcp-tool"
        "/opt/gemini-mcp-tool"
        "/usr/local/gemini-mcp-tool"
    )
    
    for path in "${search_paths[@]}"; do
        if [ -f "$path/package.json" ] && grep -q "gemini-mcp-tool" "$path/package.json" 2>/dev/null; then
            log "debug" "Found gemini-mcp-tool at: $path" >&2
            echo "$path"
            return 0
        fi
    done
    
    # Not found in common locations
    log "warn" "gemini-mcp-tool not found in common locations" >&2
    echo "" >&2
    echo "Please provide the path to your gemini-mcp-tool installation:" >&2
    read -p "Path: " user_path
    
    if [ -f "$user_path/package.json" ] && grep -q "gemini-mcp-tool" "$user_path/package.json" 2>/dev/null; then
        log "debug" "Using user-provided path: $user_path" >&2
        echo "$user_path"
        return 0
    else
        error_exit "Invalid gemini-mcp-tool path: $user_path"
    fi
}

# Create local hook infrastructure
create_hook_infrastructure() {
    local gemini_tool_path="$1"
    
    log "info" "Creating local hook infrastructure..."
    
    # Create hooks directory
    mkdir -p "$HOOKS_DIR"
    
    # Create local router script
    cat > "$HOOKS_DIR/router.sh" << EOF
#!/bin/bash
# Local hook router for gemini-mcp-tool
# This script routes hook calls to the global gemini-mcp-tool installation

# Configuration
GEMINI_TOOL_PATH="$gemini_tool_path"
CONFIG_FILE="\$(dirname "\$0")/config.json"

# Read hook input from stdin
HOOK_INPUT=\$(cat)

# Debug logging if enabled
if [ "\$DEBUG_LEVEL" -ge "2" ] 2>/dev/null; then
    echo "[local-hook-router] Project: $CURRENT_DIR" >&2
    echo "[local-hook-router] Tool: \$(echo "\$HOOK_INPUT" | jq -r '.tool_name // "unknown"')" >&2
fi

# Load local configuration if exists
if [ -f "\$CONFIG_FILE" ]; then
    source <(jq -r 'to_entries[] | "export " + .key + "=" + (.value | @sh)' "\$CONFIG_FILE" 2>/dev/null || true)
fi

# Set project-specific environment
export GEMINI_MCP_PROJECT_DIR="$CURRENT_DIR"
export GEMINI_MCP_HOOKS_DIR="$HOOKS_DIR"

# Route to global gemini-mcp-tool hook handler
if [ -f "\$GEMINI_TOOL_PATH/hooks/gemini-mcp-hook.sh" ]; then
    echo "\$HOOK_INPUT" | "\$GEMINI_TOOL_PATH/hooks/gemini-mcp-hook.sh"
elif [ -f "\$GEMINI_TOOL_PATH/hooks/deterministic-router.sh" ]; then
    echo "\$HOOK_INPUT" | "\$GEMINI_TOOL_PATH/hooks/deterministic-router.sh"
else
    # Fallback: basic pass-through
    echo "\$HOOK_INPUT"
fi
EOF
    
    # Make router script executable
    chmod +x "$HOOKS_DIR/router.sh"
    
    # Create local configuration
    cat > "$HOOKS_DIR/config.json" << EOF
{
  "project_dir": "$CURRENT_DIR",
  "gemini_tool_path": "$gemini_tool_path",
  "cache_enabled": true,
  "security_enabled": true,
  "performance_enabled": true,
  "debug_level": 1
}
EOF
    
    log "info" "Hook infrastructure created at: $HOOKS_DIR"
}

# Configure local Claude hooks
configure_local_hooks() {
    log "info" "Configuring local Claude hooks..."
    
    # Create .claude directory
    mkdir -p "$(dirname "$CLAUDE_SETTINGS_FILE")"
    
    # Backup existing settings
    if [ -f "$CLAUDE_SETTINGS_FILE" ]; then
        cp "$CLAUDE_SETTINGS_FILE" "${CLAUDE_SETTINGS_FILE}.backup.${BACKUP_SUFFIX}"
        log "info" "Backup created: ${CLAUDE_SETTINGS_FILE}.backup.${BACKUP_SUFFIX}"
    fi
    
    # Hook configuration
    local hook_command="$HOOKS_DIR/router.sh"
    local hook_matcher="mcp__gemini-cli__.*"
    
    # Create or update settings
    if [ -f "$CLAUDE_SETTINGS_FILE" ]; then
        log "debug" "Updating existing local settings..."
        
        # Check for existing gemini-mcp hooks
        if grep -q "gemini-mcp" "$CLAUDE_SETTINGS_FILE" 2>/dev/null; then
            log "warn" "Existing gemini-mcp hooks found in local settings"
            read -p "Update existing hooks? (y/N): " update_hooks
            
            if [[ "$update_hooks" =~ ^[Yy]$ ]]; then
                # Update existing hooks
                local updated_config=$(jq --arg cmd "$hook_command" --arg matcher "$hook_matcher" '
                    .hooks.PreToolUse = (.hooks.PreToolUse // []) | 
                    .hooks.PreToolUse |= map(
                        if .hooks[]?.command? and (.hooks[]?.command | contains("gemini-mcp"))
                        then (.hooks[0].command = $cmd | .matcher = $matcher)
                        else . end
                    )' "$CLAUDE_SETTINGS_FILE" 2>/dev/null)
                
                if [ $? -eq 0 ] && [ -n "$updated_config" ]; then
                    echo "$updated_config" > "$CLAUDE_SETTINGS_FILE"
                    log "info" "Updated existing hooks"
                else
                    error_exit "Failed to update existing hooks"
                fi
            else
                log "info" "Keeping existing hooks"
                return 0
            fi
        else
            # Add to existing settings
            local merged_config=$(jq --arg cmd "$hook_command" --arg matcher "$hook_matcher" '
                .hooks.PreToolUse = (.hooks.PreToolUse // []) + [{
                    "matcher": $matcher,
                    "hooks": [{
                        "type": "command",
                        "command": $cmd
                    }]
                }]' "$CLAUDE_SETTINGS_FILE" 2>/dev/null)
            
            if [ $? -eq 0 ] && [ -n "$merged_config" ]; then
                echo "$merged_config" > "$CLAUDE_SETTINGS_FILE"
                log "info" "Added hooks to existing settings"
            else
                error_exit "Failed to merge hook configuration"
            fi
        fi
    else
        # Create new settings file
        log "debug" "Creating new local settings file..."
        cat > "$CLAUDE_SETTINGS_FILE" << EOF
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "$hook_matcher",
        "hooks": [
          {
            "type": "command",
            "command": "$hook_command"
          }
        ]
      }
    ]
  }
}
EOF
        log "info" "Created new local Claude settings"
    fi
    
    log "debug" "Hook configured: $hook_command"
}

# Create .gitignore entries
create_gitignore_entries() {
    log "info" "Updating .gitignore..."
    
    local gitignore_file="$CURRENT_DIR/.gitignore"
    local entries=(
        "# gemini-mcp-tool local hooks"
        ".claude/settings.json"
        ".gemini-mcp-hooks/"
    )
    
    if [ -f "$gitignore_file" ]; then
        # Check if entries already exist
        if ! grep -q "gemini-mcp-tool" "$gitignore_file" 2>/dev/null; then
            echo "" >> "$gitignore_file"
            for entry in "${entries[@]}"; do
                echo "$entry" >> "$gitignore_file"
            done
            log "info" "Added entries to existing .gitignore"
        else
            log "debug" "gitignore entries already exist"
        fi
    else
        # Create new .gitignore
        for entry in "${entries[@]}"; do
            echo "$entry" >> "$gitignore_file"
        done
        log "info" "Created .gitignore with hook entries"
    fi
}

# Show installation summary
show_summary() {
    local gemini_tool_path="$1"
    
    echo ""
    echo "🎉 Local installation completed successfully!"
    echo "============================================="
    echo ""
    echo "📁 Project Directory: $CURRENT_DIR"
    echo "⚙️  Local Claude Settings: $CLAUDE_SETTINGS_FILE"
    echo "🔧 Hook Infrastructure: $HOOKS_DIR"
    echo "🎯 Global gemini-mcp-tool: $gemini_tool_path"
    echo ""
    echo "🧪 Next steps:"
    echo ""
    echo "   1. **RESTART Claude Code** in this directory"
    echo "      (hooks are loaded when Claude starts)"
    echo ""
    echo "   2. Use Claude Code normally in this project:"
    echo "      - Hooks will activate when gemini-cli MCP tools are used"
    echo "      - Only affects this project directory"
    echo ""
    echo "   3. Configure local settings (optional):"
    echo "      - Edit: $HOOKS_DIR/config.json"
    echo "      - Set DEBUG_LEVEL=2 for verbose logging"
    echo ""
    echo "🔧 Local Configuration:"
    echo "   - Hook router: $HOOKS_DIR/router.sh"
    echo "   - Local config: $HOOKS_DIR/config.json"
    echo "   - Logs: Check console output with DEBUG_LEVEL=2"
    echo ""
    echo "💡 Uninstall:"
    echo "   - Delete: $CLAUDE_SETTINGS_FILE"
    echo "   - Delete: $HOOKS_DIR"
    echo "   - Or restore backup: ${CLAUDE_SETTINGS_FILE}.backup.*"
    echo ""
    echo "🚨 IMPORTANT: Restart Claude Code for hooks to take effect!"
}

# Check existing installation status
check_existing_installation() {
    local hooks_dir_exists=false
    local claude_settings_exists=false
    local router_script_exists=false
    local config_exists=false
    local valid_claude_settings=false
    local valid_router_script=false
    
    # Check file existence
    [ -d "$HOOKS_DIR" ] && hooks_dir_exists=true
    [ -f "$CLAUDE_SETTINGS_FILE" ] && claude_settings_exists=true
    [ -f "$HOOKS_DIR/router.sh" ] && router_script_exists=true
    [ -f "$HOOKS_DIR/config.json" ] && config_exists=true
    
    # Validate Claude settings if it exists
    if $claude_settings_exists; then
        if jq -e '.hooks.PreToolUse[]? | select(.matcher == "mcp__gemini-cli__.*")' "$CLAUDE_SETTINGS_FILE" >/dev/null 2>&1; then
            valid_claude_settings=true
        fi
    fi
    
    # Validate router script if it exists
    if $router_script_exists; then
        if grep -q "GEMINI_TOOL_PATH" "$HOOKS_DIR/router.sh" 2>/dev/null && \
           grep -q "local-hook-router" "$HOOKS_DIR/router.sh" 2>/dev/null; then
            valid_router_script=true
        fi
    fi
    
    # Determine installation status
    if ! $hooks_dir_exists && ! $claude_settings_exists; then
        echo "clean"
    elif $hooks_dir_exists && $claude_settings_exists && $router_script_exists && $config_exists && $valid_claude_settings && $valid_router_script; then
        echo "complete"
    elif $hooks_dir_exists || $claude_settings_exists || $router_script_exists; then
        if ($claude_settings_exists && ! $valid_claude_settings) || ($router_script_exists && ! $valid_router_script); then
            echo "corrupted"
        else
            echo "partial"
        fi
    else
        echo "clean"
    fi
}

# Validate installation
validate_installation() {
    local gemini_tool_path="$1"
    
    log "info" "Validating installation..."
    
    local validation_errors=0
    
    # Check hook directory exists
    if [ ! -d "$HOOKS_DIR" ]; then
        log "error" "Hook directory not found: $HOOKS_DIR"
        ((validation_errors++))
    fi
    
    # Check router script exists and is executable
    if [ ! -f "$HOOKS_DIR/router.sh" ]; then
        log "error" "Router script not found: $HOOKS_DIR/router.sh"
        ((validation_errors++))
    elif [ ! -x "$HOOKS_DIR/router.sh" ]; then
        log "error" "Router script not executable: $HOOKS_DIR/router.sh"
        ((validation_errors++))
    fi
    
    # Check config file exists and has valid JSON
    if [ ! -f "$HOOKS_DIR/config.json" ]; then
        log "error" "Config file not found: $HOOKS_DIR/config.json"
        ((validation_errors++))
    elif ! jq empty "$HOOKS_DIR/config.json" 2>/dev/null; then
        log "error" "Config file contains invalid JSON: $HOOKS_DIR/config.json"
        ((validation_errors++))
    fi
    
    # Check Claude settings exists and has valid hooks
    if [ ! -f "$CLAUDE_SETTINGS_FILE" ]; then
        log "error" "Claude settings not found: $CLAUDE_SETTINGS_FILE"
        ((validation_errors++))
    elif ! jq -e '.hooks.PreToolUse[]? | select(.matcher == "mcp__gemini-cli__.*")' "$CLAUDE_SETTINGS_FILE" >/dev/null 2>&1; then
        log "error" "Claude settings missing gemini-cli hooks"
        ((validation_errors++))
    fi
    
    # Check global gemini-mcp-tool directory exists
    if [ ! -d "$gemini_tool_path" ]; then
        log "error" "Global gemini-mcp-tool directory not found: $gemini_tool_path"
        ((validation_errors++))
    fi
    
    # Test router script syntax
    if [ -f "$HOOKS_DIR/router.sh" ]; then
        if ! bash -n "$HOOKS_DIR/router.sh" 2>/dev/null; then
            log "error" "Router script has syntax errors"
            ((validation_errors++))
        fi
    fi
    
    # Report validation results
    if [ $validation_errors -eq 0 ]; then
        log "info" "Installation validation successful"
    else
        log "warn" "Installation validation found $validation_errors error(s)"
        echo ""
        echo "⚠️  Some issues were detected. The installation may not work correctly."
        echo "   Consider running the installer again to fix these issues."
    fi
    
    return $validation_errors
}

# Main installation
main() {
    echo "This installer will set up gemini-mcp-tool hooks locally in this project."
    echo "Project directory: $CURRENT_DIR"
    echo ""
    
    # Check if already installed
    local installation_status=$(check_existing_installation)
    
    case $installation_status in
        "clean")
            read -p "Continue with installation? (y/N): " confirm
            ;;
        "partial")
            log "warn" "Partial installation detected - some files exist"
            echo ""
            read -p "Continue with installation? (y/N): " confirm
            ;;
        "complete")
            log "warn" "Complete installation detected"
            echo ""
            read -p "Reinstall/update existing hooks? (y/N): " confirm
            ;;
        "corrupted")
            log "warn" "Corrupted installation detected - invalid hook files"
            echo ""
            read -p "Fix corrupted installation? (y/N): " confirm
            ;;
    esac
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log "info" "Installation cancelled"
        exit 0
    fi
    
    echo ""
    
    # Installation steps
    check_requirements
    local gemini_tool_path=$(find_gemini_mcp_tool)
    create_hook_infrastructure "$gemini_tool_path"
    configure_local_hooks
    create_gitignore_entries
    
    # Validate installation
    validate_installation "$gemini_tool_path"
    
    show_summary "$gemini_tool_path"
}

# Execute script
main "$@"