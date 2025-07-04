# Commands Reference

Complete command reference for Gemini MCP Tool. Learn how to use slash commands, natural language queries, file analysis patterns, and advanced features.

## Available Commands

### `/gemini-cli:analyze` - Code Analysis & Questions
**Purpose:** Analyze files, explain code, find issues, answer programming questions

**File Analysis Examples:**
```bash
# Single file analysis
/gemini-cli:analyze @file.js explain this code

# Multiple files
/gemini-cli:analyze @src/*.ts find security issues

# Directory analysis
/gemini-cli:analyze @src/ review the architecture
```

**Programming Questions:**
```bash
# General programming help
/gemini-cli:analyze how do I implement authentication?

# Code optimization
/gemini-cli:analyze @utils.js how can I optimize this?

# Best practices
/gemini-cli:analyze @api/routes.js suggest improvements
```

### `/gemini-cli:sandbox` - Safe Code Execution
**Purpose:** Generate, test, and execute code in a secure environment

**Code Generation:**
```bash
# Create new code
/gemini-cli:sandbox create a Python fibonacci generator

# Generate specific functions
/gemini-cli:sandbox write a React component for user login
```

**Code Testing:**
```bash
# Test existing code
/gemini-cli:sandbox test this function: [paste code here]

# Validate algorithms
/gemini-cli:sandbox check if this sorting algorithm works
```

### `/gemini-cli:help` - Documentation & Support
**Purpose:** Get help with commands and available features

```bash
# General help
/gemini-cli:help

# Command-specific help
/gemini-cli:help analyze
/gemini-cli:help sandbox
```

### `/gemini-cli:search` - Lightning-Fast Text Search
**Purpose:** Pattern-based text search using ripgrep for exact matches and simple operations

**Find Text Examples:**
```bash
# Find exact text in a file
/gemini-cli:search find "error" in @app.log

# Find text in multiple files
/gemini-cli:search find "TODO" in @src/*.js @test/*.js

# Search with regex patterns
/gemini-cli:search search /function\s+\w+/ in @src/index.js
```

**Count Occurrences:**
```bash
# Count specific text occurrences
/gemini-cli:search count "console.log" in @src/*.js

# Count in multiple files
/gemini-cli:search count "import" in @src/index.js @src/utils.js
```

**Key Features:**
- Lightning-fast ripgrep-powered search
- Case-insensitive by default
- Supports @ file syntax for multiple files
- Exact text matching and basic regex
- Returns structured results with line numbers

**Limitations:**
- No semantic understanding
- No code comprehension
- For complex queries requiring AI understanding, use `/gemini-cli:analyze`

### `/gemini-cli:WebOperations` - Web Search & Content Fetching
**Purpose:** Search the web for current information or fetch content from specific URLs using Gemini's native web capabilities

**Web Search Examples:**
```bash
# Search for current news
/gemini-cli:WebOperations operation:search query:"UBCO Kelowna news" numResults:10 timeRange:month

# Search with specific model
/gemini-cli:WebOperations operation:search query:"latest tech news" model:gemini-2.5-flash

# Search with time range
/gemini-cli:WebOperations operation:search query:"AI developments" timeRange:week
```

**Content Fetching Examples:**
```bash
# Fetch page content
/gemini-cli:WebOperations operation:fetch url:https://example.com/article

# Fetch with summary extraction
/gemini-cli:WebOperations operation:fetch url:https://example.com/article extractType:summary maxLength:2000

# Fetch structured data
/gemini-cli:WebOperations operation:fetch url:https://example.com/article extractType:structured
```

**Key Features:**
- Real-time web search using Gemini's GoogleSearch tool
- Content fetching with WebFetch tool
- 15-minute response caching for performance
- Smart retry logic with parameter adjustment
- Time range filtering (hour, day, week, month, year, all)
- Multiple content extraction types (text, structured, summary)
- Model selection support

**Parameters:**
- `operation`: "search" or "fetch" (required)
- `query`: Search terms (for search operation)
- `url`: URL to fetch (for fetch operation)
- `numResults`: Number of search results (1-10, default: 5)
- `timeRange`: Time filter for search (hour/day/week/month/year/all)
- `extractType`: Content extraction type (text/structured/summary)
- `maxLength`: Maximum content length (default: 5000)
- `model`: Gemini model to use (optional)

**Limitations:**
- Requires active internet connection
- Subject to Gemini's web access capabilities
- Cache TTL of 15 minutes for repeated queries
- Maximum 10 search results per query

