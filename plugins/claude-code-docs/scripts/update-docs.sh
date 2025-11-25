#!/bin/bash
# Update Claude Code documentation from Eric Buess's repository
# Based on: https://github.com/ericbuess/claude-code-docs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"
DOCS_DIR="$PLUGIN_DIR/docs"
REPO_URL="https://github.com/ericbuess/claude-code-docs.git"
TEMP_DIR=$(mktemp -d)

echo "📚 Claude Code Documentation Updater"
echo ""

# Cleanup function
cleanup() {
  if [ -d "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
  fi
}

trap cleanup EXIT

# Clone the repository
echo "🔄 Cloning documentation repository..."
if ! git clone --depth 1 --branch main "$REPO_URL" "$TEMP_DIR" 2>/dev/null; then
  echo "❌ Failed to clone repository"
  exit 1
fi

# Copy docs to plugin directory
echo "📥 Copying documentation files..."
if [ -d "$TEMP_DIR/docs" ]; then
  # Remove old docs directory
  rm -rf "$DOCS_DIR"

  # Copy new docs
  cp -r "$TEMP_DIR/docs" "$DOCS_DIR"

  # Copy manifest if it exists
  if [ -f "$TEMP_DIR/docs_manifest.json" ]; then
    cp "$TEMP_DIR/docs_manifest.json" "$DOCS_DIR/manifest.json"
  fi

  # Count files
  DOC_COUNT=$(find "$DOCS_DIR" -name "*.md" -type f | wc -l | tr -d ' ')

  echo ""
  echo "✅ Documentation updated successfully!"
  echo "   📄 Files: $DOC_COUNT markdown documents"
  echo "   📂 Location: $DOCS_DIR"
  echo ""
  echo "💡 Documentation is sourced from Eric Buess's repository:"
  echo "   https://github.com/ericbuess/claude-code-docs"
else
  echo "❌ No docs directory found in repository"
  exit 1
fi
