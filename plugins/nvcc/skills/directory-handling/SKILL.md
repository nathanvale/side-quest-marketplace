---
name: directory-handling
description:
  Expert guidance for reliable bash script directory navigation and path handling. Use when writing
  new bash scripts, reviewing existing scripts, debugging directory-related failures, or when
  mentioned 'directory handling', 'bash paths', 'cd errors', 'script location', or 'git root'.
  Provides deterministic patterns to eliminate silent failures from unhandled cd, missing set -e,
  and path resolution issues.
---

# Directory Handling Best Practices

Provides expert guidance for writing reliable bash scripts with deterministic directory navigation
and path handling. This skill eliminates entire classes of failures from unhandled `cd` calls,
missing error handling, and incorrect path resolution.

## When to Use This Skill

Trigger this skill proactively when:

- Writing new bash scripts that navigate directories
- Reviewing bash scripts for reliability issues
- Debugging directory-related failures or "command not found" errors
- Refactoring scripts with multiple `cd` calls
- User mentions: "directory handling", "bash paths", "cd errors", "script location", "git root",
  "BASH_SOURCE", "set -e"

## Core Principles

### 1. Always Use `set -e` for Error Handling

Add `set -e` immediately after the shebang in all executable scripts (but NOT in library files that
are sourced):

```bash
#!/usr/bin/env bash
set -e  # Exit immediately on error
```

**Why**: Without `set -e`, scripts continue after errors, potentially executing destructive commands
in wrong directories.

**Exception**: Library files (like `colour_log.sh`) that are sourced into other scripts should NOT
use `set -e` as it affects the calling script.

### 2. Prefer Absolute Paths Over cd

Use absolute paths instead of changing directories when possible:

**Bad**:

```bash
cd /some/directory
cp foo.txt /output/
```

**Good**:

```bash
cp /some/directory/foo.txt /output/
```

**Why**: `cd` can fail, and after changing directory, relative paths become invalid.

### 3. Establish Single Anchor Point Early

For git repositories, use `git rev-parse --show-superproject-working-tree` to handle worktrees:

```bash
# Get main repo root (works from worktrees too)
GIT_ROOT=$(git rev-parse --show-superproject-working-tree 2>/dev/null)
if [ -z "$GIT_ROOT" ]; then
  GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
fi
cd "$GIT_ROOT" || exit 1
```

**Why**:

- `--show-superproject-working-tree` returns main repo path when in a worktree
- Falls back to `--show-toplevel` when in main repo
- Provides consistent base directory regardless of where script is run from
- **Critical for worktree-based parallel workflows** (multiple agents, task isolation)

### 4. Use BASH_SOURCE for Script Location

Get script's own directory using `BASH_SOURCE` (not `$0`):

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
```

**Why**: `$0` fails when script is sourced; `BASH_SOURCE` works in all contexts.

## Standard Patterns

### Pattern 1: Git Repository Script (Worktree-Safe)

For scripts that operate on git repositories:

```bash
#!/usr/bin/env bash
set -e

# Establish git root as anchor point (worktree-safe)
GIT_ROOT=$(git rev-parse --show-superproject-working-tree 2>/dev/null)
if [ -z "$GIT_ROOT" ]; then
  GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
fi
cd "$GIT_ROOT" || exit 1

# All paths now relative to known location
TASK_DIR="docs/tasks"
CONFIG_FILE="$GIT_ROOT/.config/settings.json"
```

**When to use**: Scripts that work with git repositories, task files, or project structure.

**Why worktree-safe**: If script runs from worktree (`.worktrees/T0042/`), this pattern ensures it
still resolves to main repo path, not worktree path. Critical for:

- Lock file coordination across parallel agents
- Shared configuration access
- Task file management
- Centralized state tracking

**Examples**: create-worktree.sh, find-next-task.sh, parallel-claude.sh, get-project-lock-dir.sh

### Pattern 2: Script with Dependencies

For scripts that source helper files or libraries:

```bash
#!/usr/bin/env bash
set -e

# Get script's own directory for sourcing
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source dependencies with fallback
HELPER_PATH="$SCRIPT_DIR/../lib/helpers.sh"
if [ -f "$HELPER_PATH" ]; then
    source "$HELPER_PATH"
