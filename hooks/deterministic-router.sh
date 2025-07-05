#!/bin/bash
# ABOUTME: Deterministic routing for gemini-mcp-tool based on objective criteria
# Routes MCP tool calls to either Gemini CLI or enhanced MCP server

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load user configuration with defaults
if [[ -f "${HOME}/.gemini-mcp/routing.conf" ]]; then
  source "${HOME}/.gemini-mcp/routing.conf"
fi

# Set defaults if not configured
FILE_COUNT_THRESHOLD="${FILE_COUNT_THRESHOLD:-${GEMINI_MCP_FILE_THRESHOLD:-3}}"
SIZE_THRESHOLD="${SIZE_THRESHOLD:-${GEMINI_MCP_SIZE_THRESHOLD:-10485760}}"  # 10MB
TOKEN_THRESHOLD="${TOKEN_THRESHOLD:-${GEMINI_MCP_TOKEN_THRESHOLD:-50000}}"
ROUTING_TIMEOUT="${ROUTING_TIMEOUT:-${GEMINI_MCP_ROUTING_TIMEOUT:-100}}"  # 100ms
ROUTING_VERBOSE="${ROUTING_VERBOSE:-true}"
FALLBACK_MODE="${FALLBACK_MODE:-passthrough}"

# Source helper libraries
source "$SCRIPT_DIR/lib/circuit-breaker.sh" 2>/dev/null || true
source "$SCRIPT_DIR/lib/fast-analyzer.sh" 2>/dev/null || true
source "$SCRIPT_DIR/lib/delegate-to-gemini.sh" 2>/dev/null || true

# Ensure log directory exists
mkdir -p "$HOME/.gemini-mcp"

# Main routing function
main() {
  local HOOK_INPUT=$(cat)
  
  # Extract tool information
  local tool_name=$(echo "$HOOK_INPUT" | jq -r '.tool_name // ""')
  
  # Only process MCP tools
  if [[ ! "$tool_name" =~ ^mcp__gemini-cli__.* ]]; then
    # Not our tool, pass through unchanged
    echo "$HOOK_INPUT"
    exit 0
  fi
  
  # Debug logging
  if [[ "$ROUTING_VERBOSE" == "true" ]] || [[ "$DEBUG_LEVEL" -ge "2" ]] 2>/dev/null; then
    echo "[ROUTER] Processing MCP tool: $tool_name" >&2
  fi
  
  # Analyze and route
  analyze_and_route "$HOOK_INPUT"
}

# Analyze tool call and make routing decision
analyze_and_route() {
  local hook_input="$1"
  local start_time=$(date +%s%3N)  # milliseconds
  
  # Extract tool input
  local tool_input=$(echo "$hook_input" | jq -r '.tool_input // {}')
  
  # Analyze with timeout protection
  local analysis_result
  if command -v timeout >/dev/null 2>&1; then
    analysis_result=$(timeout "${ROUTING_TIMEOUT}ms" analyze_tool_input "$tool_input" 2>/dev/null)
  else
    # Fallback without timeout command
    analysis_result=$(analyze_tool_input "$tool_input" 2>/dev/null)
  fi
  
  # Parse analysis results with defaults
  local file_count=$(echo "$analysis_result" | jq -r '.file_count // 0' 2>/dev/null || echo 0)
  local total_size=$(echo "$analysis_result" | jq -r '.total_size // 0' 2>/dev/null || echo 0)
  local estimated_tokens=$(echo "$analysis_result" | jq -r '.tokens // 0' 2>/dev/null || echo 0)
  
  # Calculate routing time
  local end_time=$(date +%s%3N)
  local routing_time=$((end_time - start_time))
  
  # Make routing decision
  local decision=$(make_routing_decision "$file_count" "$total_size" "$estimated_tokens")
  
  # Log decision with full transparency
  if [[ "$ROUTING_VERBOSE" == "true" ]]; then
    log_routing_decision "$decision" "$file_count" "$total_size" "$estimated_tokens" "$routing_time"
  fi
  
  # Execute based on decision
  case "$decision" in
    "DELEGATE")
      if command -v execute_with_fallback >/dev/null 2>&1; then
        execute_with_fallback "$hook_input" "$file_count" "$total_size" "$estimated_tokens"
      else
        # Direct delegation without circuit breaker
        if command -v delegate_to_gemini >/dev/null 2>&1; then
          delegate_to_gemini "$hook_input" "$file_count" "$total_size" "$estimated_tokens"
        else
          # Fallback if delegation not available
          echo "[ROUTER] Gemini delegation not available, passing through" >&2
          add_routing_metadata "$hook_input" "passthrough_no_delegate" "$file_count" "$total_size" "$estimated_tokens"
        fi
      fi
      ;;
    "PASSTHROUGH")
      add_routing_metadata "$hook_input" "passthrough" "$file_count" "$total_size" "$estimated_tokens"
      ;;
  esac
}

