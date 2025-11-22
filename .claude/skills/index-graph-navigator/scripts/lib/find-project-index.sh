#!/usr/bin/env bash
# Shared utility: Find PROJECT_INDEX.json by searching upward (like git's .git search)
#
# Priority order:
# 1. CLAUDE_PROJECT_DIR env var (if set)
# 2. Search upward from current directory
#
# Returns: Path to PROJECT_INDEX.json
# Exit codes: 0 = found, 1 = not found

find_project_index() {
  # Priority 1: Check CLAUDE_PROJECT_DIR if set
  if [[ -n "${CLAUDE_PROJECT_DIR:-}" ]]; then
    local candidate="$CLAUDE_PROJECT_DIR/PROJECT_INDEX.json"
    if [[ -f "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  fi

  # Priority 2: Search upward from current directory
  local current_dir="$PWD"

  while true; do
    local candidate="$current_dir/PROJECT_INDEX.json"

    # Found it!
    if [[ -f "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi

    # Reached filesystem root without finding it
    if [[ "$current_dir" == "/" ]]; then
      echo '{"status":"error","error":"PROJECT_INDEX.json not found in current directory or any parent","hint":"Run /index command in your project directory"}' >&2
      return 1
    fi

    # Move up one directory
    current_dir="$(dirname "$current_dir")"
  done
}

# If sourced, don't execute anything
# If run directly, execute the search
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  find_project_index
fi
