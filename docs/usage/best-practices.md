# Best Practices

Get the most out of Gemini MCP Tool with these proven practices.

## Tool Selection

### Choose the Right Tool
Use search for pattern matching, analyze for understanding:
```bash
# Use search for
/gemini-cli:search find "TODO" in @src/*.js        # Find patterns
/gemini-cli:search count "console.log" in @src/*.js # Count occurrences

# Use analyze for
/gemini-cli:analyze @src/auth.js explain this code # Understanding
/gemini-cli:analyze @src/*.js find security issues # Complex analysis
```

## File Selection

### Start Specific
Begin with individual files before expanding scope:
```bash
# Good progression
@auth.js                    # Start here
@auth.js @user.model.js     # Add related files
@src/auth/*.js              # Expand to module
@src/**/*.js                # Full codebase analysis
```

### Group Related Files
Include configuration with implementation:
```bash
# Good
@webpack.config.js @src/index.js  # Config + entry point
@.env @config/*.js                # Environment + config
@schema.sql @models/*.js          # Database + models

# Less effective
@**/*.js                         # Too broad without context
```

## Query Optimization

### Be Specific About Intent
```bash
# Vague
"analyze this code"

# Specific
"identify performance bottlenecks and suggest optimizations"
"check for SQL injection vulnerabilities"
"explain the authentication flow step by step"
```

### Provide Success Criteria
```bash
# Good
"refactor this to be more testable, following SOLID principles"
"optimize for readability, targeting junior developers"
"make this TypeScript-strict compliant"
```

## Token Management

### Gemini Model Selection
- **Quick tasks**: Use Flash (1M tokens)
- **Full analysis**: Use Pro (2M tokens)
- **Simple queries**: Use Flash-8B

### Efficient File Inclusion
```bash
# Inefficient
@node_modules/**/*.js  # Don't include dependencies

# Efficient
@src/**/*.js @package.json  # Source + manifest
```

## Iterative Development

### Build on Previous Responses
```bash
1. "analyze the architecture"
2. "focus on the authentication module you mentioned"
3. "show me how to implement the improvements"
4. "write tests for the new implementation"
```

### Save Context Between Sessions
```bash
# Create a context file
/gemini-cli:analyze @previous-analysis.md @src/new-feature.js 
continue from our last discussion
```

## Error Handling

### Include Error Context
```bash
# Good
@error.log @src/api.js "getting 500 errors when calling /user endpoint"

# Better
@error.log @src/api.js @models/user.js @.env 
"500 errors on /user endpoint after deployment"
```

### Provide Stack Traces
Always include full error messages and stack traces when debugging.

## Code Generation

### Specify Requirements Clearly
```bash
# Vague
"create a user service"

# Clear
"create a user service with:
- CRUD operations
- input validation
- error handling
- TypeScript types
- Jest tests"
```

### Include Examples
```bash
@existing-service.js "create a similar service for products"
```

## Security Reviews

### Comprehensive Security Checks
```bash
/gemini-cli:analyze @src/**/*.js @package.json @.env.example
- Check for hardcoded secrets
- Review authentication logic
- Identify OWASP vulnerabilities
- Check dependency vulnerabilities
- Review input validation
```

## Performance Optimization

### Measure Before Optimizing
```bash
@performance-profile.json @src/slow-endpoint.js 
"optimize based on this profiling data"
```

### Consider Trade-offs
```bash
"optimize for speed, but maintain readability"
"reduce memory usage without sacrificing features"
```

## Documentation

### Context-Aware Documentation
```bash
@src/api/*.js @README.md 
"update README with accurate API documentation"
```

### Maintain Consistency
```bash
@CONTRIBUTING.md @docs/style-guide.md @src/new-feature.js 
"document following our conventions"
```

## Common Pitfalls to Avoid

### 1. Wrong Tool Choice
❌ Using analyze for simple pattern matching
✅ Using search for finding patterns, analyze for understanding

### 2. Over-broad Queries
❌ `@**/* "fix all issues"`
✅ `@src/auth/*.js "fix security issues in authentication"`

### 3. Missing Context
❌ `"why doesn't this work?"`
✅ `@error.log @config.js "why doesn't database connection work?"`

### 4. Ignoring Model Limits
❌ Trying to analyze 5M tokens with Flash model
✅ Using Pro for large codebases, Flash for single files

### 5. Vague Success Criteria
❌ "make it better"
✅ "improve performance to handle 1000 requests/second"

## Workflow Integration

