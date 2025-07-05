#!/bin/bash
# Optimized file analysis with caching for performance
# Analyzes tool inputs to determine file count, size, and token estimates

# Configuration
ANALYSIS_CACHE_DIR="${HOME}/.gemini-mcp/analysis-cache"
CACHE_VALIDITY_MINUTES="${ANALYSIS_CACHE_VALIDITY:-5}"

# Ensure cache directory exists
mkdir -p "$ANALYSIS_CACHE_DIR"

# Clean old cache entries
cleanup_cache() {
  if [[ -d "$ANALYSIS_CACHE_DIR" ]]; then
    # Remove cache files older than validity period
    find "$ANALYSIS_CACHE_DIR" -name "*.json" -type f -mmin +${CACHE_VALIDITY_MINUTES} -delete 2>/dev/null || true
  fi
}

# Analyze tool input with caching
analyze_tool_input() {
  local tool_input="$1"
  
  # Generate cache key from input
  local cache_key=$(echo "$tool_input" | sha256sum | cut -d' ' -f1)
  local cache_file="$ANALYSIS_CACHE_DIR/${cache_key}.json"
  
  # Check cache
  if [[ -f "$cache_file" ]]; then
    # Verify cache is still valid
    if [[ $(find "$cache_file" -mmin -${CACHE_VALIDITY_MINUTES} -print 2>/dev/null) ]]; then
      if [[ "$ROUTING_VERBOSE" == "true" ]]; then
        echo "[ANALYZER] Cache hit for analysis" >&2
      fi
      cat "$cache_file"
      return 0
    fi
  fi
  
  # Perform analysis
  local start_time=$(date +%s%3N)
  local analysis_result=$(perform_analysis "$tool_input")
  local analysis_time=$(($(date +%s%3N) - start_time))
  
  if [[ "$ROUTING_VERBOSE" == "true" ]]; then
    echo "[ANALYZER] Analysis completed in ${analysis_time}ms" >&2
  fi
  
  # Cache result
  echo "$analysis_result" > "$cache_file"
  
  # Output result
  echo "$analysis_result"
  
  # Async cache cleanup (don't block)
  (cleanup_cache &) 2>/dev/null
}

# Perform actual analysis
perform_analysis() {
  local tool_input="$1"
  
  # Initialize counters
  local file_count=0
  local total_size=0
  local file_list=()
  
  # Extract all potential file references
  # Look for @ references in string values
  local file_refs=$(echo "$tool_input" | jq -r '
    .. | 
    select(type == "string") | 
    scan("@[^[:space:]]+") |
    ltrimstr("@")
  ' 2>/dev/null || echo "")
  
  # Also check for file_path, files, path, paths fields
  local direct_files=$(echo "$tool_input" | jq -r '
    (.file_path // empty),
    (.files[]? // empty),
    (.path // empty),
    (.paths[]? // empty) |
    select(type == "string")
  ' 2>/dev/null || echo "")
  
  # Combine all file references
  local all_files=$(echo -e "$file_refs\n$direct_files" | grep -v '^$' | sort -u)
  
  if [[ -n "$all_files" ]]; then
    # Process files in parallel for performance
    local temp_file=$(mktemp)
    
    # Analyze each file in parallel
    echo "$all_files" | while IFS= read -r file_ref; do
      analyze_single_file "$file_ref" &
    done | tee "$temp_file" | while IFS='|' read -r size path; do
      if [[ -n "$size" ]] && [[ "$size" -gt 0 ]]; then
        file_count=$((file_count + 1))
        total_size=$((total_size + size))
        file_list+=("$path")
      fi
    done
    
    # Wait for all background jobs
    wait
    
    # Read final results
    while IFS='|' read -r size path; do
      if [[ -n "$size" ]] && [[ "$size" -gt 0 ]]; then
        file_count=$((file_count + 1))
        total_size=$((total_size + size))
      fi
    done < "$temp_file"
    
    rm -f "$temp_file"
  fi
  
  # Estimate tokens (roughly 4 chars per token)
  local estimated_tokens=$((total_size / 4))
  
  # Output JSON result
  jq -n \
    --arg fc "$file_count" \
    --arg ts "$total_size" \
    --arg et "$estimated_tokens" \
    --argjson files "$(printf '%s\n' "${file_list[@]}" | jq -R . | jq -s .)" \
    '{
      file_count: ($fc|tonumber),
      total_size: ($ts|tonumber),
      tokens: ($et|tonumber),
      analyzed_at: (now|todate),
      files: $files
    }'
}

# Analyze a single file
analyze_single_file() {
  local file_ref="$1"
  local file_path="$file_ref"
  
  # Handle @ prefix if present
  if [[ "$file_path" =~ ^@ ]]; then
    file_path="${file_path#@}"
  fi
  
  # Convert to absolute path if relative
  if [[ ! "$file_path" =~ ^/ ]]; then
    # Check if it's relative to current directory
    if [[ -f "$(pwd)/$file_path" ]]; then
      file_path="$(pwd)/$file_path"
    elif [[ -f "$file_path" ]]; then
      file_path="$(realpath "$file_path" 2>/dev/null || echo "$file_path")"
    fi
  fi
  
  # Get file size if exists
  if [[ -f "$file_path" ]]; then
    local file_size
    if [[ "$OSTYPE" == "darwin"* ]]; then
      file_size=$(stat -f%z "$file_path" 2>/dev/null || echo 0)
    else
      file_size=$(stat -c%s "$file_path" 2>/dev/null || echo 0)
    fi
    echo "${file_size}|${file_path}"
  else
    # File doesn't exist, but we still count it
    echo "0|${file_path}"
  fi
}

# Get analysis cache statistics
get_cache_stats() {
  local cache_count=0
  local cache_size=0
  
  if [[ -d "$ANALYSIS_CACHE_DIR" ]]; then
    cache_count=$(find "$ANALYSIS_CACHE_DIR" -name "*.json" -type f 2>/dev/null | wc -l | tr -d ' ')
    
    # Calculate total cache size
    if [[ "$OSTYPE" == "darwin"* ]]; then
      cache_size=$(find "$ANALYSIS_CACHE_DIR" -name "*.json" -type f -exec stat -f%z {} \; 2>/dev/null | awk '{sum+=$1} END {print sum}')
    else
      cache_size=$(find "$ANALYSIS_CACHE_DIR" -name "*.json" -type f -exec stat -c%s {} \; 2>/dev/null | awk '{sum+=$1} END {print sum}')
    fi
  fi
  
  cache_size=${cache_size:-0}
  
  jq -n \
    --arg count "$cache_count" \
    --arg size "$cache_size" \
    --arg dir "$ANALYSIS_CACHE_DIR" \
    '{
      cache_entries: ($count|tonumber),
      cache_size_bytes: ($size|tonumber),
      cache_directory: $dir
    }'
}

# Clear analysis cache
clear_cache() {
  if [[ -d "$ANALYSIS_CACHE_DIR" ]]; then
    rm -f "$ANALYSIS_CACHE_DIR"/*.json
    echo "[ANALYZER] Cache cleared" >&2
  fi
}