# Directory Handling Best Practices for Shell Scripts

Comprehensive guide for reliable directory navigation and path resolution in bash scripts. Based on
research from Stack Overflow, Baeldung, and production patterns from git-worktree-runner and our
dotfiles system.

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Pattern Library](#pattern-library)
3. [Common Failure Points](#common-failure-points)
4. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
5. [Production Examples](#production-examples)
6. [Decision Tree](#decision-tree)

---

## Core Principles

### 1. **Prefer Absolute Paths Over cd**

**Why**: `cd` can fail, and after changing directory, relative paths become invalid.

**Bad**:

```bash
cd /some/directory
cp foo.txt /output/
# What if cd failed? We're copying from wrong location!
```

**Good**:

```bash
cp /some/directory/foo.txt /output/
# Always works regardless of current directory
```

**Source**:
[Unix StackExchange - Should shell scripts work in absolute or relative paths?](https://unix.stackexchange.com/questions/320662/should-shell-scripts-work-in-absolute-or-relative-paths)

**Key Insight from Gilles**:

> "Absolute paths are generally preferable. `cd` can fail. Be sure to handle errors properly. After
> a call to `cd`, relative paths become invalid."

---

### 2. **Always Check cd for Errors**

If you must use `cd`, always verify it succeeded before continuing.

**Bad**:

```bash
cd "$SOME_DIR"
rm -rf *  # Disaster if cd failed!
```

**Good**:

```bash
cd "$SOME_DIR" || exit 1
rm -rf *  # Safe - only runs if cd succeeded
```

**Better** (with message):

```bash
cd "$SOME_DIR" || { echo "Failed to cd to $SOME_DIR" >&2; exit 1; }
rm -rf *
```

---

### 3. **Use Git Root as Anchor Point**

For git repositories, use `git rev-parse --show-toplevel` as the canonical project root.

**Pattern**:

```bash
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$GIT_ROOT"
```

**Benefits**:

- Works from any directory within the repo
- Works across all worktrees (they share the same .git)
- Fallback to `pwd` for non-git directories

**Production Usage**: All our scripts use this pattern (create-worktree.sh, find-next-task.sh,
parallel-claude.sh)

---

### 4. **Avoid Changing Directories When Possible**

Use tools that support working in other directories without `cd`.

**Tools with directory support**:

- `git -C <dir> <command>` - Run git command in specific directory
- `(cd <dir> && command)` - Run in subshell (doesn't affect parent)
- Command-specific flags (many commands accept directory arguments)

**Example from our codebase** (create-worktree.sh:476-477):

```bash
# Run git commands in worktree without cd
git -C "$WORKTREE_ABS_PATH" add "$WORKTREE_TASK_FILE"
git -C "$WORKTREE_ABS_PATH" commit -m "chore(${TASK_ID}): start task"
```

**Example from cleanup-merged-worktrees.sh** (cleanup-merged-worktrees.sh:57):

```bash
# Get branch without cd
BRANCH=$(git -C "$WORKTREE_PATH" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
```

---

## Pattern Library

### Pattern 1: Get Script's Own Directory

**Use when**: Script needs to source files relative to itself or access resources in same directory.

**Universal solution** (handles symlinks, relative paths):

```bash
SCRIPT_PATH="${BASH_SOURCE}"
while [ -L "${SCRIPT_PATH}" ]; do
  SCRIPT_DIR="$(cd -P "$(dirname "${SCRIPT_PATH}")" >/dev/null 2>&1 && pwd)"
  SCRIPT_PATH="$(readlink "${SCRIPT_PATH}")"
  [[ ${SCRIPT_PATH} != /* ]] && SCRIPT_PATH="${SCRIPT_DIR}/${SCRIPT_PATH}"
done
SCRIPT_PATH="$(readlink -f "${SCRIPT_PATH}")"
SCRIPT_DIR="$(cd -P "$(dirname -- "${SCRIPT_PATH}")" >/dev/null 2>&1 && pwd)"
```

**Simpler version** (if symlinks aren't a concern):

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
```

**Production example** (parallel-claude.sh:70-71):

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COLOUR_LOG_PATH="$(dirname "$SCRIPT_DIR")/utils/colour_log.sh"
```

**Source**:
[Baeldung - Get Bash Script Location From Within the Script](https://www.baeldung.com/linux/bash-get-location-within-script)

---

### Pattern 2: Get Git Repository Root

**Use when**: Script operates on git repository and needs consistent anchor point.

**Standard pattern**:

```bash
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$GIT_ROOT"
```

**With error handling**:

```bash
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$GIT_ROOT" ]; then
    echo "Error: Not in a git repository" >&2
    exit 1
fi
cd "$GIT_ROOT" || exit 1
```

**Production example** (find-next-task.sh:31-40):

```bash
# Get the absolute path to the git repository root
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")

if [ -z "$GIT_ROOT" ]; then
    # Not in a git repository - use current directory
    GIT_ROOT=$(pwd)
fi

# Change to git root to ensure consistent path resolution
cd "$GIT_ROOT"
```

**Production example** (parallel-claude.sh:33-35):

```bash
# Get git root for config reading
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$GIT_ROOT"
```

---

### Pattern 3: Run Commands in Specific Directory (Without cd)

**Use when**: Need to run command in another directory but maintain current location.

**Method 1: Subshell** (doesn't affect parent shell):

```bash
(cd "$TARGET_DIR" && npm install)
# Still in original directory here
```

**Method 2: Git -C flag**:

```bash
git -C "$WORKTREE_PATH" status
git -C "$WORKTREE_PATH" add .
git -C "$WORKTREE_PATH" commit -m "message"
```

**Method 3: Command-specific directory arguments**:

```bash
# Many commands support directory arguments
ls "$TARGET_DIR"
find "$TARGET_DIR" -name "*.md"
```

**Production example** (create-worktree.sh:403-404):

```bash
# Install in worktree without cd
if (cd "$WORKTREE_ABS_PATH" && $PKG_MGR install 2>&1 | grep -v "deprecated"); then
    INSTALL_SUCCESS=true
fi
```

---

### Pattern 4: Resolve Relative to Absolute Paths

**Use when**: Converting user-provided relative paths to absolute paths.

**Using readlink**:

```bash
ABSOLUTE_PATH=$(readlink -f "$RELATIVE_PATH")
```

**Using pwd + dirname**:

```bash
ABSOLUTE_PATH="$(cd "$(dirname "$RELATIVE_PATH")" && pwd)/$(basename "$RELATIVE_PATH")"
```

**Manual prepend** (if already know you're in correct directory):

```bash
ABSOLUTE_PATH="$PWD/$RELATIVE_PATH"
```

**Production example** (get-project-lock-dir.sh:12-13):

```bash
# Get absolute path to git repository root
local git_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
```

**Note**: `git rev-parse --show-toplevel` always returns absolute paths.

---

### Pattern 5: Source Files from Known Locations

**Use when**: Script needs to load helper functions or libraries.

**Pattern A: Source from script's directory**:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/helpers.sh"
```

**Pattern B: Source from home directory**:

```bash
source ~/.claude/scripts/lib/get-project-lock-dir.sh
```

**Pattern C: Source with verification**:

```bash
COLOUR_LOG_PATH="$(dirname "$SCRIPT_DIR")/utils/colour_log.sh"
if [ -f "$COLOUR_LOG_PATH" ]; then
    source "$COLOUR_LOG_PATH"
else
    # Fallback logging functions
    log_info() { echo "[INFO] $*"; }
    log_error() { echo "[ERROR] $*" >&2; }
fi
```

**Production example** (parallel-claude.sh:69-79):

```bash
# Source color logging utilities if available
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COLOUR_LOG_PATH="$(dirname "$SCRIPT_DIR")/utils/colour_log.sh"
if [ -f "$COLOUR_LOG_PATH" ]; then
    source "$COLOUR_LOG_PATH"
else
    # Fallback logging functions
    log_info() { echo "[INFO] $*"; }
    log_success() { echo "[SUCCESS] $*"; }
    log_error() { echo "[ERROR] $*" >&2; }
fi
```

---

### Pattern 6: Create Directories Safely

**Use when**: Ensuring directory exists before operations.

**With error handling**:

```bash
mkdir -p "$TARGET_DIR" || {
    echo "Failed to create directory: $TARGET_DIR" >&2
    exit 1
}
```

**With verification**:

```bash
if [ ! -d "$TARGET_DIR" ]; then
    mkdir -p "$TARGET_DIR"
fi
```

**For critical operations**:

```bash
mkdir -p "$TARGET_DIR" || exit 1
if [ ! -d "$TARGET_DIR" ]; then
    echo "Directory creation reported success but directory doesn't exist!" >&2
    exit 1
fi
```

---

## Common Failure Points

### 1. **Unhandled cd Failures**

**Problem**: Script continues after `cd` fails, operating in wrong directory.

**Example**:

```bash
#!/bin/bash
cd /nonexistent/path
rm -rf *  # Runs in current directory if cd failed!
```

**Impact**: Data loss, file corruption, security issues.

**Fix**:

```bash
cd /target/path || exit 1
# Or with set -e at top of script
```

**Real-world consequence**: Without `set -e` or explicit error checking, destructive commands run in
unintended locations.

---

### 2. **Relative Paths After cd**

**Problem**: File paths passed as arguments become invalid after `cd`.

**Example**:

```bash
#!/bin/bash
INPUT_FILE="$1"  # User passes: ./data/input.txt

cd /processing/directory
# Now ./data/input.txt points to /processing/directory/data/input.txt (wrong!)
process "$INPUT_FILE"
```

**Fix**: Convert to absolute before cd:

```bash
INPUT_FILE="$(readlink -f "$1")"
cd /processing/directory
process "$INPUT_FILE"  # Now absolute path works
```

**Source**: Unix StackExchange - After a call to `cd`, relative paths become invalid.

---

### 3. **Assuming Current Working Directory**

**Problem**: Script assumes it's run from specific directory.

**Bad**:

```bash
#!/bin/bash
# Assumes run from project root
npm install
```

**Good**:

```bash
#!/bin/bash
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$GIT_ROOT" || exit 1
npm install
```

**Why this matters**: Users may run script from subdirectories, symlinks, or via absolute paths.

---

### 4. **Unresolved Symlinks**

**Problem**: `BASH_SOURCE` contains symlink path, not real script location.

**Bad**:

```bash
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$SCRIPT_DIR/config.sh"  # Fails if BASH_SOURCE is symlink to different directory
```

**Good**: Use the universal solution from Pattern 1 (handles symlinks).

---

### 5. **Race Conditions in Directory Changes**

**Problem**: Multiple processes changing to same directory can cause conflicts.

**Example**:

```bash
# Process 1
cd "$SHARED_DIR"
echo "data" > output.txt  # Writes to $SHARED_DIR/output.txt

# Process 2 (runs simultaneously)
cd "$SHARED_DIR"
echo "data" > output.txt  # Overwrites!
```

**Fix**: Use unique filenames or absolute paths:

```bash
OUTPUT_FILE="$SHARED_DIR/output-$$.txt"  # $$ is PID
echo "data" > "$OUTPUT_FILE"
```

---

### 6. **Missing Error Output**

**Problem**: Silencing errors from cd hides failures.

**Bad**:

```bash
cd "$TARGET_DIR" 2>/dev/null
# Silently fails, script continues in wrong directory
```

**Good**:

```bash
cd "$TARGET_DIR" || {
    echo "Failed to cd to $TARGET_DIR" >&2
    exit 1
}
```

---

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Multiple Sequential cd Calls

**Why bad**: Increases failure surface, makes paths hard to track.

**Bad**:

```bash
cd /projects
cd myproject
cd src
cd components
# What if any of these fail?
```

**Good**:

```bash
TARGET="/projects/myproject/src/components"
cd "$TARGET" || exit 1
```

**Better** (avoid cd entirely):

```bash
ls /projects/myproject/src/components
find /projects/myproject/src/components -name "*.js"
```

---

### ❌ Anti-Pattern 2: cd Without Error Handling

**Why bad**: Silent failures lead to operations in wrong directory.

**Bad**:

```bash
cd "$USER_PROVIDED_PATH"
rm -rf build/
```

**Good**:

```bash
cd "$USER_PROVIDED_PATH" || exit 1
rm -rf build/
```

---

### ❌ Anti-Pattern 3: Relying on $0 for Script Location

**Why bad**: `$0` is unreliable when sourcing scripts.

**Bad**:

```bash
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/lib.sh"  # Fails when script is sourced
```

**Good**:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
```

---

### ❌ Anti-Pattern 4: Using cd for Simple File Operations

**Why bad**: Unnecessary complexity, prone to errors.

**Bad**:

```bash
OLD_PWD=$(pwd)
cd "$TARGET_DIR"
cat config.json
cd "$OLD_PWD"
```

**Good**:

```bash
cat "$TARGET_DIR/config.json"
```

---

### ❌ Anti-Pattern 5: Not Using set -e

**Why bad**: Script continues after errors.

**Bad**:

```bash
#!/bin/bash
cd /critical/path
rm -rf *  # Still runs even if cd failed
```

**Good**:

```bash
#!/bin/bash
set -e  # Exit on any error

cd /critical/path
rm -rf *  # Only runs if cd succeeded
```

**Note**: Our production scripts all use `set -e`.

---

### ❌ Anti-Pattern 6: Hardcoded Paths

**Why bad**: Not portable across systems or projects.

**Bad**:

```bash
cd /Users/nathanvale/code/myproject
```

**Good**:

```bash
GIT_ROOT=$(git rev-parse --show-toplevel)
cd "$GIT_ROOT"
```

---

## Production Examples

### Example 1: create-worktree.sh (Git-Aware Script)

**Pattern**: Get git root, cd once at start, use absolute paths for everything else.

```bash
#!/bin/bash
set -e  # Exit on error

# STEP 1: Get git root immediately
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$GIT_ROOT"

# STEP 2: All paths now relative to git root
TASK_DIR="docs/tasks"
WORKTREE_PATH="./.worktrees/$TASK_ID"

# STEP 3: Use absolute paths when needed
WORKTREE_ABS_PATH="$GIT_ROOT/$WORKTREE_PATH"

# STEP 4: Run commands in other directories without cd
git -C "$WORKTREE_ABS_PATH" add "$TASK_FILE"
git -C "$WORKTREE_ABS_PATH" commit -m "message"

# STEP 5: Use subshells for temporary directory changes
if (cd "$WORKTREE_ABS_PATH" && npm install); then
    echo "✓ Dependencies installed"
fi
```

**Key takeaways**:

- Single `cd` at start to establish anchor point
- All subsequent paths relative to known location
- Use `git -C` to avoid additional `cd` calls
- Use subshells `(cd ... && ...)` for isolated operations

---

### Example 2: parallel-claude.sh (Script with Sourcing)

**Pattern**: Get own directory for sourcing dependencies.

```bash
#!/bin/bash
set -e

# STEP 1: Get git root for config
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$GIT_ROOT"

# STEP 2: Get script's own directory for sourcing
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# STEP 3: Source helpers with fallback
COLOUR_LOG_PATH="$(dirname "$SCRIPT_DIR")/utils/colour_log.sh"
if [ -f "$COLOUR_LOG_PATH" ]; then
    source "$COLOUR_LOG_PATH"
else
    log_info() { echo "[INFO] $*"; }
fi

# STEP 4: Use git config (now in git root)
MAX_AGENTS=$(git config --get gtr.parallel.max 2>/dev/null || echo "50")
```

**Key takeaways**:

- Know your anchor point (git root vs script directory)
- Use appropriate pattern for each need
- Always provide fallbacks for sourced files

---

### Example 3: find-next-task.sh (Defensive Directory Handling)

**Pattern**: Defensive approach with fallbacks and validation.

```bash
#!/bin/bash
set -e

# STEP 1: Detect git root with fallback
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")

if [ -z "$GIT_ROOT" ]; then
    # Not in a git repository - use current directory
    GIT_ROOT=$(pwd)
fi

# STEP 2: Change to git root
cd "$GIT_ROOT"

# STEP 3: Auto-detect task directory with fallbacks
TASK_DIR=""
if [ -d "apps/migration-cli/docs/tasks" ]; then
    TASK_DIR="apps/migration-cli/docs/tasks"
elif [ -d "docs/tasks" ]; then
    TASK_DIR="docs/tasks"
elif [ -d "tasks" ]; then
    TASK_DIR="tasks"
else
    # No task directory found - silent exit
    exit 1
fi
```

**Key takeaways**:

- Always handle non-git directories
- Provide multiple fallback locations
- Fail gracefully with appropriate exit codes

---

### Example 4: get-project-lock-dir.sh (Centralized Helper)

**Pattern**: Library function that returns absolute paths.

```bash
#!/bin/bash

get_project_lock_dir() {
    # STEP 1: Get absolute path to git repository root
    local git_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

    # STEP 2: Convert path to project identifier
    # Example: /Users/nathanvale/code/dotfiles → -Users-nathanvale-code-dotfiles
    local project_id=$(echo "$git_root" | sed 's/\//-/g' | sed 's/^-//')

    # STEP 3: Return centralized lock directory path
    echo "$HOME/.claude/projects/${project_id}/task-locks"
}
```

**Key takeaways**:

- Helper functions should return absolute paths
- Don't change directory in library functions
- Make paths portable via $HOME

---

## Decision Tree

Use this flowchart to choose the right pattern:

```
┌─────────────────────────────────────┐
│ Need to work with files/directories │
└──────────────┬──────────────────────┘
               │
               ▼
       ┌───────────────┐
       │ In git repo?  │
       └───┬───────┬───┘
           │ Yes   │ No
           │       │
           │       └──────► Use pwd or script dir
           │
           ▼
    ┌──────────────────┐
    │ Need git root?   │
    └──┬────────────┬──┘
      │ Yes        │ No
      │            │
      │            └──────► Use script dir
      │
      ▼
  git rev-parse --show-toplevel
      │
      ▼
  cd "$GIT_ROOT" || exit 1
      │
      ▼
  ┌────────────────────────────────┐
  │ Multiple directory operations? │
  └──┬─────────────────────────┬───┘
     │ Yes                     │ No
     │                         │
     │                         └──────► Use absolute paths
     │
     ▼
  ┌──────────────────────┐
  │ Can avoid cd?        │
  └──┬────────────────┬──┘
    │ Yes            │ No
    │                │
    │                └──────► cd with error check
    │
    ▼
 Use one of:
 • git -C <dir> <cmd>
 • (cd <dir> && cmd)
 • Absolute paths
```

**Quick selection guide**:

| Scenario                     | Pattern        | Example                         |
| ---------------------------- | -------------- | ------------------------------- |
| Git repo script              | Get git root   | `git rev-parse --show-toplevel` |
| Source helper files          | Get script dir | `dirname "${BASH_SOURCE[0]}"`   |
| Run single command elsewhere | Subshell       | `(cd "$DIR" && cmd)`            |
| Run git commands elsewhere   | git -C flag    | `git -C "$DIR" status`          |
| User-provided paths          | Make absolute  | `readlink -f "$PATH"`           |
| Create directories           | mkdir -p       | `mkdir -p "$DIR" \|\| exit 1`   |

---

## Checklist for New Scripts

Use this checklist when writing new bash scripts:

- [ ] Script starts with `#!/bin/bash` and `set -e`
- [ ] Establishes anchor point early (git root or script dir)
- [ ] Single `cd` at start if needed, never multiple `cd` calls
- [ ] All `cd` calls have error handling (`|| exit 1`)
- [ ] Uses `BASH_SOURCE` instead of `$0` for script location
- [ ] Converts relative paths to absolute before changing directories
- [ ] Uses `git -C` or subshells instead of `cd` when possible
- [ ] Provides fallbacks for sourced files
- [ ] Uses absolute paths for critical operations
- [ ] No hardcoded paths (use $HOME, git root, etc.)

---

## Summary

### ✅ DO

1. Use `git rev-parse --show-toplevel` for git repository anchor
2. Use `BASH_SOURCE` for script's own location
3. Check `cd` for errors with `|| exit 1`
4. Prefer absolute paths over relative paths
5. Use `git -C` to avoid changing directories
6. Use subshells `(cd DIR && cmd)` for isolated operations
7. Start scripts with `set -e` for automatic error handling
8. Convert user paths to absolute before `cd`
9. Provide fallbacks for sourced files

### ❌ DON'T

1. Use multiple sequential `cd` calls
2. Use `cd` without error handling
3. Rely on `$0` for script location
4. Change directory for simple file operations
5. Hardcode absolute paths
6. Assume you're in a specific directory
7. Silence errors with `2>/dev/null` on critical operations
8. Use relative paths after `cd`

### 🎯 Golden Rule

**Establish your anchor point once (git root or script directory), then use absolute paths or tools
that work from anywhere.**

---

## Further Reading

- [Stack Overflow: Get git root directory](https://stackoverflow.com/questions/957928/is-there-a-way-to-get-the-git-root-directory-in-one-command)
- [Unix StackExchange: Absolute vs relative paths in scripts](https://unix.stackexchange.com/questions/320662/should-shell-scripts-work-in-absolute-or-relative-paths)
- [Baeldung: Get Bash Script Location](https://www.baeldung.com/linux/bash-get-location-within-script)
- [Our npm-install-analysis.md](./.claude/docs/npm-install-analysis.md) - Real-world worktree
  patterns
- [Our git-config-options.md](./.claude/docs/git-config-options.md) - Git configuration patterns
