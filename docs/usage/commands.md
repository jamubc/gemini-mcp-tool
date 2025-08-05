# Commands Reference

Complete list of available commands and their usage.

## Slash Commands

### `/gemini-cli:analyze`
Analyze files or ask questions about code.

```
/gemini-cli:analyze @file.js explain this code
/gemini-cli:analyze @src/*.ts find security issues
/gemini-cli:analyze how do I implement authentication?
```

### `/gemini-cli:sandbox`
Execute code in a safe environment.

```
/gemini-cli:sandbox create a Python fibonacci generator
/gemini-cli:sandbox test this function: [code]
```

### `/gemini-cli:help`
Show help information and available tools.

```
/gemini-cli:help
/gemini-cli:help analyze
```

### `/gemini-cli:ping`
Test connectivity with Gemini.

```
/gemini-cli:ping
/gemini-cli:ping "Custom message"
```

## Command Structure

```
/gemini-cli:<tool> [options] <arguments>
```

- **tool**: The action to perform (analyze, sandbox, help, ping)
- **options**: Optional flags (coming soon)
- **arguments**: Input text, files, or questions

## Natural Language Alternative

Instead of slash commands, you can use natural language:

- "Use gemini to analyze index.js"
- "Ask gemini to create a test file"
- "Have gemini explain this error"

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

## Tips

1. **Start Simple**: Begin with single files before using patterns
2. **Be Specific**: Clear questions get better answers
3. **Use Context**: Include relevant files for better analysis
4. **Iterate**: Refine your queries based on responses