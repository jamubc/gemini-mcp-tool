# File Analysis with @ Syntax

One of the most powerful features of Gemini MCP Tool is the ability to analyze files using the `@` syntax. File references are automatically processed and their contents are included in your prompts to Gemini.

## How It Works

When you use the `@` syntax, the MCP tool automatically:
1. **Detects file references** in your prompt (e.g., `@package.json`, `@src/app.js`)
2. **Reads file contents** securely with comprehensive validation and safety checks
3. **Substitutes the content** seamlessly before sending to Gemini CLI
4. **Processes multiple files concurrently** for optimal performance

**✅ Works Reliably**: The @ syntax file preprocessing has been comprehensively tested and works exactly as documented.

## Basic Usage

```
/gemini-cli:analyze @index.js explain this code
```
```
ask gemini to analyze the entire codebase and a comment block 
to the top of every script, explaining that script. Use flash.
```
```
Ask gemini to explain @index.js by reading the entire codebase first
```
```
Ask gemini to analyze @src/ and provide bug fixes
```
```
Ask gemini what the weather is like in new york
```
```
...then use gemini to review your recent modifications
```
## Multiple Files

Analyze multiple files in one request:
```
/gemini-cli:analyze @src/server.js @src/client.js how do these interact?
```
```
analyze @src/server.js @src/client.js and provide bug fixes
```

## Entire Directories

Analyze whole directories:
```
/gemini-cli:analyze @src/**/*.ts summarize the TypeScript architecture
```
```
analyze @main using gemini and determine the top 3 optimizations
```

## Why @ Syntax?

- **Familiar**: Both Claude and Gemini natively support it
- **Explicit**: Clear which files are being analyzed
- **Flexible**: Works with single files, multiple files, or patterns

## Best Practices

### 1. Be Specific
```
// Good
@src/auth/login.js explain the authentication flow

// Too vague
@src explain everything
```

### 2. Use Patterns Wisely
```
// Analyze all test files
@**/*.test.js are all tests passing?

// Analyze specific module
@modules/payment/*.js review payment logic
```

### 3. Combine with Questions
```
@package.json @src/index.js is this properly configured?
```

### 4. Speak Naturally
```
What does gemini think about that?
```
```
ask gemini to get a second opinion
```

## Security & Limitations

The file processing system includes comprehensive security and performance features:

### File Size Limits
- **Maximum file size**: 1MB per file
- **Smart rejection**: Large files are rejected with clear, actionable error messages
- **Memory protection**: Prevents memory issues and excessive token usage

### Path Security
- **Path traversal protection**: Robust prevention of access to system files outside your project
- **Safe path resolution**: Paths are safely resolved relative to your working directory
- **Extension validation**: Only allows common development file extensions (.js, .py, .md, .json, .ts, etc.)
- **Working directory boundary**: All file access is restricted to your project directory

### Enhanced Error Handling
- **Graceful degradation**: Failed file reads are replaced with informative error messages in the prompt
- **Detailed error reporting**: Clear, specific messages for debugging file access issues
- **Non-blocking errors**: One failed file doesn't prevent processing of other files
- **User-friendly feedback**: Errors include suggestions for resolution

### Performance Optimizations
- **Concurrent processing**: Multiple files processed simultaneously for better performance
- **Efficient memory usage**: Optimized file reading with memory management
- **Fast path validation**: Quick security checks before file operations

## Token Optimization

Gemini's massive context window allows analyzing entire codebases, saving claude tokens.

## Examples

### Code Review
```
@feature/new-api.js review this PR changes
```

### Documentation
```
@src/utils/*.js generate JSDoc comments
```

### Debugging
```
@error.log @src/handler.js why is this error occurring?
```