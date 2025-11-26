---
description: Enable a disabled MCP server
argument-hint: <server-name|all> [--global]
---

# Enable MCP Server

Run the mcp-manager CLI to enable servers:

```bash
# Parse arguments from $ARGUMENTS
ARGS="$ARGUMENTS"

if [ -z "$ARGS" ]; then
  echo "Usage: /mcp-manager:enable <server-name|all> [--global]"
  echo ""
  echo "Examples:"
  echo "  /mcp-manager:enable filesystem"
  echo "  /mcp-manager:enable filesystem tavily-mcp"
  echo "  /mcp-manager:enable all"
  echo "  /mcp-manager:enable all --global"
  exit 1
fi

bun ${CLAUDE_PLUGIN_ROOT}/src/cli.ts enable $ARGS
```
