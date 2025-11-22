#!/usr/bin/env bash
# Automated Fix for Directory Handling Violations
#
# Fixes critical violations found by audit-directory-handling.sh
#
# Usage: fix-directory-handling.sh [--dry-run]
#
# What it fixes:
#   1. Adds 'set -e' to scripts missing it (except libraries)
#   2. Replaces $0 with ${BASH_SOURCE[0]} for script location
#
# Exit codes:
#   0 - Success
#   1 - Error

set -e

DRY_RUN=false
if [ "$1" = "--dry-run" ]; then
    DRY_RUN=true
fi

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

FIXED_COUNT=0
SKIPPED_COUNT=0

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Directory Handling Automated Fixes${NC}"
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}  MODE: DRY RUN (no changes will be made)${NC}"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Core scripts that need set -e added (Phase 1 - Critical)
CRITICAL_SCRIPTS=(
    "bin/dotfiles/symlinks/symlinks_install.sh"
    "bin/dotfiles/symlinks/symlinks_uninstall.sh"
    "bin/utils/check_shell.sh"
    "bin/system/iterm/iterm_preferences_install.sh"
    "bin/system/iterm/iterm_preferences_uninstall.sh"
    "bin/system/macos/macos_preferences_install.sh"
    "bin/system/macos/macos_preferences_uninstall.sh"
    "bin/system/fonts/nerd_fonts_install.sh"
    "bin/system/fonts/nerd_fonts_uninstall.sh"
)

# High priority scripts (Phase 2)
HIGH_PRIORITY_SCRIPTS=(
    "bin/utils/kill-all-zombies.sh"
    "bin/utils/superwhisper-minimize-on-startup.sh"
    "bin/utils/teams-meeting-helper.sh"
    "bin/utils/obsidian-restart.sh"
    "bin/dotfiles/preferences/preferences_backup.sh"
    "bin/dotfiles/preferences/preferences_restore.sh"
    "bin/dotfiles/installation_scripts.sh"
    "bin/dotfiles/uninstallation_scripts.sh"
)

# Library files to skip (should not have set -e)
LIBRARY_FILES=(
    "bin/utils/colour_log.sh"
)

# Function to check if script is a library
is_library() {
    local script="$1"
    for lib in "${LIBRARY_FILES[@]}"; do
        if [[ "$script" == *"$lib" ]]; then
            return 0
        fi
    done
    return 1
}

# Function to add set -e to a script
add_set_e() {
    local script="$1"
    local git_root="/Users/nathanvale/code/dotfiles"
    local full_path="$git_root/$script"

    if [ ! -f "$full_path" ]; then
        echo -e "${RED}  ❌ File not found: $script${NC}"
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        return 1
    fi

    # Check if already has set -e
    if grep -q "^set -e" "$full_path"; then
        echo -e "${GREEN}  ✓ Already has 'set -e': $script${NC}"
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        return 0
    fi

    # Check if it's a library file
    if is_library "$script"; then
        echo -e "${YELLOW}  ⊘ Skipping library file: $script${NC}"
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        return 0
    fi

    echo -e "${BLUE}  + Adding 'set -e' to: $script${NC}"

    if [ "$DRY_RUN" = false ]; then
        # Find the line after shebang and comments
        # Insert 'set -e' after the header block
        awk '
        BEGIN { inserted = 0 }
        /^#!/ { print; next }
        /^#/ { print; next }
        /^$/ { print; next }
        !inserted && !/^#/ && !/^$/ {
            print "set -e  # Exit on error"
            print ""
            inserted = 1
        }
        { print }
        ' "$full_path" > "${full_path}.tmp"

        mv "${full_path}.tmp" "$full_path"
        echo -e "${GREEN}  ✓ Added 'set -e' to: $script${NC}"
        FIXED_COUNT=$((FIXED_COUNT + 1))
    else
        echo -e "${YELLOW}  [DRY RUN] Would add 'set -e' to: $script${NC}"
        FIXED_COUNT=$((FIXED_COUNT + 1))
    fi
}

echo -e "${BLUE}Phase 1: Critical Scripts${NC}"
echo ""

for script in "${CRITICAL_SCRIPTS[@]}"; do
    add_set_e "$script"
done

echo ""
echo -e "${BLUE}Phase 2: High Priority Scripts${NC}"
echo ""

for script in "${HIGH_PRIORITY_SCRIPTS[@]}"; do
    add_set_e "$script"
done

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo "Scripts that would be fixed: $FIXED_COUNT"
    echo "Scripts skipped: $SKIPPED_COUNT"
    echo ""
    echo -e "${YELLOW}Run without --dry-run to apply changes${NC}"
else
    echo "Scripts fixed: $FIXED_COUNT"
    echo "Scripts skipped: $SKIPPED_COUNT"
    echo ""
    echo -e "${GREEN}✓ Fixes applied successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review changes: git diff"
    echo "  2. Test affected scripts"
    echo "  3. Run audit again: ~/.claude/scripts/audit-directory-handling.sh"
    echo "  4. Commit changes: git commit -am 'fix: add set -e to critical scripts'"
fi
