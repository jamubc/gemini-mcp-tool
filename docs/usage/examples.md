# Real-World Examples

Practical examples of using Gemini MCP Tool in development workflows.

## Code Review

### Quick Code Search
```
# Find TODO comments across codebase
/gemini-cli:search find "TODO" in @src/**/*.js

# Count console.log statements
/gemini-cli:search count "console.log" in @src/*.js

# Search for specific patterns
/gemini-cli:search search /function\s+\w+/ in @src/utils/*.js
```

### Reviewing a Pull Request
```
/gemini-cli:analyze @feature/new-api/*.js review these changes for:
- Security issues
- Performance concerns  
- Code style consistency
- Missing error handling
```

### Pre-commit Check
```
"Gemini, check my staged changes before I commit"
```

## Debugging

### Finding Error Messages
```
# Fast search for specific errors
/gemini-cli:search find "undefined is not a function" in @logs/*.log

# Count error occurrences
/gemini-cli:search count "ERROR" in @logs/application.log

# Search for function calls
/gemini-cli:search search /console\.log/ in @src/**/*.js
```

### Analyzing Error Logs
```
/gemini-cli:analyze @logs/error.log @src/api/handler.js 
why am I getting "undefined is not a function" errors?
```

### Stack Trace Analysis
```
@crash-report.txt gemini, what caused this crash and how do I fix it?
```

## Architecture Analysis

### Understanding a New Codebase
```
/gemini-cli:analyze @package.json @src/**/*.js @README.md
give me an overview of this project's architecture
```

### Dependency Analysis
```
@package.json @package-lock.json are there any security vulnerabilities or outdated packages?
```

## Documentation

### Generating API Docs
```
/gemini-cli:analyze @routes/api/*.js generate OpenAPI documentation for these endpoints
```

### README Creation
```
@src/**/*.js @package.json create a comprehensive README for this project
```

## Testing

### Writing Tests
```
/gemini-cli:analyze @src/utils/validator.js write comprehensive Jest tests for this module
```

### Test Coverage Analysis
```
@src/**/*.js @test/**/*.test.js what's not being tested?
```

## Refactoring

### Code Optimization
```
/gemini-cli:analyze @src/data-processor.js this function is slow, how can I optimize it?
```

### Pattern Implementation
```
@src/services/*.js refactor these to use the Repository pattern
```

## Learning

### Understanding Concepts
```
/gemini-cli:sandbox show me how OAuth 2.0 works with a working example
```

### Best Practices
```
@src/auth/*.js does this follow security best practices?
```

## Migration

### Framework Upgrade
```
/gemini-cli:analyze @package.json @src/**/*.js 
what changes are needed to upgrade from Express 4 to Express 5?
```

### Language Migration
```
@legacy/script.js convert this to TypeScript with proper types
```

## Security Audit

### Vulnerability Scan
```
/gemini-cli:analyze @src/**/*.js @package.json 
perform a security audit and identify potential vulnerabilities
```

### OWASP Check
```
@src/api/**/*.js check for OWASP Top 10 vulnerabilities
```

## Performance Analysis

### Bottleneck Detection
```
/gemini-cli:analyze @src/routes/*.js @src/middleware/*.js
identify performance bottlenecks in the request pipeline
```

### Memory Leaks
```
@src/**/*.js look for potential memory leaks or inefficient patterns
```

## Real Project Example

### Full Stack Review
```bash
# 1. Architecture overview
/gemini-cli:analyze @package.json @src/index.js @client/App.jsx 
explain how the frontend and backend connect

# 2. API Security
/gemini-cli:analyze @routes/api/*.js @middleware/auth.js 
review API security implementation

# 3. Database optimization
/gemini-cli:analyze @models/*.js @db/queries/*.sql 
suggest database optimizations

# 4. Frontend performance
/gemini-cli:analyze @client/**/*.jsx @client/**/*.css 
how can I improve frontend performance?

# 5. Test coverage
/gemini-cli:analyze @src/**/*.js @test/**/*.test.js 
what critical paths lack test coverage?
```

## Quick Text Search Examples

### Development Workflow
```
# Find all imports of a specific module
/gemini-cli:search find "import" in @src/*.js

# Count function definitions
/gemini-cli:search count "function" in @src/**/*.js

# Find hardcoded strings
/gemini-cli:search find "localhost" in @config/*.json

# Search for specific patterns
/gemini-cli:search search /API_KEY/ in @src/*.js
```

### Code Quality Checks
```
# Find console statements left in code
/gemini-cli:search find "console." in @src/**/*.js

# Count test files
/gemini-cli:search count "test" in @**/*.test.js

# Find commented code
/gemini-cli:search search /\/\*.*\*\// in @src/*.js
```

### Documentation Review
```
# Find missing documentation
/gemini-cli:search find "TODO" in @**/*.md

# Count README files
/gemini-cli:search count "README" in @**/README.md

# Find broken links
/gemini-cli:search search /\[.*\]\(.*\)/ in @docs/*.md
```

## Current Information & Web Research

### Real-Time News Search
```bash
# Search for current news on specific topics
/gemini-cli:WebOperations operation:search query:"UBCO Kelowna news" numResults:10 timeRange:month

# Find latest tech developments
/gemini-cli:WebOperations operation:search query:"AI developments 2024" timeRange:week

# Search for specific company news
/gemini-cli:WebOperations operation:search query:"Microsoft quarterly earnings" timeRange:day
```

