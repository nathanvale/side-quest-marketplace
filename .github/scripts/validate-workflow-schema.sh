#!/usr/bin/env bash
# Basic schema guard: fail if an `env:` block is immediately followed by `with:` in workflow files.
# Usage: validate-workflow-schema.sh [glob]

set -euo pipefail

GLOB="${1:-.github/workflows/*.yml}"

if grep -RPzo "(?s)^\s*env:\s*\n\s*with:" "$GLOB"; then
  echo "Potential mis-indented env found: 'env:' immediately followed by 'with:'" >&2
  exit 1
fi

echo "No mis-indented env blocks found."
