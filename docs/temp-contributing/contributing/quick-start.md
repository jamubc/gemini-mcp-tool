# 3-Command Contribution Workflow

Contributing has never been easier - just 3 commands!

## The Magic Commands

```bash
./contribution/setup.sh        # One-time setup
./contribution/branch.sh my-feature
# Make your changes...
./contribution/submit.sh       # Creates PR automatically!
```

That's it! No Git expertise required.

## What Happens Behind the Scenes

### 1. Setup (First Time Only)
- Installs dependencies automatically
- Forks the repository for you
- Configures Git remotes
- Authenticates with GitHub

### 2. Branch
- Creates a feature branch
- Syncs with latest changes
- Sets up tracking

### 3. Submit
- Formats your code
- Commits changes
- Pushes to your fork
- Opens a pull request

## Quick Example

Let's add a new feature:

```bash
# 1. Setup (skip if already done)
./contribution/setup.sh

# 2. Create your feature branch
cd gemini-mcp-tool-contrib
./contribution/branch.sh add-new-command

# 3. Make changes (you focus here!)
# ... edit files, add features ...

# 4. Submit when ready
./contribution/submit.sh
```

## Using Templates

Start even faster with templates:

```bash
./contribution/create.sh
# Choose: 1) new-tool  2) bug-fix  3) docs
```

## Made a Mistake?

No problem! Rollback anytime:

```bash
./contribution/undo.sh
# Choose what to undo
```

## Philosophy

> "Your ideas matter more than your Git skills"

We handle:
- ✅ Git commands
- ✅ GitHub process
- ✅ Code formatting
- ✅ PR templates

You handle:
- 💡 Great ideas
- 🛠️ Writing code
- 🎯 Solving problems

## Common Contributions

### Adding a Tool
```bash
./contribution/create.sh
# Select "new-tool"
# Fill in tool name and description
# Template created → just implement!
```

### Fixing a Bug
```bash
./contribution/branch.sh fix-gemini-timeout
# Fix the bug
./contribution/test.sh    # Verify fix
./contribution/submit.sh  # PR created!
```

### Improving Docs
```bash
./contribution/branch.sh update-readme
# Edit README.md
./contribution/submit.sh
```

## Tips for Success

1. **Start Small**: First PR can be a typo fix!
2. **Ask Questions**: Open an issue if unsure
3. **Test Locally**: Run `./contribution/test.sh`
4. **Don't Worry**: The tools handle Git complexity

## Next Steps

Ready to contribute?
1. Run `./contribution/setup.sh`
2. Pick an [issue](https://github.com/jamubc/gemini-mcp-tool/issues)
3. Start building!

See [Development Guide](/contributing/development) for technical details.