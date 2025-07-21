# Development Guide

Technical setup for contributing to Gemini MCP Tool.

## Setup

```bash
# Use automated setup
./contribution/setup.sh

# Or manual setup
git clone https://github.com/YOUR_USERNAME/gemini-mcp-tool
cd gemini-mcp-tool
npm install
```

## Build & Test

```bash
npm run build       # Compile TypeScript
npm run test        # Run tests
npm run lint        # Check code
npm run docs:dev    # Preview docs
```

## Architecture

- `src/index.ts` - Main MCP server
- `src/utils/` - Utility functions and helpers
- `contribution/` - Automation scripts
- `docs/` - Documentation

See [Quick Start](./quick-start) for the easy way!