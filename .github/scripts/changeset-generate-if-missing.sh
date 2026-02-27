#!/usr/bin/env bash
# Generate a changeset file using PR context when none exists.
# Expects env PR_TITLE and PR_NUMBER. Writes/commits/pushes the new file.

set -euo pipefail

if [[ -z "${PR_TITLE:-}" ]] || [[ -z "${PR_NUMBER:-}" ]]; then
  missing=()
  [[ -z "${PR_TITLE:-}" ]] && missing+=("PR_TITLE")
  [[ -z "${PR_NUMBER:-}" ]] && missing+=("PR_NUMBER")
  echo "::warning::Missing required env: ${missing[*]}. Skipping changeset generation."
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    {
      echo "## Auto-generate Changeset"
      echo "Missing required env: ${missing[*]}. Skipping generation."
    } >>"$GITHUB_STEP_SUMMARY"
  fi
  exit 0
fi

TITLE="${PR_TITLE}"

LOWER=$(printf '%s' "$TITLE" | tr '[:upper:]' '[:lower:]')
TYPE="patch"
if printf '%s' "$LOWER" | grep -q '^feat'; then TYPE="minor"; fi
if printf '%s' "$LOWER" | grep -q 'breaking'; then TYPE="major"; fi

# Sanitize: keep alnum, space, hyphen; then convert spaces to hyphens
SAFE_NAME=$(printf '%s' "$TITLE" | sed -E 's/[^[:alnum:][:space:]-]//g' | tr ' ' '-')
FILE=".changeset/auto-${SAFE_NAME:-change}.md"

# Discover package name(s) dynamically.
# Supports both single-package repos and Bun workspaces (packages/*).
PACKAGES=""
if [[ -d "packages" ]]; then
  # Monorepo: discover all publishable workspace packages
  PACKAGES=$(node -e "
    const fs = require('fs');
    const path = require('path');
    fs.readdirSync('packages', { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => path.join('packages', d.name, 'package.json'))
      .filter(p => fs.existsSync(p))
      .forEach(p => {
        const pkg = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (!pkg.private) console.log(pkg.name);
      });
  ")
else
  # Single package: read name from root package.json
  PACKAGES=$(node -p "require('./package.json').name")
fi

if [[ -z "$PACKAGES" ]]; then
  echo "::warning::Could not determine package name(s). Skipping changeset generation."
  exit 0
fi

mkdir -p .changeset
{
  printf '%s\n' '---'
  while IFS= read -r PKG; do
    printf '"%s": %s\n' "$PKG" "$TYPE"
  done <<< "$PACKAGES"
  printf '%s\n\n' '---'
  printf '%s\n' "$TITLE"
} >"$FILE"

git config user.name 'github-actions[bot]'
git config user.email 'github-actions[bot]@users.noreply.github.com'
git add "$FILE"
# Disable Husky hooks in CI to avoid commitlint friction for automation commits
if [[ "${CI:-false}" == "true" ]]; then
  export HUSKY=0
  git config --global core.hooksPath /dev/null || true
fi
git commit -m "chore(changeset): auto-generate for PR #$PR_NUMBER" || echo 'No commit'
git push || echo 'Push skipped'