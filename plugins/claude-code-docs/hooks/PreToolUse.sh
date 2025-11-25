#!/bin/bash

# Auto-update Claude Code docs if last update was >24 hours ago
# This hook runs before any tool execution but doesn't block

MANIFEST="${CLAUDE_PLUGIN_ROOT}/docs/manifest.json"
THRESHOLD=86400  # 24 hours in seconds

if [ -f "$MANIFEST" ]; then
  LAST_UPDATE=$(jq -r '.generated' "$MANIFEST" 2>/dev/null)

  if [ -n "$LAST_UPDATE" ] && [ "$LAST_UPDATE" != "null" ]; then
    # Parse ISO 8601 timestamp to epoch
    LAST_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${LAST_UPDATE:0:19}" "+%s" 2>/dev/null || echo 0)
    NOW=$(date +%s)
    DIFF=$((NOW - LAST_EPOCH))

    if [ $DIFF -gt $THRESHOLD ]; then
      HOURS=$((DIFF / 3600))
      echo "📚 Updating Claude Code docs (last update: ${HOURS} hours ago)..."
      bash "${CLAUDE_PLUGIN_ROOT}/scripts/update-docs.sh" > /dev/null 2>&1 &
    fi
  fi
fi

exit 0
