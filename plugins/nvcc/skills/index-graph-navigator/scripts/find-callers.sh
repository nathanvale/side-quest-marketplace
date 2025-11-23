#!/usr/bin/env bash
# Find direct callers of a function (reverse dependencies)
# Queries PROJECT_INDEX.json directly
#
# Usage:
#   find-callers.sh parseDate              # All callers
#   find-callers.sh parseDate --json       # Full JSON output
#
# Returns: JSON with list of caller functions

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
  echo '{"status":"error","error":"Missing required argument: function name","usage":"find-callers.sh <function-name> [--json]"}' >&2
  exit 1
fi

# Find PROJECT_INDEX.json (searches upward from current directory)
INDEX_FILE=$(find_project_index) || exit 1

# Query using jq (find all edges where target is callee)
RESULTS=$(jq -r --arg func "$TARGET" '
  [.g[] | select(.[1] == $func) | .[0]] | unique | sort
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
      query: "find-callers",
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