### `/gemini-cli:agent-delegate` - Agent-to-Agent Task Delegation
**Purpose:** Delegate complex, context-heavy tasks from Claude to Gemini using structured A2A protocols

**Task Delegation Examples:**
```bash
# Story enhancement with requirements
/gemini-cli:agent-delegate {
  "task": {
    "type": "enhance",
    "description": "Polish README for clarity and tone",
    "files": ["README.md"],
    "requirements": ["keep markdown headings", "preserve code blocks"],
    "context_boundary": "direct",
    "field_integrity": "preserve"
  },
  "protocol": "pareto-lang"
}

# Complex refactoring with multiple files
/gemini-cli:agent-delegate {
  "task": {
    "type": "transform",
    "description": "Convert JavaScript to TypeScript",
    "files": ["src/*.js"],
    "requirements": ["add strict types", "no 'any' types", "preserve functionality"]
  }
}
```

**Key Features:**
- Agent-to-agent (A2A) communication protocol
- Supports 5 task types: analyze, enhance, generate, transform, synthesize
- Three protocols: standard, pareto-lang, context-engineering
- Context boundary control (direct, mediated, isolated)
- Field integrity management (preserve, merge, reconstruct)
- Structured response format for downstream processing

**Limitations:**
- Requires valid JSON payload structure
- Files must exist and be readable
- Delegates to Gemini CLI with strictMode OFF

### `/gemini-cli:ping` - Connection Testing
**Purpose:** Verify MCP server connectivity and Gemini API status

```bash
# Basic connectivity test
/gemini-cli:ping

# Custom test message
/gemini-cli:ping "Testing connection"
```

## Command Structure

```
/gemini-cli:<tool> [options] <arguments>
```

- **tool**: The action to perform (analyze, sandbox, search, help, ping, agent-delegate, WebOperations)
- **options**: Optional flags (coming soon)
- **arguments**: Input text, files, questions, or JSON payloads

## Natural Language Alternative

Instead of slash commands, you can use natural language:

- "Use gemini to analyze index.js"
- "Ask gemini to create a test file"
- "Have gemini explain this error"
- "Search for 'error' in app.log"
- "Count occurrences of 'TODO' in source files"
- "Search the web for latest news about AI"
- "Find current information on React updates"
- "Fetch content from that documentation URL"

## File Patterns

### Single File
```
@README.md
@src/index.js
@test/unit.test.ts
```

### Multiple Files
```
@file1.js @file2.js @file3.js
```

### Wildcards
```
@*.json           # All JSON files in current directory
@src/*.js         # All JS files in src
@**/*.test.js     # All test files recursively
```

### Directory
```
@src/             # All files in src
@test/unit/       # All files in test/unit
```

### Search Patterns
```
# Exact text search
find "error message" in @app.log

# Case-insensitive search (default)
find "ERROR" in @logs/*.txt

# Count occurrences
count "TODO" in @src/*.js

# Multiple files
find "import" in @src/index.js @src/utils.js

# Regular expressions
search /function\s+\w+/ in @src/*.js
```

## Advanced Usage

### Combining Files and Questions
```
/gemini-cli:analyze @package.json @src/index.js is the entry point configured correctly?
```

### Complex Queries
```
/gemini-cli:analyze @src/**/*.js @test/**/*.test.js what's the test coverage?
```

### Code Generation
```
/gemini-cli:analyze @models/user.js generate TypeScript types for this model
```

## Tool Selection Guide

### Use `/gemini-cli:search` for:
- Finding exact text matches
- Counting occurrences of specific strings
- Quick grep-like operations
- Simple pattern matching
- Fast file content searches

### Use `/gemini-cli:analyze` for:
- Understanding code functionality
- Semantic analysis and explanations
- Complex queries requiring AI reasoning
- Code review and improvement suggestions
- Questions about "why" or "how" code works

### Use `/gemini-cli:WebOperations` for:
- Finding current information and news
- Searching for recent updates or developments
- Fetching content from specific URLs
- Research requiring up-to-date information
- Competitive analysis and market research

### Use `/gemini-cli:agent-delegate` for:
- Complex tasks requiring large context windows (>100k tokens)
- Multi-file coordinated changes
- Tasks with specific requirements and constraints
- When you need structured, machine-readable responses
- Delegating work that would be inefficient for Claude to process directly

## Tips

1. **Start Simple**: Begin with single files before using patterns
2. **Be Specific**: Clear questions get better answers
3. **Use Context**: Include relevant files for better analysis
4. **Iterate**: Refine your queries based on responses
5. **Choose Right Tool**: Use search for pattern matching, analyze for understanding