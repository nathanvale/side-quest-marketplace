#!/usr/bin/env bash
# Find what a function directly calls (forward dependencies)
# Queries PROJECT_INDEX.json directly
#
# Usage:
#   find-calls.sh migrateAttachments              # All functions this calls
#   find-calls.sh migrateAttachments --json       # Full JSON output
#
# Returns: JSON with list of called functions

set -euo pipefail

# Source shared utility for finding PROJECT_INDEX.json
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/find-project-index.sh"

# Parse arguments
JSON_OUTPUT=false
TARGET=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --json)
      JSON_OUTPUT=true
      shift
      ;;
    *)
      if [[ -z "$TARGET" ]]; then
        TARGET="$1"
      fi
      shift
      ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo '{"status":"error","error":"Missing required argument: function name","usage":"find-calls.sh <function-name> [--json]"}' >&2
  exit 1
fi

# Find PROJECT_INDEX.json (searches upward from current directory)
INDEX_FILE=$(find_project_index) || exit 1

# Query using jq (find all edges where target is caller)
RESULTS=$(jq -r --arg func "$TARGET" '
  [.g[] | select(.[0] == $func) | .[1]] | unique | sort
' < "$INDEX_FILE")

# Count results
COUNT=$(echo "$RESULTS" | jq 'length')

if [[ "$JSON_OUTPUT" == "true" ]]; then
  # Full JSON response
  jq -n \
    --arg target "$TARGET" \
    --argjson results "$RESULTS" \
    --argjson count "$COUNT" \
    '{
      status: "success",
      query: "find-calls",
      target: $target,
      results: $results,
      summary: {
        total: $count
      }
    }'
else
  # Simple list output
  echo "$RESULTS" | jq -r '.[]'
fi
