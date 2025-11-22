#!/usr/bin/env bash
# Directory Handling Best Practices Audit
#
# Audits bash scripts against best practices from:
# .claude/docs/directory-handling-best-practices.md
#
# Usage: audit-directory-handling.sh [directory]
#
# Exit codes:
#   0 - All checks passed
#   1 - Violations found

set -e

AUDIT_DIR="${1:-.}"
TOTAL_SCRIPTS=0
TOTAL_VIOLATIONS=0

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Violation tracking (bash 3.2 compatible)
MISSING_SET_E=0
UNHANDLED_CD=0
USES_DOLLAR_ZERO=0
MULTIPLE_CD=0
HARDCODED_PATHS=0
CD_WITHOUT_ERROR=0
MISSING_GIT_ROOT_CHECK=0

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Directory Handling Best Practices Audit${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Find all bash scripts
while IFS= read -r script; do
    TOTAL_SCRIPTS=$((TOTAL_SCRIPTS + 1))
    SCRIPT_VIOLATIONS=0

    # Skip if file is in excluded directories
    if [[ "$script" =~ node_modules|\.git|archived|deprecated|\.archived ]]; then
        continue
    fi

    # Check 1: Missing set -e
    if ! grep -q "^set -e" "$script" && ! grep -q "^set -euo pipefail" "$script"; then
        echo -e "${YELLOW}⚠ $script${NC}"
        echo "  ❌ Missing 'set -e' at top of script"
        MISSING_SET_E=$((MISSING_SET_E + 1))
        SCRIPT_VIOLATIONS=$((SCRIPT_VIOLATIONS + 1))
    fi

    # Check 2: Unhandled cd (cd without || or &&)
    if grep -qE "^[[:space:]]*cd [^|&]" "$script" && ! grep -q "set -e" "$script"; then
        if [ $SCRIPT_VIOLATIONS -eq 0 ]; then
            echo -e "${YELLOW}⚠ $script${NC}"
        fi
        echo "  ❌ Unhandled 'cd' call (no error check and no 'set -e')"
        UNHANDLED_CD=$((UNHANDLED_CD + 1))
        SCRIPT_VIOLATIONS=$((SCRIPT_VIOLATIONS + 1))
    fi

    # Check 3: Uses $0 instead of BASH_SOURCE
    if grep -qE '\$0|"\$\{0\}"' "$script" && ! grep -q BASH_SOURCE "$script"; then
        if [ $SCRIPT_VIOLATIONS -eq 0 ]; then
            echo -e "${YELLOW}⚠ $script${NC}"
        fi
        echo "  ⚠️  Uses '\$0' (consider BASH_SOURCE for script location)"
        USES_DOLLAR_ZERO=$((USES_DOLLAR_ZERO + 1))
        SCRIPT_VIOLATIONS=$((SCRIPT_VIOLATIONS + 1))
    fi

    # Check 4: Multiple sequential cd calls
    cd_count=$(grep -cE "^[[:space:]]*cd " "$script" || echo 0)
    if [ "$cd_count" -gt 2 ]; then
        if [ $SCRIPT_VIOLATIONS -eq 0 ]; then
            echo -e "${YELLOW}⚠ $script${NC}"
        fi
        echo "  ⚠️  Multiple 'cd' calls ($cd_count) - consider using absolute paths"
        MULTIPLE_CD=$((MULTIPLE_CD + 1))
        SCRIPT_VIOLATIONS=$((SCRIPT_VIOLATIONS + 1))
    fi

    # Check 5: Hardcoded paths (looking for common patterns)
    if grep -qE "cd /Users/|cd /home/|cd ~/code/" "$script"; then
        if [ $SCRIPT_VIOLATIONS -eq 0 ]; then
            echo -e "${YELLOW}⚠ $script${NC}"
        fi
        echo "  ❌ Hardcoded absolute paths detected"
        HARDCODED_PATHS=$((HARDCODED_PATHS + 1))
        SCRIPT_VIOLATIONS=$((SCRIPT_VIOLATIONS + 1))
    fi

    # Check 6: cd without || or && and without set -e
    if grep -qE "^[[:space:]]*cd [^|&]*$" "$script" && ! grep -q "set -e" "$script"; then
        if [ $SCRIPT_VIOLATIONS -eq 0 ]; then
            echo -e "${YELLOW}⚠ $script${NC}"
        fi
        echo "  ❌ 'cd' without error handling (|| exit or && or set -e)"
        CD_WITHOUT_ERROR=$((CD_WITHOUT_ERROR + 1))
        SCRIPT_VIOLATIONS=$((SCRIPT_VIOLATIONS + 1))
    fi

    # Check 7: Git operations without git root check
    if grep -qE "git (add|commit|push|pull)" "$script" && ! grep -q "git rev-parse --show-toplevel" "$script" && ! grep -q "GIT_ROOT" "$script"; then
        if [ $SCRIPT_VIOLATIONS -eq 0 ]; then
            echo -e "${YELLOW}⚠ $script${NC}"
        fi
        echo "  ⚠️  Git operations without git root anchor"
        MISSING_GIT_ROOT_CHECK=$((MISSING_GIT_ROOT_CHECK + 1))
        SCRIPT_VIOLATIONS=$((SCRIPT_VIOLATIONS + 1))
    fi

    if [ $SCRIPT_VIOLATIONS -gt 0 ]; then
        echo ""
        TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + SCRIPT_VIOLATIONS))
    fi

done < <(find "$AUDIT_DIR" -name "*.sh" -type f ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/archived/*" ! -path "*/deprecated/*" ! -path "*/.archived*")

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Total scripts audited: $TOTAL_SCRIPTS"
echo ""

if [ $TOTAL_VIOLATIONS -eq 0 ]; then
    echo -e "${GREEN}✅ No violations found!${NC}"
    exit 0
else
    echo -e "${RED}❌ Total violations: $TOTAL_VIOLATIONS${NC}"
    echo ""
    echo "Breakdown by type:"
    echo "  • Missing 'set -e': $MISSING_SET_E"
    echo "  • Unhandled 'cd': $UNHANDLED_CD"
    echo "  • Uses '\$0' instead of BASH_SOURCE: $USES_DOLLAR_ZERO"
    echo "  • Multiple 'cd' calls: $MULTIPLE_CD"
    echo "  • Hardcoded paths: $HARDCODED_PATHS"
    echo "  • 'cd' without error handling: $CD_WITHOUT_ERROR"
    echo "  • Git ops without root check: $MISSING_GIT_ROOT_CHECK"
    echo ""
    echo -e "${YELLOW}📖 See: .claude/docs/directory-handling-best-practices.md${NC}"
    exit 1
fi