### Pre-commit Reviews
```bash
# Quick search before committing
alias search-todos='/gemini-cli:search find "TODO" in @src/*.js'

# Full review
alias gemini-review='/gemini-cli:analyze @$(git diff --staged --name-only) review staged changes'
```

:::unstable
## Workflow Optimization

### When to Use Delegation
delegate excels at complex, context-heavy tasks that would be inefficient for Claude to process directly:

#### Good Candidates for Delegation
```bash
# Large file processing (>100k tokens)
/gemini-cli:agent-delegate {
  "task": {
    "type": "analyze",
    "description": "Review entire codebase architecture",
    "files": ["src/**/*.js", "tests/**/*.js", "docs/**/*.md"],
    "requirements": ["identify architectural patterns", "find inconsistencies", "suggest improvements"]
  }
}

# Multi-file coordinated changes
/gemini-cli:agent-delegate {
  "task": {
    "type": "transform",
    "description": "Implement new error handling across services",
    "files": ["services/*/src/*.js"],
    "requirements": ["consistent error format", "preserve existing APIs", "add logging"]
  }
}
```

#### Poor Candidates for Delegation
```bash
# Simple single-file tasks (use analyze instead)
❌ agent-delegate for "explain this function"
✅ /gemini-cli:analyze @utils.js explain the hashPassword function

# Quick searches (use search instead)
❌ agent-delegate for "find all TODO comments"
✅ /gemini-cli:search find "TODO" in @src/*.js
```

### Optimizing Delegation Costs
Claude + Gemini delegation can reduce overall costs when used strategically:

1. **Context Window Efficiency**
   - Claude: Expensive for large contexts
   - Gemini: Cost-effective for 100k-2M token tasks
   - Strategy: Let Claude orchestrate, Gemini process

2. **Task Batching**
   ```bash
   # Batch related changes in one delegation
   /gemini-cli:agent-delegate {
     "task": {
       "type": "transform",
       "description": "Modernize all API endpoints",
       "files": ["api/**/*.js"],
       "requirements": [
         "Convert callbacks to async/await",
         "Add input validation",
         "Standardize error responses",
         "Update JSDoc comments"
       ]
     }
   }
   ```

3. **Protocol Selection**
   - **standard**: Quick, simple tasks
   - **pareto-lang**: Structured operations with field control
   - **context-engineering**: Complex boundary management

### Field Integrity Strategies

Choose the right field integrity setting for your use case:

```bash
# Preserve: No modifications to original structure
"field_integrity": "preserve"  # Documentation, analysis

# Merge: Blend changes with original
"field_integrity": "merge"     # Story enhancement, refactoring

# Reconstruct: Complete rewrite allowed
"field_integrity": "reconstruct"  # Modernization, conversions
```

### Context Boundary Management

Control information flow between agents:

```bash
# Direct: Full file access
"context_boundary": "direct"  # Most common, full transparency

# Mediated: Controlled access with markers
"context_boundary": "mediated"  # Sensitive data, partial access

# Isolated: Sandboxed execution
"context_boundary": "isolated"  # Security reviews, untrusted code
```

### Agent-Delegate vs Other Tools

| Scenario | Best Tool | Why |
|----------|-----------|-----|
| Find error patterns | search | Fast pattern matching |
| Explain complex logic | analyze | Direct AI understanding |
| Refactor entire module | agent-delegate | Multi-file coordination |
| Current tech news | WebOperations | Real-time information |
| Generate test suite | agent-delegate | Complex requirements |
| Quick code review | analyze | Single file, immediate |

## Advanced Tips

### 1. Create Analysis Templates
Save common queries for reuse:
```bash
# security-check.txt
Check for:
- SQL injection
- XSS vulnerabilities
- Authentication bypasses
- Rate limiting
- Input validation
```

### 2. Chain Operations
```bash
"First analyze the bug" → 
"Now write a fix" → 
"Create tests for the fix" →
"Update documentation"
```

### 3. Learn from Patterns
When Gemini suggests improvements, ask:
```bash
"explain why this approach is better"
"show me more examples of this pattern"
```

### 4. Leverage A2A Delegation Chains
```bash
# Step 1: Analyze with delegation
/gemini-cli:agent-delegate analyze entire codebase

# Step 2: Process response in Claude
Review the architecture issues found

# Step 3: Delegate fixes
/gemini-cli:agent-delegate implement the improvements

# Step 4: Validate changes
/gemini-cli:analyze verify the changes are correct
```