# Git Worktree Management

Create, list, and delete git worktrees with automatic file copying and dependency installation.

## When to Use

- Creating a new worktree for parallel branch development
- Listing existing worktrees and their status
- Cleaning up old worktrees after merging
- Setting up `.worktrees.json` configuration for a repo

## Operations

### Create (default when branch name provided)

1. **If no `.worktrees.json` exists**, run the CLI `init` command first and show the user what was auto-detected. Ask if they want to adjust before continuing.
2. **Suggest a branch name** if the user gave a description instead of a branch name:
   - Jira ticket: `feat/PROJ-123-short-description`
   - Feature: `feat/short-description`
   - Bug fix: `fix/short-description`
   - Refactor: `refactor/short-description`
   - Max 50 chars, kebab-case
3. **Confirm** the branch name with the user (they can edit it)
4. **Execute**:
   ```bash
   bun run ${CLAUDE_PLUGIN_ROOT}/src/worktree/cli.ts create <branch-name>
   ```
   Add `--no-install` if the user requests skipping dependency installation.
5. **Report** the result: worktree path, files copied, deps installed

### List

Show all worktrees with their status:

```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/worktree/cli.ts list
```

Add `--all` to include the main worktree.

Display as a table with columns: Branch, Path, Status (clean/dirty), Merged (yes/no).

### Delete

Remove a worktree safely:

1. **If no branch specified**, run `list` first and ask which worktree to delete
2. **Check status** before deleting:
   ```bash
   bun run ${CLAUDE_PLUGIN_ROOT}/src/worktree/cli.ts check <branch-name>
   ```
3. **Warn** the user if:
   - The worktree has uncommitted changes (dirty) — suggest committing first or using `--force`
   - The branch is not merged — warn that work may be lost
4. **Ask** if the branch should also be deleted
5. **Execute**:
   ```bash
   bun run ${CLAUDE_PLUGIN_ROOT}/src/worktree/cli.ts delete <branch-name> [--force] [--delete-branch]
   ```

### Init

Create or show `.worktrees.json` configuration:

```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/worktree/cli.ts init
```

This auto-detects common gitignored files (`.env`, `.claude`, `.nvmrc`, etc.) and the package manager.

## Config File (.worktrees.json)

Located at the repo root. If missing, auto-detected on first use.

```jsonc
{
  "directory": ".worktrees",      // Where worktrees are created
  "copy": [                       // Glob patterns for files to copy
    ".env", ".env.*", ".envrc",
    ".claude", ".kit",
    ".tool-versions", ".nvmrc",
    "PROJECT_INDEX.json",
    "**/CLAUDE.md", "**/*.kit"
  ],
  "exclude": [
    "node_modules", ".git", ".worktrees",
    "dist", "build", "vendor"
  ],
  "postCreate": "bun install",
  "preDelete": null,
  "branchTemplate": "{type}/{description}"
}
```

## CLI Reference

All commands output JSON for structured parsing.

```bash
bun run <plugin>/src/worktree/cli.ts create <branch> [--no-install]
bun run <plugin>/src/worktree/cli.ts list [--all]
bun run <plugin>/src/worktree/cli.ts check <branch>
bun run <plugin>/src/worktree/cli.ts delete <branch> [--force] [--delete-branch]
bun run <plugin>/src/worktree/cli.ts init
```

## Important Notes

- Worktrees are created in the `directory` specified in config (default: `.worktrees/`)
- The `.worktrees/` directory should be added to `.gitignore`
- Branch names with slashes (e.g., `feat/auth`) are converted to hyphens for the directory name
- Files matching `copy` patterns are copied from the main worktree
- The `postCreate` command runs in the new worktree directory
