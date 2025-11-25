# Hooks Guide

Hooks allow you to execute custom code at specific points in the Claude Code lifecycle.

## Available Hooks

- **PreToolUse**: Runs before any tool execution
- **PostToolUse**: Runs after tool execution completes
- **SessionStart**: Runs when a session begins

## Example Hook

```bash
#!/bin/bash
echo "Hook executed successfully"
```

## Configuration

Hooks are configured in your `.claude-plugin/plugin.json` file:

```json
{
  "hooks": {
    "PreToolUse": "./hooks/pre-tool-use.sh"
  }
}
```

For more information, see the [hooks documentation](https://code.claude.com/docs/en/hooks).
