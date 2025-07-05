#!/bin/bash
# Delegate tool execution to Gemini CLI for large/complex operations
# Handles formatting, execution, caching, and response transformation

# Configuration
GEMINI_CACHE_DIR="${HOME}/.gemini-mcp/gemini-cache"
GEMINI_MODEL="${GEMINI_MODEL:-gemini-1.5-pro-latest}"
GEMINI_TIMEOUT="${GEMINI_TIMEOUT:-120}"  # 2 minutes default
GEMINI_RATE_LIMIT="${GEMINI_RATE_LIMIT:-1}"  # seconds between calls

# Ensure directories exist
mkdir -p "$GEMINI_CACHE_DIR"
mkdir -p "$HOME/.gemini-mcp/logs"

# Rate limiting
enforce_rate_limit() {
  local rate_limit_file="$HOME/.gemini-mcp/.last_gemini_call"
  
  if [[ -f "$rate_limit_file" ]] && [[ "$GEMINI_RATE_LIMIT" -gt 0 ]]; then
    local last_call=$(cat "$rate_limit_file")
    local current_time=$(date +%s)
    local elapsed=$((current_time - last_call))
    
    if [[ "$elapsed" -lt "$GEMINI_RATE_LIMIT" ]]; then
      local wait_time=$((GEMINI_RATE_LIMIT - elapsed))
      if [[ "$ROUTING_VERBOSE" == "true" ]]; then
        echo "[RATE LIMIT] Waiting ${wait_time}s before Gemini call" >&2
      fi
      sleep "$wait_time"
    fi
  fi
  
  # Update last call time
  date +%s > "$rate_limit_file"
}

# Main delegation function
delegate_to_gemini() {
  local hook_input="$1"
  local file_count="$2"
  local total_size="$3"
  local estimated_tokens="$4"
  
  # Extract tool information
  local tool_name=$(echo "$hook_input" | jq -r '.tool_name // ""')
  local tool_input=$(echo "$hook_input" | jq -r '.tool_input // {}')
  
  # Generate cache key
  local cache_key=$(generate_cache_key "$tool_name" "$tool_input")
  local cache_file="$GEMINI_CACHE_DIR/${cache_key}.json"
  
  # Check cache
  if [[ -f "$cache_file" ]]; then
    local cache_age=$(($(date +%s) - $(stat -f%m "$cache_file" 2>/dev/null || stat -c%Y "$cache_file" 2>/dev/null || echo 0)))
    local cache_ttl="${GEMINI_CACHE_TTL:-3600}"  # 1 hour default
    
    if [[ "$cache_age" -lt "$cache_ttl" ]]; then
      if [[ "$ROUTING_VERBOSE" == "true" ]]; then
        echo "[GEMINI CACHE] Hit - age: ${cache_age}s, ttl: ${cache_ttl}s" >&2
      fi
      
      # Return cached result with updated metadata
      local cached_result=$(cat "$cache_file")
      echo "$cached_result" | jq \
        --arg rt "delegated_gemini_cached" \
        --arg fc "$file_count" \
        --arg ts "$total_size" \
        --arg et "$estimated_tokens" \
        '.routing_metadata.type = $rt |
         .routing_metadata.cache_hit = true |
         .routing_metadata.cache_age_seconds = '"$cache_age"
      return 0
    fi
  fi
  
  # Enforce rate limiting
  enforce_rate_limit
  
  # Prepare Gemini prompt
  local gemini_prompt=$(prepare_gemini_prompt "$tool_name" "$tool_input")
  
  # Execute Gemini with timeout
  local start_time=$(date +%s)
  local gemini_output
  local exit_code
  
  if [[ "$ROUTING_VERBOSE" == "true" ]]; then
    echo "[GEMINI] Executing with model: $GEMINI_MODEL" >&2
    echo "[GEMINI] Estimated tokens: $estimated_tokens" >&2
  fi
  
  # Run Gemini CLI
  if command -v timeout >/dev/null 2>&1; then
    gemini_output=$(timeout "${GEMINI_TIMEOUT}s" execute_gemini_cli "$gemini_prompt" 2>&1)
    exit_code=$?
  else
    gemini_output=$(execute_gemini_cli "$gemini_prompt" 2>&1)
    exit_code=$?
  fi
  
  local execution_time=$(($(date +%s) - start_time))
  
  # Check for errors
  if [[ "$exit_code" -ne 0 ]]; then
    echo "[GEMINI ERROR] Exit code: $exit_code, time: ${execution_time}s" >&2
    echo "[GEMINI ERROR] Output: $gemini_output" >&2
    return 1
  fi
  
  if [[ "$ROUTING_VERBOSE" == "true" ]]; then
    echo "[GEMINI] Completed in ${execution_time}s" >&2
  fi
  
  # Transform Gemini output to MCP response
  local mcp_response=$(transform_gemini_response "$hook_input" "$gemini_output" "$file_count" "$total_size" "$estimated_tokens" "$execution_time")
  
  # Cache the response
  echo "$mcp_response" > "$cache_file"
  
  # Log execution
  log_gemini_execution "$tool_name" "$file_count" "$total_size" "$estimated_tokens" "$execution_time" "$exit_code"
  
  # Return response
  echo "$mcp_response"
}

