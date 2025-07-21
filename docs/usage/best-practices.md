# Best Practices

Get the most out of Gemini MCP Tool with these proven practices.

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
@docs/style-guide.md @src/new-feature.js 
"document following our conventions"
```

## Common Pitfalls to Avoid

### 1. Over-broad Queries
❌ `@**/* "fix all issues"`
✅ `@src/auth/*.js "fix security issues in authentication"`

### 2. Missing Context
❌ `"why doesn't this work?"`
✅ `@error.log @config.js "why doesn't database connection work?"`

### 3. Ignoring Model Limits
❌ Trying to analyze 5M tokens with Flash model
✅ Using Pro for large codebases, Flash for single files

### 4. Vague Success Criteria
❌ "make it better"
✅ "improve performance to handle 1000 requests/second"

## Workflow Integration

### Pre-commit Reviews
```bash
alias gemini-review='/gemini-cli:analyze @$(git diff --staged --name-only) review staged changes'
```

### Daily Development
1. Morning: Architecture review
2. Before PR: Code review
3. When stuck: Debugging help
4. End of day: Documentation updates

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