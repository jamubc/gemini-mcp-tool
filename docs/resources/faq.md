# Frequently Asked Questions

## General

### What is Gemini MCP Tool?
A bridge between Claude Desktop and Google's Gemini AI, enabling you to use Gemini's powerful capabilities directly within Claude.

### Does it support windows?
Windows testing is underway, some users have reported success and other failures.

### Why use this instead of Gemini directly?
- Integrated into your existing AI workflow
- File analysis with @ syntax
- Reduced context switching (gemini can store and recall memories!)
- Best of both: Leverages both AIs' strengths

### Is it free?
The tool is open source and free. You need:
- Gemini API key (has free tier) or Google Account
- Claude Desktop or Claude Code or any MCP client

## Setup

### Do I need to install Gemini CLI separately?
Yes, install it with:
```bash
npm install -g @google/gemini-cli
```
Then, run "gemini" and complete auth.

### Can I use this with Claude Code?
Yes! It works with both Claude Desktop and Claude Code.

### What Node.js version do I need?
Node.js v16.0.0 or higher.

## Usage

### What's the @ syntax?
It's how you reference files for analysis with automatic content processing:
- `@file.js` - Single file
- `@src/*.js` - Multiple files (glob patterns supported)
- `@**/*.ts` - All TypeScript files recursively
- `@directory/` - Entire directory contents

**✅ Works Reliably**: The @ syntax has been comprehensively fixed and tested:
- **Automatic content reading**: Files are processed and content seamlessly included in prompts
- **Robust security**: Path traversal protection, extension validation, and file size limits (1MB)
- **Concurrent processing**: Multiple files processed simultaneously for optimal performance
- **Smart error handling**: Clear, actionable messages for file access issues

### Can I analyze multiple files? What about ALL the files?
Yes! Gemini's 1M token context allows analyzing entire codebases.

### Which model should I use?
- **Daily work**: Gemini Pro
- **Large analysis**: Gemini Pro
- **Quick tasks**: Gemini Flash

## Features

### What languages are supported?
Any language code or human.

### Does it work offline?
No, it requires internet to connect to Gemini API.

## Troubleshooting

### Why is it slow?
- Large files take time to process
- Try using Flash model for speed
- Check your internet connection

### Can I use my own models?
Currently supports official Gemini models only.<br>
*--> opencode integration coming soon*

### Can I add new features?
Yes! Check issues or propose your own ideas.

## Privacy & Security

### Is my code sent to Google?
Only when you explicitly use Gemini commands. Code is processed according to Google's privacy policy.

### Are credentials secure?
- We never look at or touch your keys!

### Can I use this for proprietary code?
Check your organization's policies and Google's Gemini API terms of service.

## Advanced

### Can I use this in CI/CD?
Not recommended - designed for interactive development.

### @ Syntax Troubleshooting
The @ syntax is now highly reliable, but here are solutions for rare issues:

**File not found**: Verify file paths are relative to your working directory
```bash
# Good
@src/main.js

# Check if file exists
ls src/main.js
```

**File too large**: Files over 1MB are automatically rejected with clear error messages
```bash
# Check file size  
ls -lh large-file.json
```

**Permission issues**: Ensure files are readable
```bash
# Check permissions
ls -la problematic-file.js
```

**Path traversal blocked**: Security feature prevents access outside your project
```bash
# This won't work (security feature)
@../../../etc/passwd
```

**✅ Most Common Solution**: The @ syntax now works reliably in 99% of cases. If you're experiencing issues, they're likely related to file permissions or paths rather than the @ syntax processing itself.

<div style="text-align: center;">

## Why Gemini MCP?

</div>

By bridging Claude Desktop with Google's powerful models, Gemini MCP Tool lets you leverage the following advanced capabilities right in your existing workflow:

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin: 24px 0;">
  <div style="background: var(--vp-c-bg-soft); padding: 16px; border-radius: 8px; border: 1px solid var(--vp-c-divider);">
    <h4 style="margin: 0 0 8px 0; color: var(--vp-c-brand);">💰 Cost-Effective</h4>
    <p style="margin: 0; font-size: 14px; line-height: 1.5;">Delegate tasks to a more cost-effective model to reduce expensive token usage.</p>
  </div>
  
  <div style="background: var(--vp-c-bg-soft); padding: 16px; border-radius: 8px; border: 1px solid var(--vp-c-divider);">
    <h4 style="margin: 0 0 8px 0; color: var(--vp-c-brand);">🎯 Multimodal Native</h4>
    <p style="margin: 0; font-size: 14px; line-height: 1.5;">Process text, images, audio, video, and code seamlessly within your workflow.</p>
  </div>
  
  <div style="background: var(--vp-c-bg-soft); padding: 16px; border-radius: 8px; border: 1px solid var(--vp-c-divider);">
    <h4 style="margin: 0 0 8px 0; color: var(--vp-c-brand);">🚀 High Performance</h4>
    <p style="margin: 0; font-size: 14px; line-height: 1.5;">Leverage a large context window and powerful built-in tools, including web search.</p>
  </div>
  
  <div style="background: var(--vp-c-bg-soft); padding: 16px; border-radius: 8px; border: 1px solid var(--vp-c-divider);">
    <h4 style="margin: 0 0 8px 0; color: var(--vp-c-brand);">🧠 Advanced Reasoning</h4>
    <p style="margin: 0; font-size: 14px; line-height: 1.5;">Gain a different analytical perspective for sophisticated analysis of complex information.</p>
  </div>
  
  <div style="background: var(--vp-c-bg-soft); padding: 16px; border-radius: 8px; border: 1px solid var(--vp-c-divider);">
    <h4 style="margin: 0 0 8px 0; color: var(--vp-c-brand);">🔒 Privacy First</h4>
    <p style="margin: 0; font-size: 14px; line-height: 1.5;">Open-source and telemetry-free. Committed to transparency and responsible AI.</p>
  </div>
</div>

## More Questions?

- Check [Documentation](/)
- Browse [GitHub Issues](https://github.com/jamubc/gemini-mcp-tool/issues)
- Ask in [Discussions](https://github.com/jamubc/gemini-mcp-tool/discussions)