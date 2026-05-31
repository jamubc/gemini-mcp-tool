# Frequently Asked Questions

## General

### What is Gemini MCP Tool?
A bridge between Claude Desktop and Google's Gemini AI, enabling you to use Gemini's powerful capabilities directly within Claude.

### Does it support windows?
Yes. v1.2.0 adds robust Windows executable resolution (`GEMINI_CLI_PATH`, `.cmd` shim detection), hardened `cmd.exe` argument quoting, and `windowsHide` to suppress console popups.

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
Node.js v18.0.0 or higher.

## Usage

### What's the @ syntax?
It's how you reference files for analysis:
- `@file.js` - Single file
- `@src/*.js` - Multiple files
- `@**/*.ts` - All TypeScript files
- *new:* `file:index.html` now works, fully bypassing @ integration

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
Yes — set `GEMINI_MCP_APPROVAL_MODE=yolo` (or `plan` for read-only) to avoid interactive approval prompts. Combine with `GEMINI_MCP_TIMEOUT_MS` for a hard time limit.

### What is approval mode?
Approval mode controls how much autonomy Gemini has. By default, no mode is forced (plain Q&A). Set `approvalMode: "plan"` for a read-only planner, `"yolo"` to auto-approve everything, or `"auto_edit"` to auto-approve edits only. See [Configuration](/concepts/configuration).

### What is the agy backend?
Antigravity CLI (`agy`) is Google's successor to Gemini CLI. Set `GEMINI_MCP_BACKEND=agy` to try it. It's experimental — print mode is Flash-only and stdout is recovered from transcript files. See [Configuration](/concepts/configuration#backends).

### Can I have multi-turn conversations?
Yes — pass `sessionId` to start a named session, then `resume` with the same id (or `"latest"`) in a follow-up call. This uses Gemini's native `--session-id` / `--resume` flags.

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