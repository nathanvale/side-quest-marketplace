#!/usr/bin/env bash
# Find most-connected functions (highest change risk / maintenance burden)
# Queries PROJECT_INDEX.json directly
#
# Usage:
#   hotspots.sh                     # Top 10 hotspots
#   hotspots.sh --limit 20          # Top 20 hotspots
#   hotspots.sh --json              # Full JSON output
#
# Returns: Functions sorted by caller count (descending)

set -euo pipefail

# Source shared utility for finding PROJECT_INDEX.json
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/find-project-index.sh"

# Parse arguments
JSON_OUTPUT=false
LIMIT=10

while [[ $# -gt 0 ]]; do
  case $1 in
    --json)
      JSON_OUTPUT=true
      shift
      ;;
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Find PROJECT_INDEX.json (searches upward from current directory)
INDEX_FILE=$(find_project_index) || exit 1

# Query using jq: group by callee, count, sort descending
RESULTS=$(jq -r --argjson limit "$LIMIT" '
  [.g[] | .[1]]
  | group_by(.)
  | map({function: .[0], callers: length})
  | sort_by(-.callers)
  | .[:$limit]
' < "$INDEX_FILE")

# Count results
COUNT=$(echo "$RESULTS" | jq 'length')

if [[ "$JSON_OUTPUT" == "true" ]]; then
  # Full JSON response
  jq -n \
    --argjson results "$RESULTS" \
    --argjson count "$COUNT" \
    --argjson limit "$LIMIT" \
    '{
      status: "success",
      query: "hotspots",
      results: $results,
      summary: {
        total: $count,
        limit: $limit,
        max_callers: (if $count > 0 then $results[0].callers else 0 end)
      }
    }'
else
  # Formatted table output
  echo "$RESULTS" | jq -r '.[] | "\(.function) (\(.callers) callers)"'
fi
