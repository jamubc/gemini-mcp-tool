# Natural Language Usage

You don't need to memorize commands - just ask naturally!

## How It Works

Claude Code understands when you want to use Gemini and automatically routes your request.

## Examples

### File Analysis
Instead of: `/gemini-cli:analyze @app.js explain`

Say:
- "Use gemini to explain app.js"
- "Ask gemini what this code does"
- "Have gemini analyze the main application file"

### Code Generation
Instead of: `/gemini-cli:sandbox create a web server`

Say:
- "Get gemini to create a simple web server"
- "I need gemini to write a REST API example"
- "Can gemini show me how to build an Express server?"

### Debugging
Instead of: `/gemini-cli:analyze @error.log @app.js debug`

Say:
- "Help me debug this error using gemini"
- "Gemini, why is my app crashing?"
- "Use gemini to find the bug in my code"

## Keywords That Trigger Gemini

Claude recognizes these patterns:
- "use gemini..."
- "ask gemini..."
- "gemini please..."
- "have gemini..."
- "get gemini to..."
- "with gemini..."

## Best Practices

### 1. Be Conversational
```
❌ /gemini-cli:analyze @config.json validate

✅ "Hey, can gemini check if my config.json is valid?"
```

### 2. Provide Context
```
❌ "analyze the bug"

✅ "Gemini, I'm getting a null pointer error in my auth handler, can you help?"
```

### 3. Specify Files Naturally
```
❌ @src/utils.js @src/helpers.js relationship

✅ "How do utils.js and helpers.js work together? Ask gemini."
```

## Common Patterns

### Code Review
- "Gemini, review my latest changes"
- "Use gemini to check my pull request"
- "Is this code production-ready? Ask gemini"

### Learning
- "Gemini, explain how React hooks work"
- "Can gemini show me Python best practices?"
- "I want to learn about async/await with gemini"

### Refactoring
- "Gemini, how can I make this code cleaner?"
- "Use gemini to refactor this function"
- "Help me optimize this algorithm with gemini"

## Mixing Commands and Natural Language

You can combine both approaches:

```
"I need to debug this" → /gemini-cli:analyze @app.js @error.log
```

Claude understands the context and uses the appropriate tool.

## Tips

1. **Just Ask**: Don't overthink the syntax
2. **Be Specific**: Include what you want to analyze
3. **Iterate**: Have a conversation with follow-up questions
4. **No Memorization**: Use whatever feels natural

Remember: The goal is to make AI assistance feel natural, not robotic!

