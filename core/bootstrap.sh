#!/bin/bash
# Ensure marketplace dependencies are installed.
#
# This script is called by SessionStart hooks in all plugins.
# It's idempotent - if node_modules exists, it exits immediately.
#
# Usage: Called from plugin SessionStart hooks via:
#   ${CLAUDE_PLUGIN_ROOT}/../core/bootstrap.sh
#
# Or from nested MCP server directories:
#   ${CLAUDE_PLUGIN_ROOT}/../../core/bootstrap.sh

set -e

# Find marketplace root (core is at marketplace root level)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETPLACE_ROOT="$SCRIPT_DIR/.."

# Quick check: if node_modules exists, we're done
if [ -d "$MARKETPLACE_ROOT/node_modules" ]; then
  exit 0
fi

# Install dependencies
cd "$MARKETPLACE_ROOT"
bun install --frozen-lockfile 2>/dev/null || bun install

exit 0