# Generate cache key from tool call
generate_cache_key() {
  local tool_name="$1"
  local tool_input="$2"
  
  # Include file contents in cache key for accuracy
  local file_hashes=""
  local file_refs=$(echo "$tool_input" | jq -r '.. | select(type == "string") | scan("@[^[:space:]]+") | ltrimstr("@")' 2>/dev/null || echo "")
  
  if [[ -n "$file_refs" ]]; then
    while IFS= read -r file_ref; do
      if [[ -f "$file_ref" ]]; then
        # Use file size and mtime for cache key
        local file_stat
        if [[ "$OSTYPE" == "darwin"* ]]; then
          file_stat=$(stat -f"%z_%m" "$file_ref" 2>/dev/null || echo "0_0")
        else
          file_stat=$(stat -c"%s_%Y" "$file_ref" 2>/dev/null || echo "0_0")
        fi
        file_hashes="${file_hashes}_${file_stat}"
      fi
    done <<< "$file_refs"
  fi
  
  # Create hash from tool name, input, and file states
  echo "${tool_name}${tool_input}${file_hashes}" | sha256sum | cut -d' ' -f1
}

# Prepare prompt for Gemini
prepare_gemini_prompt() {
  local tool_name="$1"
  local tool_input="$2"
  
  # Extract the actual MCP tool name (remove mcp__gemini-cli__ prefix)
  local actual_tool="${tool_name#mcp__gemini-cli__}"
  
  # Build prompt based on tool type
  case "$actual_tool" in
    "FileDiscovery"|"FileOperations"|"ask-gemini")
      # For file operations, include file contents
      build_file_operation_prompt "$actual_tool" "$tool_input"
      ;;
    "analyze-for-changes"|"field-aware-gemini")
      # For analysis tools, structure the request
      build_analysis_prompt "$actual_tool" "$tool_input"
      ;;
    *)
      # Generic prompt
      echo "Execute MCP tool '$actual_tool' with input: $(echo "$tool_input" | jq -c .)"
      ;;
  esac
}

# Build prompt for file operations
build_file_operation_prompt() {
  local tool_name="$1"
  local tool_input="$2"
  
  local prompt="MCP Tool: $tool_name\n\n"
  
  # Add tool-specific context
  case "$tool_name" in
    "FileDiscovery")
      prompt+="Task: Discover and analyze files matching the given criteria.\n"
      ;;
    "FileOperations")
      prompt+="Task: Perform file operations as specified.\n"
      ;;
    "ask-gemini")
      local user_prompt=$(echo "$tool_input" | jq -r '.prompt // ""')
      prompt+="User request: $user_prompt\n"
      ;;
  esac
  
  # Include file contents for @ references
  local file_refs=$(echo "$tool_input" | jq -r '.. | select(type == "string") | scan("@[^[:space:]]+")' 2>/dev/null || echo "")
  
  if [[ -n "$file_refs" ]]; then
    prompt+="\nFile contents:\n"
    while IFS= read -r file_ref; do
      local file_path="${file_ref#@}"
      if [[ -f "$file_path" ]]; then
        prompt+="\n--- File: $file_path ---\n"
        # Limit file content to prevent prompt explosion
        head -n 1000 "$file_path" | cat -n
        prompt+="\n"
      fi
    done <<< "$file_refs"
  fi
  
  # Add input parameters
  prompt+="\nTool parameters:\n$(echo "$tool_input" | jq .)\n"
  
  echo -e "$prompt"
}

# Build prompt for analysis tools
build_analysis_prompt() {
  local tool_name="$1"
  local tool_input="$2"
  
  echo "Analyze using $tool_name with parameters: $(echo "$tool_input" | jq -c .)"
}

# Execute Gemini CLI
execute_gemini_cli() {
  local prompt="$1"
  
  # Check if Gemini CLI is available
  if ! command -v gemini &> /dev/null; then
    echo "ERROR: Gemini CLI not found" >&2
    return 127
  fi
  
  # Execute with model selection
  echo "$prompt" | gemini -m "$GEMINI_MODEL" 2>&1
}

# Transform Gemini response to MCP format
transform_gemini_response() {
  local hook_input="$1"
  local gemini_output="$2"
  local file_count="$3"
  local total_size="$4"
  local estimated_tokens="$5"
  local execution_time="$6"
  
  # Create MCP-compatible response
  jq -n \
    --arg output "$gemini_output" \
    --arg rt "delegated_gemini" \
    --arg fc "$file_count" \
    --arg ts "$total_size" \
    --arg et "$estimated_tokens" \
    --arg exec_time "$execution_time" \
    --arg model "$GEMINI_MODEL" \
    --argjson original "$hook_input" \
    '{
      tool_name: $original.tool_name,
      tool_input: $original.tool_input,
      output: $output,
      routing_metadata: {
        type: $rt,
        decision_criteria: {
          file_count: ($fc|tonumber),
          total_size_bytes: ($ts|tonumber),
          estimated_tokens: ($et|tonumber)
        },
        execution: {
          model: $model,
          execution_time_seconds: ($exec_time|tonumber),
          delegated_at: (now|todate)
        }
      }
    }'
}

# Log Gemini execution for monitoring
log_gemini_execution() {
  local tool_name="$1"
  local file_count="$2"
  local total_size="$3"
  local estimated_tokens="$4"
  local execution_time="$5"
  local exit_code="$6"
  
  local log_entry=$(jq -n \
    --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%S.%3N)Z" \
    --arg tool "$tool_name" \
    --arg fc "$file_count" \
    --arg ts "$total_size" \
    --arg et "$estimated_tokens" \
    --arg exec_time "$execution_time" \
    --arg exit_code "$exit_code" \
    --arg model "$GEMINI_MODEL" \
    '{
      timestamp: $timestamp,
      tool: $tool,
      file_count: ($fc|tonumber),
      total_size: ($ts|tonumber),
      tokens: ($et|tonumber),
      execution_time: ($exec_time|tonumber),
      exit_code: ($exit_code|tonumber),
      model: $model
    }')
  
  echo "$log_entry" >> "$HOME/.gemini-mcp/gemini-executions.jsonl"
}