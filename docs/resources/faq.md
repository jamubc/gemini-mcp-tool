# Frequently Asked Questions

## General

### What is Gemini MCP Tool?
A bridge between Claude Desktop and Google's Gemini CLI, enabling you to use Gemini's large context directly within Claude.

### Why use this instead of Gemini directly?
- Integrated into your Claude workflow
- File analysis with @ syntax
- No context switching
- Leverages both AIs' strengths

### Is it free?
The tool is open source and free. You need:
- Gemini API key (has free tier)
- Claude Desktop (free)

## Setup

### Do I need to install Gemini CLI separately?
Yes, install it with:
```bash
pip install google-generativeai-cli
```

### Can I use this with Claude Code?
Yes! It works with both Claude Desktop and Claude Code.

### What Node.js version do I need?
Node.js v16.0.0 or higher.

## Usage

### What's the @ syntax?
It's how you reference files for analysis:
- `@file.js` - Single file
- `@src/*.js` - Multiple files
- `@**/*.ts` - All TypeScript files

### Can I analyze multiple files?
Yes! Gemini's 2M token context allows analyzing entire codebases.

### Which model should I use?
- **Daily work**: Gemini Flash
- **Large analysis**: Gemini Pro
- **Quick tasks**: Gemini Flash-8B

## Features

### What languages are supported?
All programming languages that Gemini supports:
- JavaScript/TypeScript
- Python
- Java
- Go
- C/C++
- And many more

### Can it execute code?
Yes, through sandbox mode - safely isolated execution.

### Does it work offline?
No, it requires internet to connect to Gemini API.

## Troubleshooting

### Why is it slow?
- Large files take time to process
- Try using Flash model for speed
- Check your internet connection

### Can I use my own models?
Currently supports official Gemini models only.

### Where are logs stored?
- macOS: `~/Library/Logs/Claude/`
- Windows: `%APPDATA%\Claude\Logs\`
- Linux: `~/.config/claude/logs/`

## Contributing

### How can I contribute?
Run these 3 commands:
```bash
./contribution/setup.sh
./contribution/branch.sh my-feature  
./contribution/submit.sh
```

### Do I need Git experience?
No! Our contribution tools handle Git for you.

### Can I add new features?
Yes! Check issues or propose your own ideas.

## Privacy & Security

### Is my code sent to Google?
Only when you explicitly use Gemini commands. Code is processed according to Google's privacy policy.

### Are API keys secure?
- Stored locally in your config
- Never committed to repository
- Only used for Gemini API calls

### Can I use this for proprietary code?
Check your organization's policies and Google's Gemini API terms of service.

## Advanced

### Can I customize the tools?
Yes, by forking and modifying the TypeScript source.

### Is there an API?
The tool implements MCP protocol. See API Reference for details.

### Can I use this in CI/CD?
Not recommended - designed for interactive development.

## More Questions?

- Check [Documentation](/)
- Browse [GitHub Issues](https://github.com/jamubc/gemini-mcp-tool/issues)
- Ask in [Discussions](https://github.com/jamubc/gemini-mcp-tool/discussions)