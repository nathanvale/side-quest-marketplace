#!/usr/bin/env bash
# List all HyperFlow (Hyper key) bindings from Karabiner configuration

set -euo pipefail

# Try dotfiles location first, then fallback to ~/.config
if [[ -f "${HOME}/code/dotfiles/config/karabiner/karabiner.json" ]]; then
  KARABINER_CONFIG="${HOME}/code/dotfiles/config/karabiner/karabiner.json"
elif [[ -f "${HOME}/.config/karabiner/karabiner.json" ]]; then
  KARABINER_CONFIG="${HOME}/.config/karabiner/karabiner.json"
else
  echo "❌ Karabiner config not found"
  echo "   Tried:"
  echo "   - ${HOME}/code/dotfiles/config/karabiner/karabiner.json"
  echo "   - ${HOME}/.config/karabiner/karabiner.json"
  exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo "❌ jq is required but not installed. Install with: brew install jq"
  exit 1
fi

echo "HyperFlow Bindings (Hyper + Key):"
echo "=================================="
echo ""

# Extract Hyper key bindings (all 4 modifiers)
jq -r '
  .profiles[0].complex_modifications.rules[]? |
  select(
    .manipulators[0]?.from?.modifiers?.mandatory? |
    . != null and contains(["left_control", "left_option", "left_command", "left_shift"])
  ) |
  {
    key: .manipulators[0].from.key_code,
    action: (
      if .manipulators[0].to?[0]?.shell_command? then
        .manipulators[0].to[0].shell_command
      elif .manipulators[0].to?[0]?.key_code? then
        "→ \(.manipulators[0].to[0].key_code)"
      else
        "unknown action"
      end
    ),
    description: .description
  } |
  "Hyper+\(.key | ascii_upcase)\t\(.action)\n  \(.description)"
' "$KARABINER_CONFIG" | sort

echo ""
# Count bindings more safely
total=$(jq '
  [.profiles[0].complex_modifications.rules[]? |
  select(
    .manipulators[0]?.from?.modifiers?.mandatory? |
    . != null and contains(["left_control", "left_option", "left_command", "left_shift"])
  )] | length
' "$KARABINER_CONFIG" 2>/dev/null || echo "0")
echo "Total bindings: $total"