# Analyze tool input for routing criteria
analyze_tool_input() {
  local tool_input="$1"
  
  # Extract file references (@ syntax)
  local file_refs=$(echo "$tool_input" | jq -r 'to_entries[] | select(.value | type == "string") | .value' 2>/dev/null | grep -o '@[^[:space:]]*' || echo "")
  local file_count=0
  local total_size=0
  
  if [[ -n "$file_refs" ]]; then
    file_count=$(echo "$file_refs" | wc -l | tr -d ' ')
    
    # Calculate total size of referenced files
    while IFS= read -r file_ref; do
      local file_path="${file_ref#@}"
      
      # Convert relative to absolute path if needed
      if [[ ! "$file_path" =~ ^/ ]]; then
        file_path="$(pwd)/$file_path"
      fi
      
      if [[ -f "$file_path" ]]; then
        local file_size
        if [[ "$OSTYPE" == "darwin"* ]]; then
          file_size=$(stat -f%z "$file_path" 2>/dev/null || echo 0)
        else
          file_size=$(stat -c%s "$file_path" 2>/dev/null || echo 0)
        fi
        total_size=$((total_size + file_size))
      fi
    done <<< "$file_refs"
  fi
  
  # Estimate tokens (roughly 4 chars per token)
  local estimated_tokens=$((total_size / 4))
  
  # Output JSON result
  jq -n \
    --arg fc "$file_count" \
    --arg ts "$total_size" \
    --arg et "$estimated_tokens" \
    '{file_count: ($fc|tonumber), total_size: ($ts|tonumber), tokens: ($et|tonumber)}'
}

# Make routing decision based on objective criteria
make_routing_decision() {
  local file_count="$1"
  local total_size="$2"
  local estimated_tokens="$3"
  
  # Apply routing criteria
  if [[ "$file_count" -ge "$FILE_COUNT_THRESHOLD" ]] || \
     [[ "$total_size" -gt "$SIZE_THRESHOLD" ]] || \
     [[ "$estimated_tokens" -gt "$TOKEN_THRESHOLD" ]]; then
    echo "DELEGATE"
  else
    echo "PASSTHROUGH"
  fi
}

# Log routing decision with full transparency
log_routing_decision() {
  local decision="$1"
  local file_count="$2"
  local size="$3"
  local tokens="$4"
  local time="$5"
  local size_mb=$((size / 1048576))
  local threshold_mb=$((SIZE_THRESHOLD / 1048576))
  
  # User-visible routing transparency
  echo "[ROUTING DECISION] $decision" >&2
  echo "  Files: $file_count (threshold: $FILE_COUNT_THRESHOLD)" >&2
  echo "  Size: ${size_mb}MB (threshold: ${threshold_mb}MB)" >&2
  echo "  Tokens: ~$tokens (threshold: $TOKEN_THRESHOLD)" >&2
  echo "  Decision time: ${time}ms" >&2
  
  # Also log to file for analysis
  local log_entry="$(date -u +%Y-%m-%dT%H:%M:%S.%3N)Z | $decision | files=$file_count | size=$size | tokens=$tokens | time_ms=$time"
  echo "$log_entry" >> "$HOME/.gemini-mcp/routing.log"
}

# Add routing metadata to response
add_routing_metadata() {
  local hook_input="$1"
  local routing_type="$2"
  local file_count="$3"
  local total_size="$4"
  local estimated_tokens="$5"
  
  # Add routing metadata to the response
  echo "$hook_input" | jq \
    --arg rt "$routing_type" \
    --arg fc "$file_count" \
    --arg ts "$total_size" \
    --arg et "$estimated_tokens" \
    --arg threshold_fc "$FILE_COUNT_THRESHOLD" \
    --arg threshold_ts "$SIZE_THRESHOLD" \
    --arg threshold_et "$TOKEN_THRESHOLD" \
    '.routing_metadata = {
      type: $rt,
      decision_criteria: {
        file_count: ($fc|tonumber),
        total_size_bytes: ($ts|tonumber),
        estimated_tokens: ($et|tonumber)
      },
      thresholds: {
        file_count: ($threshold_fc|tonumber),
        size_bytes: ($threshold_ts|tonumber),
        tokens: ($threshold_et|tonumber)
      },
      timestamp: (now|todate)
    }'
}

# Execute main function
main "$@"