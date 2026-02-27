#!/usr/bin/env bash
# Toggle Changesets pre-mode by creating a branch and running enter/exit.
# Expects env ACTION (enter|exit), CHANNEL (beta|rc|next), RUN_ID.
# Writes BRANCH to GITHUB_OUTPUT.

set -euo pipefail

ACTION="${ACTION:-enter}"
CHANNEL="${CHANNEL:-beta}"
RUN_ID="${RUN_ID:-manual}"

BRANCH="pre/${ACTION}-${CHANNEL}-${RUN_ID}"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "BRANCH=$BRANCH" >>"$GITHUB_OUTPUT"
fi

git checkout -b "$BRANCH"
if [[ "$ACTION" == "enter" ]]; then
  bunx changeset pre enter "$CHANNEL"
else
  bunx changeset pre exit
fi

# Normalize Changesets pre.json formatting so CI quality check passes
if [[ -f ".changeset/pre.json" ]]; then
  bunx biome format --write .changeset/pre.json || true
fi

git add .
if git diff --cached --quiet; then
  echo "No pre-mode changes to commit"
  exit 0
fi
# Disable Husky hooks in CI to avoid commitlint friction for automation commits
if [[ "${CI:-false}" == "true" ]]; then
  export HUSKY=0
fi
git commit -m "chore(pre): $ACTION $CHANNEL channel"
git push --set-upstream origin "$BRANCH"
