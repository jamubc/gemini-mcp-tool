# Troubleshooting

Common issues and their solutions. Click any issue below to see the detailed solution.

<script setup>
import TroubleshootingModal from '../.vitepress/components/TroubleshootingModal.vue'
</script>

## Installation Issues

<TroubleshootingModal 
  title='"Command not found: gemini"'
  preview="The Gemini CLI is not installed or not in your PATH"
>

The Gemini CLI is not installed. Install it first:
```bash
npm install -g @google/gemini-cli
```

After installation, verify it works:
```bash
gemini --version
```

If you still get "command not found", restart your terminal or add npm global bin to your PATH.

</TroubleshootingModal>

<TroubleshootingModal 
  title="Windows NPX Installation Issues"
  preview='Error: unknown option "-y" when using Claude Code on Windows'
>

**Problem**: `error: unknown option '-y'` when using Claude Code on Windows

**Solution**: Use one of these alternative installation methods:

```bash
# Method 1: Install globally first
npm install -g gemini-mcp-tool
claude mcp add gemini-cli -- gemini-mcp-tool

# Method 2: Use --yes instead of -y
claude mcp add gemini-cli -- npx --yes gemini-mcp-tool

# Method 3: Remove the -y flag entirely
claude mcp add gemini-cli -- npx gemini-mcp-tool
```

</TroubleshootingModal>

<TroubleshootingModal 
  title='"MCP server not responding"'
  preview="Claude Desktop can't connect to the MCP server"
>

**Step-by-step solution**:

1. **Check your Claude Desktop config file location**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Verify JSON syntax is correct**
   - Use a JSON validator online
   - Check for missing commas, brackets, or quotes

3. **Restart Claude Desktop completely**
   - Quit completely (Cmd+Q on Mac)
   - Wait 5 seconds
   - Restart Claude Desktop

4. **Check logs for detailed errors**
   - macOS: `~/Library/Logs/Claude/`
   - Windows: `%APPDATA%\Claude\logs\`

</TroubleshootingModal>

## Connection Issues

<TroubleshootingModal 
  title='"Failed to connect to Gemini"'
  preview="API connection issues or authentication problems"
>

**Step-by-step solution**:

1. **Verify your API key is configured**:
   ```bash
   gemini config get api_key
   ```

2. **Check your internet connection**
   - Try accessing google.com in your browser
   - Test with a simple request: `gemini "test"`

3. **Verify firewall settings**
   - Ensure your firewall isn't blocking requests to Google APIs
   - Check corporate proxy settings if applicable

4. **Test basic connectivity**:
   ```bash
   /gemini-cli:ping "test"
   ```

5. **If still failing, regenerate your API key**
   - Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create a new API key
   - Update your config: `gemini config set api_key YOUR_NEW_KEY`

</TroubleshootingModal>

<TroubleshootingModal 
  title='"Timeout errors"'
  preview="Requests taking too long or timing out"
>

**Common causes and solutions**:

1. **Large files naturally take time** - Be patient with large file analysis

2. **Switch to Gemini Flash for faster responses**:
   ```bash
   gemini config set model gemini-2.5-flash
   ```

3. **Break up large requests into smaller chunks**:
   ```bash
   # Instead of analyzing entire file
   /gemini-cli:analyze @large-file.js "explain the main function"
   
   # Target specific sections
   /gemini-cli:analyze @large-file.js "explain lines 50-100"
   ```

4. **For very large codebases, the tool prevents timeouts automatically**:
   - Progress updates keep the connection alive
   - Clear status messages show processing is active
   - No manual configuration needed

</TroubleshootingModal>

<TroubleshootingModal 
  title='"MCP error -32000: Connection closed"'
  preview="Server fails to start and connection closes immediately (Claude Code)"
>

**Common causes**:

1. **Node.js version compatibility** - Ensure Node.js ≥ v16.0.0
2. **Gemini CLI not installed** - Install with `npm install -g @google/gemini-cli`
3. **API key not configured** - Run `gemini config set api_key YOUR_API_KEY`
4. **PATH issues** - Restart terminal after installing Node.js/npm

**Debug steps**:

```bash
# 1. Check Node.js version
node --version

# 2. Test Gemini CLI directly
gemini "Hello"

# 3. Reinstall if needed
npm uninstall -g gemini-mcp-tool
npm install -g gemini-mcp-tool

# 4. Verify Claude Code can find the command
claude mcp list
```

**Still not working?** Check the Claude Desktop logs for detailed error messages:
- macOS: `~/Library/Logs/Claude/`
- Windows: `%APPDATA%\Claude\logs\`

</TroubleshootingModal>

### "Gemini gets cut off" / Early Termination
**Problem**: Responses appear truncated or Claude reports "Gemini was thinking but got cut off"

**Causes**:
- Large codebase analysis taking longer than expected
- Complex operations requiring extended processing time
- Client connection management issues

**Solutions**:
```bash
# The tool automatically prevents timeouts with progress updates
# You'll see messages like:
# "🔍 Starting analysis (may take 5-15 minutes for large codebases)"
# "🧠 Gemini is analyzing your request..."

