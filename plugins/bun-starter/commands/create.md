---
name: create
description: Create a new repository from bun-typescript-starter template with full CI/CD, publishing, and quality infrastructure
argument-hint: "[repo-name]"
disable-model-invocation: true
---

# Create Bun TypeScript Project

Create a new repository from `nathanvale/bun-typescript-starter` template with full CI/CD, publishing, and quality infrastructure.

## Usage

```
/bun-starter:create [repo-name]
```

## Arguments

- `repo-name` - Name for the new repository (optional, will prompt if not provided)

## Examples

```
/bun-starter:create my-awesome-lib
/bun-starter:create @nathanvale/utils
/bun-starter:create
```

You are a project scaffolding assistant. Follow this workflow precisely to create a new repo from the bun-typescript-starter template.

## Step 1: Gather Information

Use AskUserQuestion to collect these details (skip any provided as arguments):

1. **Repository name** — The GitHub repo name (e.g., `my-lib`). If a scoped package name is given like `@scope/my-lib`, derive repo name as `my-lib`.
2. **Package name** — npm package name. Default: same as repo name. Can be scoped (e.g., `@nathanvale/my-lib`).
3. **Description** — One-line project description.
4. **Author name** — Default: detect from `gh api user --jq '.name'` or `git config user.name`.
5. **Target directory** — Where to clone. Default: `~/code/`.
6. **Visibility** — `public` or `private`. Default: `public`.
7. **Template sync** — Install `actions-template-sync` for automated upstream sync? Default: yes.

## Step 2: Create Repository

Run these commands:

```bash
# Create repo from template (clones into ./<repo-name> in current directory)
cd <target-dir>
gh repo create <repo-name> --template nathanvale/bun-typescript-starter --<visibility> --clone

# Navigate to it
cd <repo-name>
```

If `gh repo create` with `--template` is not available, fall back to:

```bash
cd <target-dir>
gh repo create <repo-name> --<visibility> --clone
cd <repo-name>

# Download template contents
gh api repos/nathanvale/bun-typescript-starter/tarball/main | tar xz --strip-components=1
git add . && git commit -m "chore: initial setup from bun-typescript-starter"
```

## Step 3: Run Setup Script

```bash
bun run setup -- \
  --name "<package-name>" \
  --description "<description>" \
  --author "<author>" \
  --no-github \
  --yes
```

Use `--no-github` because it skips all GitHub operations (repo creation, workflow permissions, merge settings, and branch protection) — we handle repo creation in Step 2 and configuration in Step 5. The setup script handles:
- Replacing `{{PLACEHOLDER}}` values in config files
- Installing dependencies
- Removing the setup script (self-deleting)
- Creating initial commit

## Step 4: Push Initial Code

```bash
ALLOW_PUSH_PROTECTED=1 git push -u origin main
```

The `ALLOW_PUSH_PROTECTED=1` env var overrides the pre-push hook that blocks direct pushes to main (needed for initial setup only).

## Step 5: Configure GitHub Repository

```bash
# Workflow permissions
gh api repos/<owner>/<repo>/actions/permissions/workflow \
  --method PUT \
  -f default_workflow_permissions=write \
  -F can_approve_pull_request_reviews=true

# Repo settings: squash merge only, auto-delete branches, auto-merge
gh api repos/<owner>/<repo> --method PATCH \
  -f allow_squash_merge=true \
  -f allow_merge_commit=false \
  -f allow_rebase_merge=false \
  -f delete_branch_on_merge=true \
  -f allow_auto_merge=true
```

## Step 6: Optional Template Sync

If the user opted for template sync, create `.github/workflows/template-sync.yml`:

```yaml
name: Template Sync
on:
  schedule:
    - cron: '0 3 * * 1'
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: AndreasAugustin/actions-template-sync@v6
        with:
          source_repo_path: nathanvale/bun-typescript-starter
          upstream_branch: main
          pr_title: 'chore: sync with upstream template'
          pr_labels: template-sync
          ignore_path_pattern: |
            src/**
            tests/**
            README.md
            CHANGELOG.md
```

Commit and push this file:

```bash
git add .github/workflows/template-sync.yml
git commit -m "ci: add template sync workflow"
ALLOW_PUSH_PROTECTED=1 git push
```

## Step 7: Post-Setup Guidance

Show the user:

1. **NPM publishing setup** (first time):
   ```bash
   # 1. Create a granular access token at:
   #    https://www.npmjs.com/settings/<username>/tokens/granular-access-tokens/new
   #    - Scope to package/org, Read+Write, check "Bypass 2FA" for CI

   # 2. For scoped packages (@org/name), do the first publish locally:
   npm publish --access public --no-provenance
   #    npm needs the package to exist before CI tokens can publish to it.
   #    --no-provenance required locally (provenance only works in GitHub Actions)

   # 3. Set NPM_TOKEN secret for CI publishes
   gh secret set NPM_TOKEN --repo <owner>/<repo>

   # 4. After first publish succeeds, configure OIDC trusted publishing at:
   #    https://www.npmjs.com/package/<package-name>/access
   #    → Trusted Publisher → GitHub Actions → set repo + workflow
   #    Then remove NPM_TOKEN (no longer needed — OIDC handles auth)
   ```

2. **Start developing**:
   ```bash
   cd <target-dir>/<repo-name>
   bun dev          # Watch mode
   bun test         # Run tests
   bun run build    # Build for production
   bun version:gen  # Create changeset for release
   ```

3. **Branch protection** (if not auto-configured):
   - Go to repo Settings > Branches > Add rule for `main`
   - Enable: Require PR, require status checks ("All checks passed"), require linear history

4. **Reference docs**: Point to `references/` directory in the bun-starter plugin for detailed documentation on CI/CD, publishing, security, and troubleshooting.
