#!/bin/bash
# Install MCP server and hooks dependencies on session start

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"
MCP_DIR="$PLUGIN_ROOT/mcp-servers/git-intelligence"
HOOKS_DIR="$PLUGIN_ROOT/hooks"

# Install MCP server dependencies
if [ ! -d "$MCP_DIR/node_modules" ]; then
  cd "$MCP_DIR"
  bun install --silent 2>/dev/null || bun install
fi

# Install hooks dependencies (for TypeScript types)
if [ ! -d "$HOOKS_DIR/node_modules" ]; then
  cd "$HOOKS_DIR"
  bun install --silent 2>/dev/null || bun install
fi

exit 0
