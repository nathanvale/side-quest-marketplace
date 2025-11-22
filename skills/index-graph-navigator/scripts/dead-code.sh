#!/usr/bin/env bash
# Find functions that are never called (potential dead code)
# Queries PROJECT_INDEX.json directly
#
# Usage:
#   dead-code.sh                    # All dead code
#   dead-code.sh --limit 20         # First 20 results
#   dead-code.sh --json             # Full JSON output
#
# Returns: Functions that have no callers

set -euo pipefail

# Source shared utility for finding PROJECT_INDEX.json
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/find-project-index.sh"

# Parse arguments
JSON_OUTPUT=false
LIMIT=""

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

# Extract all defined functions and all called functions, then find set difference
LIMIT_ARG=""
if [[ -n "$LIMIT" ]]; then
  LIMIT_ARG="| .[:$LIMIT]"
fi

RESULTS=$(jq -r --argjson limit "${LIMIT:-null}" '
  # Extract all defined function names from .f section (object with file paths as keys)
  ([.f | to_entries[] | .value[1][] | select(type == "string") | split(":")[0]] | unique) as $defined |

  # Extract all called functions from .g section
  ([.g[] | .[1]] | unique) as $called |

  # Set difference: defined - called = dead code
  ($defined - $called | sort) as $deadcode |

  # Apply limit if specified
  if $limit then $deadcode[:$limit] else $deadcode end
' < "$INDEX_FILE")

# Count results
COUNT=$(echo "$RESULTS" | jq 'length')

if [[ "$JSON_OUTPUT" == "true" ]]; then
  # Full JSON response
  jq -n \
    --argjson results "$RESULTS" \
    --argjson count "$COUNT" \
    '{
      status: "success",
      query: "dead-code",
      results: $results,
      summary: {
        total: $count
      }
    }'
else
  # Simple list output
  echo "$RESULTS" | jq -r '.[]'
fi
