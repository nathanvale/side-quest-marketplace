# Directory Handling Audit Report

Generated: 2025-11-17 Audited: 106 bash scripts in /Users/nathanvale/code/dotfiles

---

## Executive Summary

**Total Violations**: 222 across 106 scripts

### Severity Breakdown:

| Severity        | Violation Type              | Count | Impact                                  |
| --------------- | --------------------------- | ----- | --------------------------------------- |
| 🔴 **CRITICAL** | Unhandled `cd`              | 11    | Commands run in wrong directory         |
| 🔴 **CRITICAL** | `cd` without error handling | 11    | Same as above                           |
| 🟠 **HIGH**     | Missing `set -e`            | 72    | Scripts continue after errors           |
| 🟡 **MEDIUM**   | Hardcoded paths             | 37    | Not portable                            |
| 🟡 **MEDIUM**   | Multiple `cd` calls         | 33    | Complex to track                        |
| 🟢 **LOW**      | Uses `$0`                   | 58    | Breaks when sourcing                    |
| ✅ **GOOD**     | Git ops without root        | 0     | All scripts properly anchor to git root |

---

## Critical Violations Requiring Immediate Fix

### 1. Unhandled `cd` Calls (11 scripts)

**Impact**: Script continues in wrong directory if `cd` fails, leading to:

- Data loss (operating on wrong files)
- Security issues (running commands in unintended locations)
- Silent failures

**Scripts Affected (Core Only)**:

```
bin/dotfiles/symlinks/symlinks_install.sh
bin/dotfiles/symlinks/symlinks_uninstall.sh
bin/utils/check_shell.sh
bin/system/iterm/iterm_preferences_install.sh
bin/system/iterm/iterm_preferences_uninstall.sh
bin/system/macos/macos_preferences_install.sh
bin/system/macos/macos_preferences_uninstall.sh
bin/system/nerd_fonts/nerd_fonts_install.sh
bin/system/nerd_fonts/nerd_fonts_uninstall.sh
```

**Fix**: Add `set -e` at top of script OR add `|| exit 1` to each `cd` call.

---

### 2. Missing `set -e` (72 scripts)

**Impact**: Scripts continue after errors instead of failing fast.

**Core Scripts Needing Fix**:

```
bin/dotfiles/preferences/preferences_backup.sh
bin/dotfiles/preferences/preferences_restore.sh
bin/dotfiles/symlinks/symlinks_install.sh
bin/dotfiles/symlinks/symlinks_uninstall.sh
bin/dotfiles/installation_scripts.sh
bin/dotfiles/uninstallation_scripts.sh
bin/utils/colour_log.sh (library - set -e not appropriate)
bin/utils/kill-all-zombies.sh
bin/utils/superwhisper-minimize-on-startup.sh
bin/utils/teams-meeting-helper.sh
bin/utils/check_shell.sh
bin/utils/obsidian-restart.sh
```

**Fix**: Add `set -e` immediately after shebang line.

**Exception**: Library files like `colour_log.sh` should NOT use `set -e` as they're sourced into
other scripts.

---

## Medium Priority Violations

### 3. Hardcoded Paths (37 scripts)

**Most in**: `.claude/shell-snapshots/` (auto-generated, can ignore)

**Core Scripts with Hardcoded Paths**: NONE (all use variables or git root)

### 4. Multiple `cd` Calls (33 scripts)

**Most in**: `.claude/shell-snapshots/` (auto-generated, can ignore)

**Core Scripts**: Most core scripts use single `cd` to git root, which is acceptable.

### 5. Uses `$0` Instead of `BASH_SOURCE` (58 scripts)

**Impact**: Breaks when script is sourced instead of executed.

**Core Scripts Affected**:

```
bin/dotfiles/symlinks/symlinks_manage.sh
bin/dotfiles/symlinks/symlinks_install.sh
bin/dotfiles/symlinks/symlinks_uninstall.sh
bin/utils/teams-meeting-helper.sh
bin/utils/check_shell.sh
bin/hyperflow/superwhisper-mode-switch.sh
... (many more)
```

**Fix**: Replace `$0` with `${BASH_SOURCE[0]}` for script location detection.

---

## Scripts Following Best Practices ✅

### Excellent Examples:

1. **`.claude/scripts/create-worktree.sh`**
   - ✅ Uses `set -e`
   - ✅ Single `cd` to git root at start
   - ✅ Uses `BASH_SOURCE`
   - ✅ Uses `git -C` to avoid additional `cd` calls
   - ✅ Proper error handling throughout