# Use faster Flash model for large requests
/gemini-cli:analyze -m gemini-2.5-flash @large-file.js

# Break up large analysis into smaller chunks
/gemini-cli:analyze @specific-function.js explain this function
```

## File Analysis Issues

### "File not found"
- Use absolute paths when possible
- Check file permissions
- Verify working directory

### "Token limit exceeded" / "Response exceeds maximum allowed tokens (25000)"
**Problem**: Error shows response of 45,735 tokens even for small prompts

**Root cause**: Model-specific bug in `gemini-2.5-pro` (default model)

**Working models**:
- ✅ `gemini-2.5-flash` - Works perfectly
- ❌ `gemini-2.5-pro` - Always returns 45k+ tokens
- ❌ `gemini-2.0-flash-thinking` - Model not found

**Solutions**:
```bash
# Use Flash model (recommended)
/gemini-cli:analyze -m gemini-2.5-flash "your prompt"

# For large contexts, break into smaller chunks
/gemini-cli:analyze -m gemini-2.5-flash @file1.js @file2.js

# Alternative: Use Pro for larger contexts when it works
/gemini-cli:analyze -m gemini-2.5-pro "brief analysis only"
```

## Configuration Issues

### Changes not taking effect
1. Save config file
2. Completely quit Claude Desktop
3. Restart Claude Desktop
4. Verify with `/gemini-cli:help`

### Environment variables not working
```bash
# Check current settings
echo $GEMINI_MODEL
echo $GOOGLE_GENERATIVE_AI_API_KEY
```

### Configurable Timeout for Large Codebases
**Problem**: Default MCP client timeout too short for large analysis

**Root Cause**: Claude Desktop/Claude Code has a hard-coded timeout that cannot be overridden by environment variables.

**Solution**: The tool now automatically sends progress updates to prevent timeouts
```bash
# The tool will automatically send progress messages like:
# "🔍 Starting analysis (may take 5-15 minutes for large codebases)"
# "🧠 Gemini is analyzing your request..."
# "📊 Processing files and generating insights..."
# "⏳ Still processing... Gemini is working on your request"
```

**What happens during long operations**:
- Progress updates every 25 seconds during active processing
- Backup heartbeat every 20 seconds to ensure connection stays alive
- Clear status messages showing the tool is working
- Automatic completion notification when done

**For very large codebases** (10,000+ files):
- Consider breaking analysis into smaller chunks
- Use more specific file patterns with `@` syntax
- Switch to `gemini-2.5-flash` for faster processing
```

## Debug Mode

Enable debug logging:
```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "gemini-mcp",
      "env": {
        "DEBUG": "true"
      }
    }
  }
}
```

## Getting Help

1. Check [GitHub Issues](https://github.com/jamubc/gemini-mcp-tool/issues)
2. Enable debug mode
3. Collect error logs
4. Open a new issue with details

## Model-Specific Issues

### Gemini-2.5-Pro Issues
**Known problems**:
- Always returns 45,735 token responses (bug)
- May cause "response exceeds limit" errors
- Not recommended for file analysis

**Workaround**: Use Gemini Flash instead
```bash
/gemini-cli:analyze -m gemini-2.5-flash "your prompt"
```

### Model Recommendations
| **Use Case** | **Recommended Model** | **Reason** |
|--------------|----------------------|------------|
| File analysis | `gemini-2.5-flash` | Faster, stable responses |
| Code review | `gemini-2.5-flash` | Good balance of speed/quality |
| Large codebase | `gemini-2.5-flash` | Better timeout handling |
| Quick questions | `gemini-2.5-flash` | Fast responses |

## Quick Fixes

### Reset Everything
```bash
# Remove and reinstall
npm uninstall -g gemini-mcp-tool
npm install -g gemini-mcp-tool

# Reset Gemini CLI
gemini config reset
gemini config set api_key YOUR_API_KEY
```

### Test Basic Functionality
```bash
# Test Gemini CLI
gemini "Hello"

# Test MCP Tool with Flash model
/gemini-cli:ping

# Test file analysis with working model
/gemini-cli:analyze -m gemini-2.5-flash @README.md summarize
```

## Platform-Specific Issues

### Windows 11
- **NPX flag issues**: Use `--yes` instead of `-y`
- **Path problems**: Restart terminal after Node.js installation
- **Connection issues**: Ensure Windows Defender isn't blocking Node.js

### macOS
- **Permission issues**: Use `sudo` if npm install fails
- **Terminal restart**: Required after installing dependencies

### Linux
- **Node.js version**: Install via NodeSource for latest version
- **npm permissions**: Configure npm to avoid sudo usage