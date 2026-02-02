# CI/CD Pipelines

## Overview

17 GitHub Actions workflows organized into quality gates, release automation, and security scanning.

## Workflow Inventory

### Quality Gates (PR/Push)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pr-quality.yml` | PR + push to main | **Primary CI**: lint, typecheck, test, coverage, quality delta |
| `pr-title.yml` | PR (opened/edited) | Validate PR title follows conventional commit format |
| `commitlint.yml` | PR + push to main | Validate commit messages |
| `package-hygiene.yml` | PR + push to main | publint, are-the-types-wrong, dry-pack artifact |
| `node-compat.yml` | PR (src/config changes) | Verify build output works on Node.js |
| `workflow-lint.yml` | PR (workflow changes) | actionlint + schema validation on workflow YAML |

### Release Automation

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `publish.yml` | Push to main + manual | **Primary release**: version PR or publish (Changesets) |
| `release.yml` | Manual only | Full release with SBOM generation |
| `pre-mode.yml` | Manual only | Toggle Changesets pre-release mode (beta/rc/next) |
| `alpha-snapshot.yml` | Daily cron + manual | Publish alpha snapshots when in pre-mode |
| `tag-assets.yml` | Tag push (`v*.*.*`) | Create GitHub release with SBOM |
| `version-packages-auto-merge.yml` | PR (version packages) | Auto-merge Changesets version PRs |
| `autogenerate-changeset.yml` | PR | Auto-generate changeset file if missing |

### Security & Maintenance

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `codeql.yml` | PR + push + weekly | CodeQL static analysis (JS/TS) |
| `security.yml` | Weekly + manual | OSV-Scanner vulnerability scan |
| `dependency-review.yml` | PR | Advisory dependency vulnerability check |
| `dependabot-auto-merge.yml` | PR | Auto-merge minor/patch dev dependency updates |

## Key Workflow Details

### `pr-quality.yml` (Primary CI)

Jobs chain: `lint` + `typecheck` -> `test` -> `quality` -> `gate`

- **lint**: `biome check .`
- **typecheck**: `tsc -p tsconfig.eslint.json --noEmit`
- **test**: `bun test --coverage` with JUnit output, coverage comment on PR
- **quality**: Repository quality delta check since main
- **lint-scripts**: ShellCheck on `.github/scripts/*.sh`
- **gate**: Aggregates all results, writes summary table

**Bun 1.3.x linker workaround**: Cleans leaked package folders before test:
```yaml
- name: Clean Bun linker artifacts
  run: |
    for pkg in $(jq -r '.devDependencies | keys[]' package.json); do
      base=$(echo "$pkg" | sed 's|@.*/||')
      [ -d "$base" ] && rm -rf "$base"
    done
```

### `publish.yml` (Release Automation)

Four intents via `workflow_dispatch`:
- **auto** (default on push): Opens version PR or publishes stable release
- **version**: Creates pre-release version bump PR with auto-merge
- **publish**: Publishes pre-release to npm
- **snapshot**: Canary snapshot publish

Uses OIDC trusted publishing (npm 11.6+ on Node 24). Falls back to `NPM_TOKEN` secret.

**Registry conflict fix**: Removes `bunfig.toml` registry entry that conflicts with npm's auth:
```yaml
- name: Fix bunfig registry conflict
  run: sed -i '/registry/d' bunfig.toml 2>/dev/null || true
```

**Note**: Uses Linux `sed -i` syntax (no empty string arg) since this runs on `ubuntu-latest`. macOS BSD sed requires `sed -i ''` instead.

### `release.yml` (Full Release)

Manual-only, elevated permissions via GitHub App:
1. Quality check (lint + types)
2. Build
3. SBOM generation (CycloneDX via `anchore/sbom-action`)
4. Changesets publish with provenance
5. GitHub release creation

Uses 1Password (`OP_SERVICE_ACCOUNT_TOKEN`) to load GitHub App credentials for the `chatline-changesets-bot`.

## Security Hardening

All 17 workflows follow these patterns:
- **Harden Runner**: `step-security/harden-runner` with `egress-policy: audit`
- **Pinned actions**: All action refs use full SHA hashes (not tags)
- **Minimal permissions**: Each workflow declares only needed permissions
- **Concurrency groups**: Prevent parallel runs with `cancel-in-progress: true` (except publish)

## Secrets Required

| Secret | Used By | Purpose |
|--------|---------|---------|
| `GITHUB_TOKEN` | Most workflows | Default GitHub token |
| `NPM_TOKEN` | publish, release, alpha-snapshot | npm auth (fallback for OIDC) |
| `OP_SERVICE_ACCOUNT_TOKEN` | release, version-packages-auto-merge | 1Password GitHub App credentials |

## Composite Actions

| Action | Purpose |
|--------|---------|
| `standard-ci-env` | Sets `TZ=UTC` and `TF_BUILD=true` |
| `setup-bun` | Installs Bun with dependency caching |
| `setup-pnpm` | Installs pnpm + Node (for npm publish) |
| `coverage-comment` | Posts sticky coverage comment on PRs |
