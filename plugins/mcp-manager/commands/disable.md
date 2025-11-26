---
description: Disable an MCP server without removing it
argument-hint: <server-name|all> [--global]
---

# Disable MCP Server

Run the mcp-manager CLI to disable servers:

```bash
# Parse arguments from $ARGUMENTS
ARGS="$ARGUMENTS"

if [ -z "$ARGS" ]; then
  echo "Usage: /mcp-manager:disable <server-name|all> [--global]"
  echo ""
  echo "Examples:"
  echo "  /mcp-manager:disable filesystem"
  echo "  /mcp-manager:disable filesystem tavily-mcp"
  echo "  /mcp-manager:disable all"
  echo "  /mcp-manager:disable all --global"
  exit 1
fi

bun ${CLAUDE_PLUGIN_ROOT}/src/cli.ts disable $ARGS
```
