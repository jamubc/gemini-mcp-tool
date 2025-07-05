#!/bin/bash
# Circuit breaker pattern for Gemini delegation failures
# Prevents cascading failures by temporarily disabling delegation after repeated errors

# Configuration
CIRCUIT_STATE_FILE="${HOME}/.gemini-mcp/circuit-state"
CIRCUIT_BREAKER_THRESHOLD="${CIRCUIT_BREAKER_THRESHOLD:-3}"  # Failures before opening
CIRCUIT_BREAKER_TIMEOUT="${CIRCUIT_BREAKER_TIMEOUT:-300}"   # Seconds before retry

# Initialize state
FAILURE_COUNT=0
LAST_FAILURE_TIME=0

# Ensure state directory exists
mkdir -p "$(dirname "$CIRCUIT_STATE_FILE")"

# Check if circuit is open
is_circuit_open() {
  if [[ -f "$CIRCUIT_STATE_FILE" ]]; then
    # Load state
    source "$CIRCUIT_STATE_FILE"
    
    local current_time=$(date +%s)
    local time_since_failure=$((current_time - LAST_FAILURE_TIME))
    
    if [[ "$FAILURE_COUNT" -ge "$CIRCUIT_BREAKER_THRESHOLD" ]]; then
      if [[ "$time_since_failure" -lt "$CIRCUIT_BREAKER_TIMEOUT" ]]; then
        # Circuit is open
        local remaining=$((CIRCUIT_BREAKER_TIMEOUT - time_since_failure))
        if [[ "$ROUTING_VERBOSE" == "true" ]]; then
          echo "[CIRCUIT BREAKER] Circuit OPEN - $remaining seconds until retry" >&2
        fi
        return 0
      else
        # Timeout expired, reset circuit
        if [[ "$ROUTING_VERBOSE" == "true" ]]; then
          echo "[CIRCUIT BREAKER] Timeout expired, resetting circuit" >&2
        fi
        reset_circuit
      fi
    fi
  fi
  
  return 1  # Circuit is closed
}

# Record a failure
record_failure() {
  local error_msg="${1:-Unknown error}"
  
  # Load current state
  if [[ -f "$CIRCUIT_STATE_FILE" ]]; then
    source "$CIRCUIT_STATE_FILE"
  fi
  
  FAILURE_COUNT=$((FAILURE_COUNT + 1))
  LAST_FAILURE_TIME=$(date +%s)
  
  # Save state
  cat > "$CIRCUIT_STATE_FILE" << EOF
FAILURE_COUNT=$FAILURE_COUNT
LAST_FAILURE_TIME=$LAST_FAILURE_TIME
EOF
  
  # Log failure
  local timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3N)Z
  echo "${timestamp} | FAILURE #$FAILURE_COUNT | $error_msg" >> "$HOME/.gemini-mcp/circuit-breaker.log"
  
  if [[ "$FAILURE_COUNT" -eq "$CIRCUIT_BREAKER_THRESHOLD" ]]; then
    echo "[CIRCUIT BREAKER] Circuit OPENED after $FAILURE_COUNT failures" >&2
    echo "[CIRCUIT BREAKER] Will retry in $CIRCUIT_BREAKER_TIMEOUT seconds" >&2
  else
    echo "[CIRCUIT BREAKER] Failure recorded ($FAILURE_COUNT/$CIRCUIT_BREAKER_THRESHOLD)" >&2
  fi
}

# Reset circuit after successful operation
reset_circuit() {
  FAILURE_COUNT=0
  LAST_FAILURE_TIME=0
  rm -f "$CIRCUIT_STATE_FILE"
  
  if [[ "$ROUTING_VERBOSE" == "true" ]]; then
    echo "[CIRCUIT BREAKER] Circuit reset - healthy state restored" >&2
  fi
}

# Execute with fallback protection
execute_with_fallback() {
  local hook_input="$1"
  local file_count="$2"
  local total_size="$3"
  local estimated_tokens="$4"
  
  # Check circuit state
  if is_circuit_open; then
    echo "[CIRCUIT BREAKER] Circuit open, falling back to MCP" >&2
    add_routing_metadata "$hook_input" "fallback_circuit_open" "$file_count" "$total_size" "$estimated_tokens"
    return 0
  fi
  
  # Try Gemini delegation
  local result
  local exit_code
  
  # Attempt delegation with error capture
  result=$(delegate_to_gemini "$hook_input" "$file_count" "$total_size" "$estimated_tokens" 2>&1)
  exit_code=$?
  
  if [[ "$exit_code" -eq 0 ]]; then
    # Success - reset circuit and output result
    reset_circuit
    echo "$result"
  else
    # Failure - record and fallback
    local error_msg="Gemini delegation failed with exit code $exit_code"
    record_failure "$error_msg"
    
    echo "[FALLBACK] $error_msg, using enhanced MCP" >&2
    
    # Fallback based on configuration
    case "$FALLBACK_MODE" in
      "error")
        # Return error to Claude
        echo "$hook_input" | jq '.error = "Gemini delegation failed, circuit breaker activated"'
        ;;
      "passthrough"|*)
        # Default: pass through to MCP with fallback metadata
        add_routing_metadata "$hook_input" "fallback_delegation_error" "$file_count" "$total_size" "$estimated_tokens"
        ;;
    esac
  fi
}

# Get circuit status (for monitoring)
get_circuit_status() {
  if [[ -f "$CIRCUIT_STATE_FILE" ]]; then
    source "$CIRCUIT_STATE_FILE"
    
    local current_time=$(date +%s)
    local time_since_failure=$((current_time - LAST_FAILURE_TIME))
    local is_open="false"
    
    if [[ "$FAILURE_COUNT" -ge "$CIRCUIT_BREAKER_THRESHOLD" ]] && \
       [[ "$time_since_failure" -lt "$CIRCUIT_BREAKER_TIMEOUT" ]]; then
      is_open="true"
    fi
    
    jq -n \
      --arg state "$([[ "$is_open" == "true" ]] && echo "open" || echo "closed")" \
      --arg failures "$FAILURE_COUNT" \
      --arg threshold "$CIRCUIT_BREAKER_THRESHOLD" \
      --arg last_failure "$LAST_FAILURE_TIME" \
      --arg timeout "$CIRCUIT_BREAKER_TIMEOUT" \
      '{
        state: $state,
        failure_count: ($failures|tonumber),
        threshold: ($threshold|tonumber),
        last_failure_timestamp: ($last_failure|tonumber),
        timeout_seconds: ($timeout|tonumber)
      }'
  else
    echo '{"state": "closed", "failure_count": 0}'
  fi
}