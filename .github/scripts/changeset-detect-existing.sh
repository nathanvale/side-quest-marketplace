#!/usr/bin/env bash
# Detect existing changeset markdown files and report count via GITHUB_OUTPUT.
# Usage: changeset-detect-existing.sh [dir]
# - dir: directory to scan (default: .changeset)

set -euo pipefail

DIR="${1:-.changeset}"

count_changesets() {
  local dir="$1"
  local count=0
  if [[ -d "$dir" ]]; then
    while IFS= read -r -d '' _file; do
      count=$((count + 1))
    done < <(find "$dir" -type f -name '*.md' -not -name 'README.md' -print0 2>/dev/null)
  fi
  printf '%d\n' "$count"
}

FOUND=$(count_changesets "$DIR")

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "found=$FOUND" >>"$GITHUB_OUTPUT"
else
  echo "found=$FOUND"
fi
