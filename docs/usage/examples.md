
# Real-World Examples

Practical examples of using Gemini MCP Tool in development workflows.

## Code Review

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

## Brainstorming

### Product Development Ideas
```
/gemini-cli:brainstorm prompt:"New features for our code editor" domain:software methodology:design-thinking existingContext:"VSCode-like editor with 50k users" ideaCount:10
```

### Marketing Campaign Generation
```
/gemini-cli:brainstorm prompt:"Launch campaign for new developer tool" domain:marketing constraints:"budget under $5000, 30-day timeline" methodology:scamper includeAnalysis:true
```

### Business Process Improvement
```
/gemini-cli:brainstorm prompt:"Streamline customer support workflow" domain:business existingContext:"Currently 4-hour response time, 3-person team" methodology:lateral ideaCount:8
```

### Technical Problem Solving
```
/gemini-cli:brainstorm prompt:"Optimize database performance" domain:software constraints:"Can't change schema, limited downtime" methodology:convergent existingContext:"PostgreSQL, 1M+ records, slow queries"
```

### Creative Content Ideas
```
/gemini-cli:brainstorm prompt:"Blog post topics for tech audience" domain:creative methodology:divergent ideaCount:15 includeAnalysis:false
```

### Research Project Planning
```
/gemini-cli:brainstorm prompt:"User research methods for mobile app" domain:research constraints:"Remote only, 2-week timeframe, budget $1000" methodology:design-thinking
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

## Tips for Effective Usage

1. **Start Broad, Then Narrow**: Begin with overview, then dive into specifics
2. **Combine Related Files**: Include configs with source code
3. **Ask Follow-up Questions**: Build on previous responses
4. **Use Specific Criteria**: Tell Gemini what to look for
5. **Iterate on Solutions**: Refine based on suggestions
