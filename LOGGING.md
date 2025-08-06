# Enhanced Logging System

The MCP server includes an enhanced logging system with configurable levels and structured output for better debugging and monitoring.

## Configuration

### Log Level (Optional)
Set the minimum log level via environment variable:
```bash
LOG_LEVEL=debug   # Show all logs (debug, info, warn, error)
LOG_LEVEL=info    # Show info, warn, error (default)
LOG_LEVEL=warn    # Show warn, error only
LOG_LEVEL=error   # Show error only
```

### Log Format (Optional)
Choose between traditional text logs or structured JSON:
```bash
LOG_FORMAT=json   # Structured JSON logs for parsing
# (default: text format)
```

## Usage Examples

### Development (Verbose)
```bash
LOG_LEVEL=debug npm run dev
```

### Production (Clean)
```bash
LOG_LEVEL=info npm start
```

### Production with JSON Logging
```bash
LOG_LEVEL=info LOG_FORMAT=json npm start
```

## Log Levels

- **DEBUG**: Detailed diagnostic info (tool invocations, command execution)
- **INFO**: General operational messages (chat creation, process completion)
- **WARN**: Important notices (cleanup results, potential issues)
- **ERROR**: Error conditions (failures, exceptions)

## Structured JSON Format

When `LOG_FORMAT=json`, logs are output as:
```json
{
  "timestamp": "2024-01-11T14:35:22.123Z",
  "level": "INFO", 
  "service": "gemini-mcp",
  "message": "Chat 1 created by test-agent",
  "data": {...}
}
```

## Backward Compatibility

All existing logging calls continue to work unchanged. The enhanced system maintains full backward compatibility with the previous implementation.

## Runtime Configuration

```javascript
import { Logger } from './src/utils/logger.js';

// Change log level at runtime
Logger.setLogLevel('debug');

// Check current configuration
const config = Logger.getConfig();
console.log(config); // { level: 'debug', structured: false }
```