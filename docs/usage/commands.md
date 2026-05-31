# Commands Reference

Complete list of available tools and their arguments.

## Tools

### `ask-gemini`

The primary tool — send a prompt to Gemini and get a response.

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `prompt` | string | *(required)* | Your analysis request. Use `@` to include files |
| `model` | string | `gemini-2.5-pro` | Model to use (e.g. `gemini-2.5-flash`) |
| `sandbox` | boolean | `false` | Run in isolated sandbox (`-s` flag) |
| `changeMode` | boolean | `false` | Structured edit mode for Claude to apply |
| `approvalMode` | string | *(unset)* | `default` / `auto_edit` / `yolo` / `plan` |
| `sessionId` | string | — | Start/tag a conversation session |
| `resume` | string | — | Resume a prior session by id, or `"latest"` |
| `chunkIndex` | number | — | Which chunk to return (1-based, for changeMode) |
| `chunkCacheKey` | string | — | Cache key for continuation (changeMode) |

```
/gemini-cli:ask-gemini @file.js explain this code
/gemini-cli:ask-gemini @src/*.ts find security issues
```

### `brainstorm`

Structured ideation with selectable methodology frameworks.

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `prompt` | string | *(required)* | Brainstorming challenge or question |
| `model` | string | `gemini-2.5-pro` | Model to use |
| `approvalMode` | string | *(unset)* | Gemini approval mode |
| `methodology` | string | `auto` | `divergent` / `convergent` / `scamper` / `design-thinking` / `lateral` / `auto` |
| `domain` | string | — | Domain context (e.g. `software`, `business`) |
| `constraints` | string | — | Known limitations or boundaries |
| `existingContext` | string | — | Background info to build upon |
| `ideaCount` | number | `12` | Target number of ideas |
| `includeAnalysis` | boolean | `true` | Include feasibility/impact scoring |

```
/gemini-cli:brainstorm how can we improve our onboarding flow?
```

### `Help`

Show Gemini CLI help information.

```
/gemini-cli:Help
```

### `ping`

Test connectivity with an echo.

```
/gemini-cli:ping
/gemini-cli:ping "Custom message"
```

## Natural Language Alternative

Instead of slash commands, you can use natural language:

- "Use gemini to analyze index.js"
- "Ask gemini to create a test file"
- "Have gemini explain this error"
- "Brainstorm ideas for the new feature using gemini"

## File Patterns

### Single File
```
@README.md
@src/index.js
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

::: danger Security
`@file` references are restricted to the project directory. Paths like `@../secret.txt`, `@~/.ssh/id_rsa`, or `@/etc/passwd` are rejected (CVE-2026-0755).
:::

## Advanced Usage

### Approval Mode

Control Gemini's autonomy per-call:
```
ask gemini with approvalMode "plan" to review the architecture
ask gemini with approvalMode "yolo" and sandbox to run this test suite
```

### Multi-turn Sessions

Continue a conversation across multiple calls:
```
ask gemini with sessionId "review-1" to review the auth module
ask gemini with resume "review-1" to now suggest improvements
ask gemini with resume "latest" to continue where we left off
```

### Change Mode

Get structured edit suggestions that Claude can apply directly:
```
ask gemini in changeMode to refactor @src/utils.js for readability
```

## Tips

1. **Start Simple**: Begin with single files before using patterns
2. **Be Specific**: Clear questions get better answers
3. **Use Context**: Include relevant files for better analysis
4. **Iterate**: Refine your queries based on responses