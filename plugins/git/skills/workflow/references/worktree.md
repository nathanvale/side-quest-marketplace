# Git Worktree Management

Create, list, and delete git worktrees with automatic file copying.

## When to Use

- Creating a new worktree for parallel branch development
- Listing existing worktrees and their status
- Cleaning up old worktrees after merging
- Setting up `.worktrees.json` configuration for a repo

## Operations

### Create (default when branch name provided)

1. **If no `.worktrees.json` exists**, run the CLI `init` command first and show the user what was auto-detected. Ask if they want to adjust before continuing.
2. **Suggest a branch name** if the user gave a description instead of a branch name (same logic as before)
3. **Confirm** the branch name with the user. When a branch name is provided in `$ARGUMENTS`, skip the branch name confirmation.
4. **Execute**:
   ```bash
   bunx @side-quest/git worktree create <branch-name> --no-fetch --no-install
   ```
5. The CLI creates the worktree and copies config files. It does NOT install dependencies.
6. To install dependencies: `bunx @side-quest/git worktree install <path>`
7. For attach-to-existing (branch already has worktree), the CLI re-syncs files automatically.
8. **Report** the result: worktree path, files copied, attached status

### List

Show all worktrees with their status:

```bash
bunx @side-quest/git worktree list
```

Add `--all` to include the main worktree.

Display as a table with columns: Branch, Path, Status (clean/dirty), Merged (yes/no).

### Delete

Remove a worktree safely:

1. **If no branch specified**, run `list` first and ask which worktree to delete
2. **Check status** before deleting:
   ```bash
   bunx @side-quest/git worktree check <branch-name>
   ```
3. **Warn** the user if:
   - The worktree has uncommitted changes (dirty) — suggest committing first or using `--force`
   - The branch is not merged — warn that work may be lost
4. **Ask** if the branch should also be deleted. When `$ARGUMENTS` contains `--force`, skip confirmation. When `$ARGUMENTS` contains `--delete-branch`, also delete the branch without asking.
5. **Execute**:
   ```bash
   bunx @side-quest/git worktree delete <branch-name> [--force] [--delete-branch]
   ```

### Init

Create or show `.worktrees.json` configuration:

```bash
bunx @side-quest/git worktree init
```

This auto-detects common gitignored files (`.env`, `.claude`, `.nvmrc`, etc.) and the package manager.

### Sync

Re-copy config files from the main worktree to an existing worktree:

1. If no branch specified, run `list` first and ask which worktree to sync
2. Execute: `bunx @side-quest/git worktree sync <branch-name> [--all] [--dry-run]`
3. Report which files were updated (the CLI returns per-file detail in `files` array)

Use when: .env or .claude configs changed in main and need propagating.

### Clean

Batch-delete worktrees that are merged and clean:

1. Preview: `bunx @side-quest/git worktree clean --dry-run`
2. Show user which worktrees would be removed
3. Confirm before proceeding
4. Execute: `bunx @side-quest/git worktree clean [--delete-branches]`

Safety: Only removes merged+clean worktrees. Never dirty without --force.

### Status

Show enriched status: `bunx @side-quest/git worktree status [--pr]`

Displays: Branch, commits ahead/behind, PR status, last activity, dirty/clean.

**Note:** Requires @side-quest/git v0.1.0+. Falls back to
`bunx @side-quest/git worktree list` for basic branch/path/dirty info.

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

## Observability

Events emitted by CLI commands use the `EventEnvelope` schema from `@side-quest/git/events`:

| Operation | Event Type | Payload Type |
|-----------|-----------|-------------|
| create | `worktree.created` | `CreateResult` |
| delete | `worktree.deleted` | `DeleteResult` |
| sync | `worktree.synced` | `SyncResult` |
| clean | `worktree.cleaned` | `CleanResult` |
| install | `worktree.installed` | `InstallResult` |

## CLI Reference

All commands output JSON for structured parsing.

```bash
bunx @side-quest/git worktree create <branch> [--no-install] [--no-fetch] [--attach]
bunx @side-quest/git worktree list [--all]
bunx @side-quest/git worktree check <branch>
bunx @side-quest/git worktree delete <branch> [--force] [--delete-branch]
bunx @side-quest/git worktree init
bunx @side-quest/git worktree sync <branch> [--all] [--dry-run]
bunx @side-quest/git worktree clean [--dry-run] [--delete-branches] [--force]
bunx @side-quest/git worktree status [--pr]
bunx @side-quest/git worktree install <path>
bunx @side-quest/git worktree orphans [--delete]
```

## Important Notes

- Worktrees are created in the `directory` specified in config (default: `.worktrees/`)
- The `.worktrees/` directory should be added to `.gitignore`
- Branch names with slashes (e.g., `feat/auth`) are converted to hyphens for the directory name
- Files matching `copy` patterns are copied from the main worktree
- The `postCreate` command runs in the new worktree directory
