---
name: heal-template
description: Repair workflow for fixing issues in nathanvale/bun-typescript-starter template. Handles cloning, branching, fixing, validating, and creating PRs to the template repo. Use when a template-level bug is identified that needs to be fixed upstream.
---

# Heal Template

You are a template repair specialist. When a bug is found in the `nathanvale/bun-typescript-starter` template, you manage the full fix lifecycle: diagnose, fix, validate, PR, and sync.

## When to Use This Skill

This skill is invoked when:
- The `bun-starter-expert` skill identifies a template-level bug
- The user explicitly wants to fix something in the template repo
- The user runs `/bun-starter:fix`

## Repair Workflow

### Phase 1: Diagnosis

Before fixing, confirm the issue is template-level (not project-specific):

**Template-level indicators:**
- Issue exists in `.github/workflows/`, `.github/scripts/`, or `.github/actions/`
- Issue is in `biome.json`, `commitlint.config.mjs`, `tsconfig*.json`, or `bunup.config.ts`
- Issue is in `scripts/setup.ts`
- Issue is in `.husky/` hooks
- Issue would affect ALL repos created from the template

**Project-specific indicators:**
- Issue is in `src/` or `tests/` (user's code)
- Issue is in `package.json` fields that the setup script personalizes
- Issue relates to project-specific secrets or configuration

If project-specific, advise the user to fix it in their repo directly. Do not create a template PR.

### Phase 2: Environment Setup

```bash
TEMPLATE_DIR="${HOME}/code/bun-typescript-starter"

# Clone or update
if [ -d "$TEMPLATE_DIR" ]; then
  cd "$TEMPLATE_DIR"
  git checkout main
  git pull origin main
else
  gh repo clone nathanvale/bun-typescript-starter "$TEMPLATE_DIR"
  cd "$TEMPLATE_DIR"
fi

# Create fix branch
BRANCH="fix/<short-description>"
git checkout -b "$BRANCH"
```

### Phase 3: Fix Implementation

Load the relevant reference docs to understand the component being fixed:

| Component | References |
|-----------|-----------|
| Workflows | [ci-cd-pipelines.md](../../references/ci-cd-pipelines.md), [github-actions-helpers.md](../../references/github-actions-helpers.md) |
| Build | [build-pipeline.md](../../references/build-pipeline.md), [architecture.md](../../references/architecture.md) |
| Tests | [testing.md](../../references/testing.md) |
| Lint/hooks | [linting-formatting.md](../../references/linting-formatting.md) |
| Publishing | [publishing.md](../../references/publishing.md) |
| Security | [security.md](../../references/security.md) |
| Setup | [setup-script.md](../../references/setup-script.md) |

Apply the fix with minimal changes. Follow the template's conventions:
- **Workflows**: Pin action SHAs, use `step-security/harden-runner`, minimal permissions
- **Scripts**: Use `set -euo pipefail`, clean up temp files via trap
- **TypeScript**: Follow biome config (tabs, single quotes, no semicolons)

### Phase 4: Validation

```bash
# Install dependencies
bun install

# Full validation suite
bun run validate    # lint + typecheck + build + test

# If workflow files changed
bun run lint:workflows    # actionlint
bun run lint:scripts      # shellcheck (if shell scripts changed)

# If package.json exports changed
bun run hygiene           # publint + are-the-types-wrong
```

### Phase 5: PR Creation

```bash
git add .
git commit -m "<type>: <description>"
git push -u origin "$BRANCH"

gh pr create \
  --repo nathanvale/bun-typescript-starter \
  --title "<type>: <description>" \
  --body "## Summary
<What was broken and how this fixes it>

## Changes
<File-by-file changelog>

## Testing
<How the fix was validated>

## Downstream Impact
<Which downstream repos are affected and how to sync>"
```

### Phase 6: Downstream Sync Guidance

After the PR is merged, help the user sync the fix to their downstream repos.

**Check their sync setup:**
1. Do they have `actions-template-sync` workflow? -> Automatic, just wait for next run
2. Do they have a `template` git remote? -> `git fetch template && git cherry-pick <sha>`
3. Neither? -> Recommend setting up `actions-template-sync` (see `downstream-sync.md`)

**For urgent fixes** (can't wait for automated sync):
```bash
cd <downstream-repo>
git remote add template git@github.com:nathanvale/bun-typescript-starter.git 2>/dev/null || true
git fetch template
git cherry-pick <merge-commit-sha>
git push
```

## Update Reference Docs

After fixing a template issue, check if the `references/troubleshooting.md` routing table should be updated with the new symptom/cause/fix entry. If so, suggest updating it via a commit to the side-quest-marketplace repo.
