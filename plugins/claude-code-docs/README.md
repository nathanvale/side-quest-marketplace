# Claude Code Documentation

Auto-updating Claude Code documentation plugin that fetches docs directly from code.claude.com.

## Features

- **Direct Fetching**: Pulls documentation directly from code.claude.com via sitemap
- **Always Current**: Gets latest docs from the official source
- **Smart Updates**: SHA256 hashing detects changes, only fetches what's new
- **Search Skill**: Claude can automatically search docs when you ask about Claude Code
- **Help Command**: Quick lookup with `/claude-code-docs:help [topic]`

## Commands

### `/claude-code-docs:help [topic]`

Look up Claude Code documentation. Ask questions or search by topic.

```bash
/claude-code-docs:help hooks
/claude-code-docs:help how to create a skill
/claude-code-docs:help mcp servers
```

Run without arguments to see all available topics.

### `/claude-code-docs:update`

Manually fetch/update documentation from code.claude.com:

```bash
/claude-code-docs:update
```

## Automatic Updates

The plugin includes a PreToolUse hook that automatically checks for updates every 24 hours. When triggered, it runs the update process in the background without blocking your work.

## Skill: `claude-code-docs`

The plugin includes a skill that automatically activates when you ask about Claude Code features. Just ask naturally:

- "How do I create a hook in Claude Code?"
- "What MCP servers are available?"
- "How do I configure permissions?"

Claude will search the local docs and answer from the official documentation.

## Output Structure

```
plugins/claude-code-docs/docs/
├── INDEX.md                   # Navigation index
├── manifest.json              # Change tracking
├── overview.md                # Individual doc files
├── hooks.md
├── hooks-guide.md
├── cli-reference.md
├── common-workflows.md
└── ... (46 total docs)
```

## Documentation Source

This plugin fetches documentation directly from [code.claude.com](https://code.claude.com) using the official sitemap.

## Development

### Running Updates

```bash
bun run scripts/cli.ts
```

Or with options:

```bash
# Force re-fetch all files
bun run scripts/cli.ts --force

# Show help
bun run scripts/cli.ts --help
```

## License

MIT
