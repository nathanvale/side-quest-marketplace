#!/bin/bash
#
# SessionStart Hook: Install MCP server dependencies
# Only runs npm install if node_modules doesn't exist
#

set -euo pipefail

MCP_DIR="${CLAUDE_PLUGIN_ROOT}/mcp-servers/bash-history"

# Skip if node_modules already exists
if [ -d "$MCP_DIR/node_modules" ]; then
    exit 0
fi

# Install dependencies silently
cd "$MCP_DIR" && npm install --silent 2>/dev/null

exit 0