else
    # Provide fallback implementations
    log_info() { echo "[INFO] $*"; }
fi
```

**When to use**: Scripts that need to load configuration files or helper functions from known
locations.

**Examples**: parallel-claude.sh, hyperflow.sh

### Pattern 3: Avoid cd with git -C

Run git commands in specific directories without changing current directory:

```bash
# Instead of:
cd "$WORKTREE_PATH"
git add file.txt
git commit -m "message"

# Use:
git -C "$WORKTREE_PATH" add file.txt
git -C "$WORKTREE_PATH" commit -m "message"
```

**When to use**: When running git commands in multiple different directories.

**Examples**: create-worktree.sh, cleanup-merged-worktrees.sh

### Pattern 4: Isolated Operations with Subshells

Execute commands in another directory without affecting parent shell:

```bash
# Subshell: cd only affects code inside parentheses
if (cd "$TARGET_DIR" && npm install); then
    echo "✓ Dependencies installed"
else
    echo "⚠️  Installation failed"
fi
# Still in original directory here
```

**When to use**: Need to run commands in another directory but maintain current location.

**Examples**: create-worktree.sh for npm/pnpm installs

### Pattern 5: Convert Relative to Absolute Paths

Convert user-provided relative paths to absolute before any directory changes:

```bash
# Convert early, before any cd
INPUT_FILE="$(readlink -f "$1")"

# Now safe to change directories
cd "$WORK_DIR"

# Absolute path still valid
process "$INPUT_FILE"
```

**When to use**: Scripts that accept file paths as arguments and need to change directories.

### Pattern 6: Return Absolute Paths from Functions (Worktree-Safe)

Helper functions should return absolute paths and handle worktrees:

```bash
get_project_lock_dir() {
    # Get main repo root (not worktree)
    local main_repo=$(git rev-parse --show-superproject-working-tree 2>/dev/null)
    if [ -z "$main_repo" ]; then
        main_repo=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
    fi

    local project_id=$(echo "$main_repo" | sed 's/\//-/g' | sed 's/^-//')
    echo "$HOME/.claude/projects/${project_id}/task-locks"
}

# Usage: always absolute, works from anywhere (main repo or worktree)
LOCK_DIR=$(get_project_lock_dir)
```

**When to use**: Creating reusable library functions that must work from both main repo and
worktrees.

**Why critical**: Without `--show-superproject-working-tree`, this function returns different paths
depending on whether called from main repo or worktree, breaking lock coordination and causing
orphaned locks.

**Examples**: get-project-lock-dir.sh

## Automated Tools

This skill includes two automated scripts in `scripts/`:

### Audit Script: `audit-directory-handling.sh`

Checks scripts for 7 violation types:

1. Missing `set -e`
2. Unhandled `cd` calls
3. Uses `$0` instead of `BASH_SOURCE`
4. Multiple `cd` calls
5. Hardcoded paths
6. `cd` without error handling
7. Git operations without root anchor

**Usage**:

```bash
scripts/audit-directory-handling.sh /path/to/project
```

**When to use**: Before committing changes, during code review, or when debugging directory issues.

### Fix Script: `fix-directory-handling.sh`

Automatically adds `set -e` to scripts missing it (skips library files).

**Usage**:

```bash
# Preview changes
scripts/fix-directory-handling.sh --dry-run

