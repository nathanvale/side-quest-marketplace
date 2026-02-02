# Setup Script

## Overview

`scripts/setup.ts` is a one-time configuration wizard that personalizes the template. It replaces placeholders, installs deps, creates initial commit, and optionally configures GitHub.

**Self-deleting**: The script removes itself after running and deletes the `setup` script entry from package.json.

## CLI Flags

| Flag | Short | Type | Description |
|------|-------|------|-------------|
| `--name` | `-n` | string | Package name (e.g., `@scope/my-lib` or `my-lib`) |
| `--repo` | `-r` | string | Repository name (defaults to package name without scope) |
| `--user` | `-u` | string | GitHub username/org (defaults to `gh api user` result) |
| `--description` | `-d` | string | Project description |
| `--author` | `-a` | string | Author name |
| `--yes` | `-y` | boolean | Skip confirmation prompts (auto-yes) |
| `--no-github` | | boolean | Skip GitHub repo creation/configuration |
| `--help` | `-h` | boolean | Show help |

## Modes

1. **Interactive** (default): Prompts for all values with sensible defaults
2. **CLI**: All flags provided, no prompts (`bun run setup -n my-lib -d "desc" -a "Name" -y`)
3. **Mixed**: Prompts only for missing values

## Placeholders Replaced

These appear in `package.json` and `.changeset/config.json`:

| Placeholder | Replaced With |
|-------------|---------------|
| `{{PACKAGE_NAME}}` | Package name |
| `{{REPO_NAME}}` | Repository name |
| `{{GITHUB_USER}}` | GitHub username/org |
| `{{DESCRIPTION}}` | Project description |
| `{{AUTHOR}}` | Author name |

## GitHub Configuration (optional, requires `gh` CLI)

When enabled, the setup script:

1. **Workflow permissions**: Sets `default_workflow_permissions=write` and `can_approve_pull_request_reviews=true`
2. **Merge settings**: Squash merge only, auto-delete branches, allow auto-merge
3. **Branch protection** on `main`:
   - Required status check: "All checks passed"
   - Strict up-to-date requirement
   - Dismiss stale reviews
   - Required linear history
   - No force pushes or deletions
   - Enforce for admins

## Execution Flow

```
1. Check if already configured (looks for `{{` in package.json name)
2. Detect GitHub user via `gh api user` or `git config user.name`
3. Collect project details (interactive or CLI)
4. Show summary, confirm
5. Replace placeholders in files
6. Run `bun install`
7. Delete setup script + remove from package.json
8. Create initial commit (HUSKY=0 to skip hooks)
9. Optionally create GitHub repo + push + configure
10. Print next steps
```

## Usage from `/bun-starter:create`

The create command runs this script non-interactively:

```bash
bun run setup -- --name "@scope/my-lib" --description "My library" --author "Name" --yes
```

If `--no-github` is NOT passed, the script will also handle GitHub repo creation.