### Research & Fact-Checking
```bash
# Verify current information
/gemini-cli:WebOperations operation:search query:"latest COVID guidelines Canada" timeRange:month

# Research market trends
/gemini-cli:WebOperations operation:search query:"cryptocurrency market trends" timeRange:week

# Check recent updates
/gemini-cli:WebOperations operation:search query:"Node.js latest version features" timeRange:month
```

### Content Analysis
```bash
# Fetch and analyze web content
/gemini-cli:WebOperations operation:fetch url:https://example.com/article extractType:summary

# Extract structured data from documentation
/gemini-cli:WebOperations operation:fetch url:https://docs.example.com/api extractType:structured

# Get specific content sections
/gemini-cli:WebOperations operation:fetch url:https://example.com/page selector:".main-content" maxLength:3000
```

### Competitive Analysis
```bash
# Research competitors
/gemini-cli:WebOperations operation:search query:"React UI library alternatives 2024" numResults:8

# Check documentation updates
/gemini-cli:WebOperations operation:fetch url:https://competitor.com/changelog extractType:summary
```

## Agent-to-Agent Delegation

Leverage Claude-to-Gemini delegation for complex, context-heavy tasks that benefit from Gemini's 2M token window.

### Story Enhancement Workflow
Delegate large narrative file improvements while preserving creative intent:
```bash
/gemini-cli:agent-delegate {
  "task": {
    "type": "enhance",
    "description": "Polish story.md - improve narrative flow, fix grammar, enhance descriptions while preserving author voice",
    "files": ["story.md"],
    "requirements": [
      "Preserve original tone and voice",
      "Fix grammar and spelling errors",
      "Enhance scene descriptions",
      "Improve dialogue naturalism",
      "Maintain story structure"
    ],
    "context_boundary": "direct",
    "field_integrity": "merge"
  },
  "protocol": "pareto-lang",
  "agent_metadata": {
    "priority": "high"
  }
}
```

### Multi-File Code Refactoring
Delegate complex refactoring across multiple files with context preservation:
```bash
/gemini-cli:agent-delegate {
  "task": {
    "type": "transform",
    "description": "Refactor authentication system to use JWT tokens instead of sessions",
    "files": ["src/auth/*.js", "src/middleware/auth.js", "src/routes/api/*.js"],
    "requirements": [
      "Maintain backward compatibility",
      "Add proper error handling",
      "Update all affected endpoints",
      "Preserve existing user data",
      "Add comprehensive JSDoc comments"
    ],
    "context_boundary": "mediated",
    "field_integrity": "reconstruct"
  },
  "protocol": "context-engineering"
}
```

### Documentation Generation
Generate comprehensive docs from large codebases:
```bash
/gemini-cli:agent-delegate {
  "task": {
    "type": "generate",
    "description": "Create API documentation from Express routes",
    "files": ["src/routes/**/*.js", "src/models/*.js", "src/middleware/*.js"],
    "requirements": [
      "OpenAPI 3.0 specification format",
      "Include request/response examples",
      "Document authentication requirements",
      "Generate schema from Mongoose models",
      "Add rate limiting information"
    ],
    "context_boundary": "direct",
    "field_integrity": "preserve"
  },
  "agent_metadata": {
    "session_id": "api-docs-gen-v1"
  }
}
```

### Architecture Analysis Pipeline
Analyze complex systems with structured delegation:
```bash
/gemini-cli:agent-delegate {
  "task": {
    "type": "analyze",
    "description": "Perform comprehensive architecture review of microservices",
    "files": ["services/*/package.json", "services/*/src/index.js", "docker-compose.yml", "k8s/*.yaml"],
    "requirements": [
      "Identify service dependencies",
      "Check for circular dependencies",
      "Analyze scaling bottlenecks",
      "Review security boundaries",
      "Suggest improvements with migration path"
    ],
    "context_boundary": "isolated",
    "field_integrity": "preserve"
  },
  "protocol": "context-engineering",
  "agent_metadata": {
    "priority": "high",
    "target_agent": "gemini-1.5-pro"
  }
}
```

### Test Generation with Framework Constraints
Generate comprehensive test suites with specific requirements:
```bash
/gemini-cli:agent-delegate {
  "task": {
    "type": "generate",
    "description": "Create Jest test suite for payment processing module",
    "files": ["src/payments/*.js", "src/payments/types.ts"],
    "requirements": [
      "Use Jest with TypeScript",
      "Mock external payment APIs",
      "Test error scenarios",
      "Include integration tests",
      "Achieve 90%+ coverage",
      "Follow AAA pattern"
    ],
    "context_boundary": "direct",
    "field_integrity": "preserve"
  }
}
```

### Comparing Agent-Delegate vs Field-Aware-Gemini
- **Use agent-delegate when**:
  - Task requires complex orchestration
  - Multiple files need coordinated changes
  - You need structured response format
  - Task has specific constraints/requirements
  - You want audit trail of delegation

- **Use field-aware-gemini when**:
  - Simple file-to-Gemini operations
  - Quick analysis without complex requirements
  - Direct file processing without metadata
  - Single-file operations

## Tips for Effective Usage

1. **Choose the Right Tool**: Use search for pattern matching, analyze for understanding, WebOperations for current information, agent-delegate for complex multi-file tasks
2. **Start Broad, Then Narrow**: Begin with overview, then dive into specifics
3. **Combine Related Files**: Include configs with source code
4. **Ask Follow-up Questions**: Build on previous responses
5. **Use Specific Criteria**: Tell Gemini what to look for
6. **Iterate on Solutions**: Refine based on suggestions
7. **Time-Sensitive Queries**: Use WebOperations for current events, market data, or recent updates
8. **Delegate Complex Tasks**: Use agent-delegate for large context operations that exceed efficient Claude processing