# Apply fixes
scripts/fix-directory-handling.sh
```

**When to use**: After audit identifies missing `set -e` in multiple scripts.

## Common Failure Points to Avoid

### ❌ Anti-Pattern 1: Unhandled cd

**Problem**: Script continues in wrong directory if `cd` fails.

```bash
# BAD
cd /target
rm -rf build/  # Disaster if cd failed!
```

**Fix**: Add `set -e` at top of script, or use `|| exit 1`:

```bash
# GOOD
set -e
cd /target
rm -rf build/  # Only runs if cd succeeded
```

### ❌ Anti-Pattern 2: Multiple Sequential cd Calls

**Problem**: Difficult to track current directory; increases failure surface.

```bash
# BAD
cd /projects
cd myproject
cd src
```

**Fix**: Use single `cd` to final destination:

```bash
# GOOD
cd /projects/myproject/src
```

**Better**: Avoid `cd` entirely with absolute paths:

```bash
# BEST
ls /projects/myproject/src
```

### ❌ Anti-Pattern 3: Using $0 for Script Location

**Problem**: `$0` is unreliable when script is sourced.

```bash
# BAD
SCRIPT_DIR="$(dirname "$0")"
```

**Fix**: Use `BASH_SOURCE`:

```bash
# GOOD
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
```

### ❌ Anti-Pattern 4: Relative Paths After cd

**Problem**: File paths passed as arguments become invalid after `cd`.

```bash
# BAD
INPUT="$1"  # User passes: ./data/file.txt
cd /work/dir
process "$INPUT"  # Now points to /work/dir/data/file.txt (wrong!)
```

**Fix**: Convert to absolute before `cd`:

```bash
# GOOD
INPUT="$(readlink -f "$1")"
cd /work/dir
process "$INPUT"  # Still points to original file
```

### ❌ Anti-Pattern 5: Hardcoded Absolute Paths

**Problem**: Not portable across systems or users.

```bash
# BAD
cd /Users/nathanvale/code/myproject
```

**Fix**: Use variables or git root:

```bash
# GOOD
GIT_ROOT=$(git rev-parse --show-superproject-working-tree 2>/dev/null)
if [ -z "$GIT_ROOT" ]; then
  GIT_ROOT=$(git rev-parse --show-toplevel)
fi
cd "$GIT_ROOT"
```

### ❌ Anti-Pattern 6: Using --show-toplevel Without Worktree Handling

**Problem**: Returns different paths from main repo vs worktree, breaking coordination.

```bash
# BAD - Breaks in worktrees!
get_lock_dir() {
    local git_root=$(git rev-parse --show-toplevel)  # ⚠️ Returns worktree path!
    echo "$HOME/.locks/${git_root}"
}

# From main repo:    /Users/name/code/project
# From worktree:     /Users/name/code/project/.worktrees/T0042
# Result: Different lock directories = orphaned locks!
```

**Impact**:

- Lock files not cleaned up after task completion
- Parallel execution breaks (tasks appear locked forever)
- State files diverge between main repo and worktrees
- Configuration changes don't propagate

**Fix**: Always use `--show-superproject-working-tree` first:

```bash
# GOOD - Works everywhere!
get_lock_dir() {
    local main_repo=$(git rev-parse --show-superproject-working-tree 2>/dev/null)
    if [ -z "$main_repo" ]; then
        main_repo=$(git rev-parse --show-toplevel)
    fi
    echo "$HOME/.locks/${main_repo}"
}

# From main repo:    /Users/name/code/project
# From worktree:     /Users/name/code/project
# Result: Same lock directory = coordination works!
```

**Real-world impact**: This exact bug blocked all parallel Claude Code agents because lock files
weren't being cleaned up when tasks completed in worktrees. Fixed in commits 492f7e8 and 0ee9ce8.

## Decision Tree

```
Need to work with files/directories?
│
├─ In git repo?
│  ├─ Yes → Use git rev-parse --show-toplevel
│  └─ No  → Use script directory or pwd
│
├─ Multiple operations in same directory?
│  ├─ Yes → cd once to anchor point
│  └─ No  → Use absolute paths (no cd)
│
├─ Run git commands elsewhere?
│  └─ Use: git -C <dir> <command>
│
├─ Run non-git commands elsewhere?
│  └─ Use: (cd <dir> && command)
│
└─ Accept file paths as arguments?
   └─ Convert to absolute with readlink -f early
