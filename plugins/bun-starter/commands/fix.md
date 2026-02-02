---
name: fix
description: Apply a fix to the bun-typescript-starter template repository and create a PR
argument-hint: "[issue-description]"
disable-model-invocation: true
---

# Fix Template Issue

Apply a fix to the `nathanvale/bun-typescript-starter` template repository and create a PR.

## Usage

```
/bun-starter:fix [issue-description]
```

## Arguments

- `issue-description` - Description of the issue to fix (optional, will prompt if not provided)

## Examples

```
/bun-starter:fix coverage comment not posting on PRs
/bun-starter:fix biome config not ignoring dist folder
/bun-starter:fix
```

You are a template maintenance assistant. Follow this workflow to fix issues in the `nathanvale/bun-typescript-starter` template repo.

## Step 1: Understand the Issue

If no issue description was provided, ask the user to describe:
1. What's broken or needs changing
2. Where they observed it (CI workflow, local build, etc.)
3. Whether it's a bug fix, enhancement, or config change

Load relevant reference files from the `references/` directory based on the issue category:

| Category | Reference Files |
|----------|----------------|
| Build/bundling | `build-pipeline.md`, `architecture.md` |
| Tests/coverage | `testing.md`, `ci-cd-pipelines.md` |
| Lint/format/hooks | `linting-formatting.md` |
| CI workflows | `ci-cd-pipelines.md`, `github-actions-helpers.md` |
| Publishing/releases | `publishing.md` |
| Security | `security.md` |
| Setup script | `setup-script.md` |

Consult `troubleshooting.md` to see if this is a known issue with a documented fix.

## Step 2: Clone or Update Template Repo

```bash
TEMPLATE_DIR="${HOME}/code/bun-typescript-starter"

if [ -d "$TEMPLATE_DIR" ]; then
  cd "$TEMPLATE_DIR"
  git checkout main
  git pull origin main
else
  gh repo clone nathanvale/bun-typescript-starter "$TEMPLATE_DIR"
  cd "$TEMPLATE_DIR"
fi
```

## Step 3: Create Fix Branch

```bash
# Generate branch name from issue description
BRANCH_NAME="fix/$(echo '<short-description>' | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | head -c 50)"
git checkout -b "$BRANCH_NAME"
```

## Step 4: Implement the Fix

Apply the necessary changes. Common fix targets:

| Target | Files |
|--------|-------|
| Workflow logic | `.github/workflows/*.yml` |
| Helper scripts | `.github/scripts/*.sh`, `.github/scripts/*.mjs` |
| Composite actions | `.github/actions/*/action.yml` |
| Build config | `bunup.config.ts`, `tsconfig*.json` |
| Lint/format config | `biome.json`, `commitlint.config.mjs` |
| Git hooks | `.husky/*` |
| Setup wizard | `scripts/setup.ts` |
| Package config | `package.json`, `.changeset/config.json` |

## Step 5: Validate

Run the template's own validation:

```bash
bun install
bun run validate    # lint + typecheck + build + test
```

If workflow files were changed:

```bash
bun run lint:workflows   # actionlint
bun run lint:scripts     # shellcheck
```

## Step 6: Commit and Create PR

```bash
git add .
git commit -m "<type>: <description>"
git push -u origin "$BRANCH_NAME"

gh pr create \
  --repo nathanvale/bun-typescript-starter \
  --title "<type>: <description>" \
  --body "## Summary

<Description of what was broken and how this fixes it>

## Changes

<List of changed files and what each change does>

## Testing

<How the fix was validated>
"
```

## Step 7: Downstream Sync Guidance

After the PR is merged, inform the user about syncing the fix to downstream repos:

1. **If using `actions-template-sync`**: The fix will be picked up automatically on the next sync schedule (or trigger manually via workflow_dispatch).

2. **If using git remote upstream**:
   ```bash
   cd <your-downstream-repo>
   git fetch template
   git cherry-pick <merge-commit-sha>
   ```

3. **Manual approach**:
   ```bash
   # Copy the fixed file(s) from template
   cp ~/code/bun-typescript-starter/<path-to-fixed-file> <your-repo>/<same-path>
   git add . && git commit -m "fix: sync template fix for <description>"
   ```

See `references/downstream-sync.md` for detailed sync strategies.