2. **`.claude/scripts/find-next-task.sh`**
   - ✅ Uses `set -e`
   - ✅ Defensive git root detection with fallback
   - ✅ Single `cd` with validation
   - ✅ No hardcoded paths

3. **`bin/tmux/parallel-claude.sh`**
   - ✅ Uses `set -e`
   - ✅ Gets git root AND script directory appropriately
   - ✅ Sources dependencies with fallback
   - ✅ Proper error messages

4. **`.claude/scripts/lib/get-project-lock-dir.sh`**
   - ✅ No `cd` calls (returns absolute paths)
   - ✅ Uses git root for anchor
   - ✅ Portable (uses `$HOME`)

---

## Recommended Fixes (Prioritized)

### Phase 1: Critical Fixes (Immediate)

1. **Add `set -e` to all installation/uninstallation scripts** (9 scripts)
   - `bin/dotfiles/symlinks/symlinks_install.sh`
   - `bin/dotfiles/symlinks/symlinks_uninstall.sh`
   - `bin/system/iterm/iterm_preferences_install.sh`
   - `bin/system/iterm/iterm_preferences_uninstall.sh`
   - `bin/system/macos/macos_preferences_install.sh`
   - `bin/system/macos/macos_preferences_uninstall.sh`
   - `bin/system/nerd_fonts/nerd_fonts_install.sh`
   - `bin/system/nerd_fonts/nerd_fonts_uninstall.sh`
   - `bin/utils/check_shell.sh`

2. **Verify all `cd` calls have error handling** (covered by adding `set -e`)

### Phase 2: High Priority (This Week)

1. **Add `set -e` to utility scripts** (5 scripts)
   - `bin/utils/kill-all-zombies.sh`
   - `bin/utils/superwhisper-minimize-on-startup.sh`
   - `bin/utils/teams-meeting-helper.sh`
   - `bin/utils/obsidian-restart.sh`
   - `bin/dotfiles/preferences/preferences_backup.sh`
   - `bin/dotfiles/preferences/preferences_restore.sh`

2. **Replace `$0` with `BASH_SOURCE` in core scripts**

### Phase 3: Medium Priority (This Month)

1. **Review scripts with multiple `cd` calls** - Consider refactoring to use absolute paths
2. **Document any remaining hardcoded paths** - Add comments explaining why they're needed

---

## Automated Fix Strategy

### Template for Adding `set -e`:

```bash
#!/bin/bash
# [existing comment]
#
# ...

set -e  # Exit on error

# [rest of script]
```

### Template for Replacing `$0`:

**Before**:

```bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
```

**After**:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
```

---

## Exclusions

**Ignored Directories**:

- `.claude/shell-snapshots/` - Auto-generated snapshots (not user-maintained)
- `.claude/plugins/` - Third-party code
- `node_modules/` - Dependencies
- `.git/` - Git internals
- `archived/`, `deprecated/` - Legacy code

---

## Next Steps

1. ✅ Run audit script (DONE)
2. ✅ Generate this report (DONE)
3. ⏳ Fix Phase 1 critical violations (IN PROGRESS)
4. ⏳ Fix Phase 2 high priority violations
5. ⏳ Run audit again to verify fixes
6. ⏳ Update best practices guide with lessons learned
7. ⏳ Add pre-commit hook to prevent future violations

---

## Audit Command

To run this audit again:

```bash
~/.claude/scripts/audit-directory-handling.sh /Users/nathanvale/code/dotfiles
```

To audit specific directory:

```bash
~/.claude/scripts/audit-directory-handling.sh /Users/nathanvale/code/dotfiles/bin
```

---

## Metrics

**Before Fixes**:

- Total Scripts: 106
- Total Violations: 222
- Scripts with Violations: ~80 (75%)
- Average Violations per Script: 2.8

**Target After Fixes**:

- Critical Violations: 0
- High Priority Violations: < 5
- Scripts Following Best Practices: > 90%

---

## References

- Best Practices Guide: `.claude/docs/directory-handling-best-practices.md`
- Audit Script: `.claude/scripts/audit-directory-handling.sh`
- Example Scripts:
  - `create-worktree.sh:1-550` (gold standard)
  - `find-next-task.sh:1-260` (defensive approach)
  - `parallel-claude.sh:1-243` (sourcing pattern)
