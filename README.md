# bun-typescript-starter

Modern TypeScript starter template with enterprise-grade tooling.

## Features

- **Bun** - Fast all-in-one JavaScript runtime and toolkit
- **TypeScript 5.9+** - Strict mode, ESM only
- **Biome** - Lightning-fast linting and formatting (replaces ESLint + Prettier)
- **Vitest** - Fast unit testing with native Bun support
- **Changesets** - Automated versioning and changelog generation
- **GitHub Actions** - Comprehensive CI/CD with OIDC npm publishing
- **Conventional Commits** - Enforced via commitlint + Husky

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) installed (`curl -fsSL https://bun.sh/install | bash`)
- [GitHub CLI](https://cli.github.com) installed and authenticated (`gh auth login`)
- [npm account](https://www.npmjs.com) with a granular access token (see [NPM Token Setup](#npm-token-setup))

### Option A: GitHub CLI (Recommended)

Create a new repo from this template and set it up in one command:

```bash
# Create repo from template
gh repo create myusername/my-lib --template nathanvale/bun-typescript-starter --public --clone

# Run setup (interactive)
cd my-lib
bun run setup
```

### Option B: CLI Mode (Non-Interactive)

For automated/scripted setups, pass all arguments via CLI flags:

```bash
# Create repo from template
gh repo create myusername/my-lib --template nathanvale/bun-typescript-starter --public --clone
cd my-lib

# Run setup with all arguments (no prompts)
bun run setup -- \
  --name "@myusername/my-lib" \
  --description "My awesome library" \
  --author "Your Name" \
  --yes
```

### Option C: degit

```bash
npx degit nathanvale/bun-typescript-starter my-lib
cd my-lib
bun run setup
```

## Setup Script

The setup script configures your project and optionally creates the GitHub repository with all settings pre-configured.

### Interactive Mode

```bash
bun run setup
```

Prompts for:
- Package name (e.g., `@myusername/my-lib` or `my-lib`)
- Repository name
- GitHub username/org
- Project description
- Author name

### CLI Mode

```bash
bun run setup -- [options]
```

| Flag | Short | Description |
|------|-------|-------------|
| `--name` | `-n` | Package name (e.g., `@myusername/my-lib`) |
| `--repo` | `-r` | Repository name (defaults to package name) |
| `--user` | `-u` | GitHub username/org (auto-detected from `gh`) |
| `--description` | `-d` | Project description |
| `--author` | `-a` | Author name |
| `--yes` | `-y` | Skip confirmation prompts (auto-yes) |
| `--no-github` | | Skip GitHub repo creation/configuration |
| `--help` | `-h` | Show help |

### What Setup Does

1. **Configures files** - Replaces placeholders in `package.json` and `.changeset/config.json`
2. **Installs dependencies** - Runs `bun install`
3. **Creates initial commit** - Commits all configured files
4. **Creates GitHub repo** (if it doesn't exist) - Uses `gh repo create`
5. **Configures GitHub settings**:
   - Enables workflow permissions for PR creation
   - Sets squash-only merging
   - Enables auto-delete branches
   - Enables auto-merge
   - Configures branch protection rules

## Complete Setup Guide

This guide walks through the full process of creating a new package and publishing it to npm.

### Step 1: Create Repository

```bash
# Create and clone from template
gh repo create myusername/my-lib --template nathanvale/bun-typescript-starter --public --clone
cd my-lib
```

### Step 2: Run Setup

```bash
# Interactive mode
bun run setup

# Or non-interactive mode
bun run setup -- \
  --name "@myusername/my-lib" \
  --description "My awesome library" \
  --author "Your Name" \
  --yes
```

### Step 3: Install Changeset Bot

Install the [Changeset Bot](https://github.com/apps/changeset-bot) GitHub App on your repo. It comments on every PR with changeset status so you know at a glance whether version bumps are queued.

1. Visit https://github.com/apps/changeset-bot
2. Click **Install** and select your repository
3. Grant the requested permissions (pull request read/write, contents read-only)

> The bot works alongside the `autogenerate-changeset.yml` workflow — the bot comments instantly, and the workflow auto-generates a changeset file if one is missing.

### Step 4: Configure NPM Token

Before publishing, you need to add your npm token to GitHub secrets.

#### Create npm Granular Access Token

1. Go to [npmjs.com](https://www.npmjs.com) → Access Tokens → Generate New Token → **Granular Access Token**

2. Configure the token:
   - **Token name:** `github-actions-publish` (or any name)
   - **Expiration:** 90 days (maximum for granular tokens)
   - **Packages and scopes:** Select "All packages" for new packages, or specific packages for existing ones
   - **Permissions:** Read and write
   - **IMPORTANT:** Check **"Bypass two-factor authentication for automation"**

   > Without "Bypass 2FA", CI/CD publishing will fail with "Access token expired or revoked"

3. Copy the token (starts with `npm_`)

#### Add Token to GitHub Secrets

```bash
# If you have NPM_TOKEN in your environment
echo "$NPM_TOKEN" | gh secret set NPM_TOKEN --repo myusername/my-lib

# Or set it interactively
gh secret set NPM_TOKEN --repo myusername/my-lib
# Paste your token when prompted
```

### Step 5: Create Initial Release

Create a changeset describing your initial release:

```bash
# Create a feature branch
git checkout -b feat/initial-release

# Create changeset file
mkdir -p .changeset
cat > .changeset/initial-release.md << 'EOF'
---
"@myusername/my-lib": minor
---

Initial release
EOF

# Commit and push
git add .changeset/initial-release.md
git commit -m "chore: add changeset for initial release"
git push -u origin feat/initial-release

# Create PR
gh pr create --title "chore: add changeset for initial release" --body "Initial release"
```

### Step 6: Merge and Publish

1. **Wait for CI checks** to pass on your PR
2. **Merge the PR** - This triggers the changesets workflow
3. **A "Version Packages" PR** will be automatically created
4. **Merge the Version PR** - This triggers the publish workflow
5. **Package is published to npm!**

```bash
# Check your package
npm view @myusername/my-lib
```

### Step 7: Configure OIDC Trusted Publishing (Optional)

After the first publish, you can enable token-free publishing via OIDC:

1. Go to [npmjs.com](https://www.npmjs.com) → Your Package → Settings → Publishing Access
2. Click "Add Trusted Publisher"
3. Configure:
   - **Owner:** Your GitHub username/org
   - **Repository:** Your repo name
   - **Workflow file:** `publish.yml`
4. Save changes
5. Optionally remove the `NPM_TOKEN` secret from GitHub

Now future releases will publish automatically without any tokens!

## NPM Token Setup

### Why Granular Tokens?

As of December 2024, npm has revoked all classic tokens. You must use **granular access tokens** for CI/CD publishing.

### Token Requirements

| Setting | Value | Why |
|---------|-------|-----|
| Type | Granular Access Token | Classic tokens no longer work |
| Packages | All packages (for new) or specific | Allows publishing |
| Permissions | Read and write | Required to publish |
| **Bypass 2FA** | **Checked** | **Required for CI/CD** |

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Access token expired or revoked" | Token doesn't have "Bypass 2FA" | Create new token with 2FA bypass |
| "E404 Not Found" | Token doesn't have publish permissions | Check token has read/write access |
| "E403 Forbidden" | Package scope mismatch | Ensure token covers your package scope |

## What's Included

### CI/CD Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pr-quality.yml` | PR | Lint, Typecheck, Test with coverage |
| `publish.yml` | Push to main | Auto-publish via Changesets |
| `autogenerate-changeset.yml` | PR | Auto-generate changeset if missing |
| `commitlint.yml` | PR | Enforce conventional commits |
| `pr-title.yml` | PR | Validate PR title format |
| `security.yml` | Push/Schedule | CodeQL + Trivy scanning |
| `dependency-review.yml` | PR | Supply chain security |
| `dependabot-auto-merge.yml` | Dependabot PR | Auto-merge patch updates |

### GitHub Apps

| App | Purpose |
|-----|---------|
| [Changeset Bot](https://github.com/apps/changeset-bot) | PR comments with changeset status |

### Scripts

```bash
# Development
bun dev              # Watch mode
bun run build        # Build for production
bun run clean        # Remove dist/

# Quality
bun run check        # Biome lint + format (write)
bun run lint         # Lint only
bun run format       # Format only
bun run typecheck    # TypeScript type check
bun run validate     # Full quality check (lint + types + build + test)

# Testing
bun test             # Run tests
bun test --watch     # Watch mode
bun run coverage     # With coverage report

# Publishing
bun run version:gen  # Create changeset interactively
bun run release      # Publish to npm (CI handles this)
```

## Project Structure

```
├── .github/
│   ├── workflows/        # CI/CD workflows
│   ├── actions/          # Reusable composite actions
│   └── scripts/          # CI helper scripts
├── .husky/               # Git hooks
├── .changeset/           # Changeset config
├── src/
│   └── index.ts          # Main entry point
├── tests/
│   └── index.test.ts     # Example test
├── biome.json            # Biome config
├── tsconfig.json         # TypeScript config
├── bunup.config.ts       # Build config
└── package.json
```

## Configuration

### Biome

Configured in `biome.json`:
- Tab indentation
- 80 character line width
- Single quotes
- Organize imports on save

### TypeScript

- Strict mode enabled
- ESM output
- Source maps and declarations

### Changesets

- GitHub changelog format
- Public npm access
- Provenance enabled

## Branch Protection

The setup script automatically configures branch protection for `main`:

- Require pull request before merging
- Require status checks to pass ("All checks passed")
- Require linear history
- No force pushes
- No deletions

If you need to manually configure it:

1. Go to Settings → Branches → Add rule
2. Branch name pattern: `main`
3. Enable the settings above

## Troubleshooting

### Setup script hangs

If running in a non-TTY environment (like some CI systems), use CLI flags:

```bash
bun run setup -- --name "my-lib" --description "desc" --author "name" --yes
```

### CI can't create PRs

The setup script enables this automatically. If you need to do it manually:

```bash
gh api repos/OWNER/REPO/actions/permissions/workflow \
  --method PUT \
  -f default_workflow_permissions=write \
  -F can_approve_pull_request_reviews=true
```

### Version PR checks don't run

Bot-created PRs don't trigger workflows. Push an empty commit:

```bash
git fetch origin
git checkout changeset-release/main
git commit --allow-empty -m "chore: trigger CI"
git push
```

### npm publish fails with 404

1. Ensure your npm token has "Bypass 2FA" checked
2. Ensure token has "Read and write" permissions
3. Ensure token covers "All packages" (for new packages)

## License

MIT

---

Built with [bun-typescript-starter](https://github.com/nathanvale/bun-typescript-starter)
