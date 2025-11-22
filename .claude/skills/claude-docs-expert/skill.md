# Claude Docs Expert Skill

A comprehensive Claude skill that provides seamless access to Claude Code documentation with sync
status checking, topic browsing, and recent changes tracking.

## Description

The `claude-docs-expert` skill is a wrapper around the Claude Code documentation helper script that
provides structured access to official Claude Code documentation. It enables users and other skills
to easily browse available topics, read specific documentation sections, check sync status, and stay
updated with recent changes.

## Features

- **Topic Browsing**: List all available documentation topics
- **Specific Documentation**: Read detailed documentation for specific topics
- **Sync Status**: Check documentation freshness and sync status
- **Recent Changes**: View what's new in Claude Code documentation
- **Skill Integration**: Can be invoked by other Claude skills
- **Error Handling**: Comprehensive error checking and user-friendly messages

## Installation

The skill is located at `~/.claude/skills/claude-docs-expert/` and requires the Claude Code
documentation helper to be installed at `~/.claude-code-docs/claude-docs-helper.sh`.

### Prerequisites

- Bash 4.0 or higher
- Claude Code documentation helper script installed and executable
- Read and execute permissions on the skill directory

## Usage Examples

### Basic Commands

```bash
# List all available documentation topics
/docs

# Read specific documentation
/docs mcp
/docs artifacts
/docs tools

# Check overall sync status
/docs -t

# Check freshness then read specific topic
/docs -t mcp
/docs -t artifacts

# Show recent documentation changes
/docs whats new
/docs "what's new"
```

### Skill Invocation

Other Claude skills can invoke this skill programmatically:

```bash
# From another skill script
claude-docs-expert mcp
claude-docs-expert -t tools
claude-docs-expert "whats new"
```

## Available Commands

### `/docs` (No Arguments)

- **Purpose**: List all available documentation topics
- **Usage**: `/docs`
- **Output**: Complete list of available documentation sections
- **Aliases**: `docs`, `documentation`

### `/docs <topic>`

- **Purpose**: Read specific documentation with links to official docs
- **Usage**: `/docs <topic>`
- **Examples**:
  - `/docs mcp` - Read MCP documentation
  - `/docs artifacts` - Read artifacts documentation
  - `/docs tools` - Read tools documentation
- **Output**: Full documentation content with official links

### `/docs -t`

- **Purpose**: Check sync status without reading documentation
- **Usage**: `/docs -t`
- **Output**: Sync status information and last update timestamps

### `/docs -t <topic>`

- **Purpose**: Check freshness then read documentation for a specific topic
- **Usage**: `/docs -t <topic>`
- **Examples**:
  - `/docs -t mcp` - Check MCP docs freshness then display
  - `/docs -t artifacts` - Check artifacts docs freshness then display
- **Output**: Freshness status followed by documentation content

### `/docs whats new`

- **Purpose**: Show recent documentation changes and updates
- **Usage**: `/docs whats new` or `/docs "what's new"`
- **Output**: List of recent changes, new features, and updates

## Integration with Other Skills

### Calling from Other Skills

```bash
#!/bin/bash
# Example: From another skill that needs Claude docs

# Check if user needs help with MCP
if [[ "$user_query" =~ "mcp" ]]; then
    echo "Let me get the latest MCP documentation for you..."
    claude-docs-expert -t mcp
fi

# List available docs when user asks for help
if [[ "$user_query" =~ "help|documentation" ]]; then
    echo "Available Claude Code documentation topics:"
    claude-docs-expert
fi
```

### Programmatic Access

```bash
# Get documentation content into a variable
mcp_docs=$(claude-docs-expert mcp)

# Check if docs are up to date
sync_status=$(claude-docs-expert -t)

# Get recent changes for processing
recent_changes=$(claude-docs-expert "whats new")
```

## Output Format

The skill provides structured output in markdown format:

### Topic Listing Output

```
Available Claude Code Documentation Topics:
- mcp: Model Context Protocol integration
- artifacts: Creating and managing artifacts
- tools: Available tools and their usage
- [... additional topics]

Links: https://claude.ai/code/docs
```

### Specific Topic Output

```markdown
# [Topic Name]

[Detailed documentation content]

## Links

- Official Documentation: https://claude.ai/code/docs/[topic]
- Last Updated: [timestamp]
```

### Sync Status Output

```
Documentation Sync Status:
- Last Sync: [timestamp]
- Status: [up-to-date|needs-sync|error]
- Available Topics: [count]
```

## Error Handling

The skill includes comprehensive error handling:

- **Missing Helper Script**: Clear error message with installation instructions
- **Permission Issues**: Guidance on fixing executable permissions
- **Invalid Arguments**: Usage help and examples
- **Network Issues**: Graceful handling of sync failures

## Dependencies

- **Primary**: `~/.claude-code-docs/claude-docs-helper.sh`
- **Shell**: Bash 4.0+
- **Permissions**: Read and execute access to skill and helper directories

## Configuration

The skill uses these configurable paths:

```bash
# Main dependency path
CLAUDE_DOCS_HELPER="$HOME/.claude-code-docs/claude-docs-helper.sh"
```

## Troubleshooting

### Common Issues

1. **"Claude docs helper not found"**
   - Ensure Claude Code documentation is installed
   - Check path: `~/.claude-code-docs/claude-docs-helper.sh`

2. **"Claude docs helper is not executable"**
   - Run: `chmod +x ~/.claude-code-docs/claude-docs-helper.sh`

3. **"Invalid arguments" errors**
   - Use `--help` flag for usage information
   - Check command syntax in examples above

### Verification

```bash
# Test skill installation
claude-docs-expert --help

# Verify helper script
ls -la ~/.claude-code-docs/claude-docs-helper.sh

# Test basic functionality
claude-docs-expert
```

## Version History

- **v1.0.0** (2025-11-06): Initial release with full documentation access and sync checking

## License

MIT License - See skill metadata for details.

## Support

For issues with this skill:

1. Check the troubleshooting section above
2. Verify all dependencies are installed
3. Ensure proper permissions on all files
4. Check that the underlying Claude Code documentation helper is functioning correctly