```

## Quick Checklist for New Scripts

Use this checklist when writing new bash scripts:

- [ ] Starts with `#!/usr/bin/env bash`
- [ ] Has `set -e` after shebang (unless it's a library)
- [ ] Establishes anchor point early (git root or script dir)
- [ ] **Uses `--show-superproject-working-tree` for worktree-safe git root**
- [ ] Single `cd` at start if needed, never multiple
- [ ] All `cd` calls have error handling
- [ ] Uses `BASH_SOURCE` instead of `$0` for script location
- [ ] Converts relative paths to absolute before `cd`
- [ ] Uses `git -C` or subshells instead of `cd` when possible
- [ ] Uses absolute paths for critical operations
- [ ] No hardcoded paths (uses variables or git root)
- [ ] Functions return absolute paths that work from both main repo and worktrees

## Reference Documentation

Detailed reference material is available in `references/`:

- **`best-practices.md`**: Comprehensive 700+ line guide with:
  - 6 production-ready patterns with real-world examples
  - Common failure points and anti-patterns
  - Decision tree for pattern selection
  - Production examples from dotfiles codebase
  - Research citations from Stack Overflow and Baeldung

- **`audit-report.md`**: Analysis of 106 bash scripts showing:
  - Violation categorization by severity
  - Before/after metrics from fixes
  - Prioritized fix recommendations
  - Examples of excellent scripts following best practices

**When to read references**:

- Detailed pattern examples needed
- Understanding failure point impacts
- Need production code examples
- Researching specific anti-patterns

**Search patterns for references**:

```bash
# Find specific patterns
grep -n "Pattern [0-9]:" references/best-practices.md

# Find anti-patterns
grep -n "Anti-Pattern" references/best-practices.md

# Find production examples
grep -n "Example [0-9]:" references/best-practices.md
```

## Workflow

### Writing a New Script

1. **Start with worktree-safe template**:

   ```bash
   #!/usr/bin/env bash
   set -e

   # Get main repo root (worktree-safe)
   GIT_ROOT=$(git rev-parse --show-superproject-working-tree 2>/dev/null)
   if [ -z "$GIT_ROOT" ]; then
     GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
   fi
   cd "$GIT_ROOT"
   ```

2. **Choose appropriate pattern** based on script needs (see Decision Tree)

3. **Run audit** when complete:
   ```bash
   scripts/audit-directory-handling.sh /path/to/new/script.sh
   ```

### Reviewing Existing Scripts

1. **Run audit** on directory or project:

   ```bash
   scripts/audit-directory-handling.sh /path/to/project
   ```

2. **Prioritize fixes** by severity:
   - Critical: Unhandled `cd`, missing `set -e`
   - High: Hardcoded paths, multiple `cd` calls
   - Low: Uses `$0` instead of `BASH_SOURCE`

3. **Apply automated fixes** where possible:

   ```bash
   scripts/fix-directory-handling.sh --dry-run  # Preview
   scripts/fix-directory-handling.sh            # Apply
   ```

4. **Manual review** for patterns requiring refactoring

### Debugging Directory Issues

When user reports:

- "Command not found" errors
- "File not found" in scripts
- Silent failures
- Incorrect file operations

**Investigation steps**:

1. Check if script has `set -e`
2. Look for unhandled `cd` calls
3. Verify anchor point is established
4. Check if relative paths used after `cd`
5. Run audit script for comprehensive check

## Integration with Existing Workflows

**Pre-commit hooks**:

```bash
# Add to .git/hooks/pre-commit
~/.claude/skills/directory-handling/scripts/audit-directory-handling.sh --changed-files
```

**CI/CD**:

```yaml
# Add to GitHub Actions
- name: Audit Directory Handling
  run: ~/.claude/skills/directory-handling/scripts/audit-directory-handling.sh
```

**Code review**:

- Include audit results in PR descriptions
- Link to specific violations in review comments
- Reference pattern examples from best-practices.md

## Success Metrics

Scripts following these practices will have:

- ✅ Zero unhandled `cd` failures
- ✅ Predictable behavior from any directory
- ✅ Clear error messages when paths invalid
- ✅ Portable across systems and users
- ✅ Easier to debug and maintain

## Examples from Production

### Excellent: create-worktree.sh

Demonstrates all best practices:

- Uses `set -e` for error handling
- Single `cd` to git root at start
- Uses `git -C` to avoid additional `cd` calls
- Uses `BASH_SOURCE` for script location
- Converts paths to absolute early
- Provides clear error messages

### Excellent: get-project-lock-dir.sh

Demonstrates library pattern:

- NO `set -e` (it's a library)
- Returns absolute paths
- No directory changes
- Uses `$HOME` for portability

### Excellent: parallel-claude.sh

Demonstrates sourcing pattern:

- Gets git root for config
- Gets script directory for sourcing
- Provides fallbacks for missing dependencies
- Single `cd` to git root

These examples are fully documented with line numbers and explanations in
`references/best-practices.md`.
