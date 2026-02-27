# bun-typescript-starter

A production-ready TypeScript/Bun project template with CI/CD, linting, testing, and publishing infrastructure.

**Stack:** TypeScript, Bun, Biome, Vitest, Changesets

---

## Quick Start

```bash
# After "Use this template" on GitHub
bun run setup    # Interactive configuration
bun install      # Install dependencies (if not done by setup)
bun dev          # Watch mode development
bun test         # Run tests
bun run build    # Build for production
```

---

## Key Commands

```bash
# Development
bun dev                  # Watch mode
bun build                # Build TypeScript to dist/

# Quality
bun run check            # Biome lint + format (write mode)
bun typecheck            # TypeScript type checking
bun run validate         # Full quality check (lint + types + build + test)

# Testing
bun test                 # Run all tests
bun test --coverage      # With coverage report

# Releases
bun version:gen          # Create changeset
```

---

## Code Conventions

| Area | Convention |
|------|------------|
| Files | kebab-case (`my-util.ts`) |
| Functions | camelCase (`doSomething`) |
| Types | PascalCase (`MyType`) |
| Exports | Named only (no defaults) |
| Formatting | Biome (tabs, single quotes, 80-char) |

---

## Git Workflow

**Branch pattern:** `type/description` (e.g., `feat/add-feature`, `fix/bug-fix`)

**Commit format:** Conventional Commits (enforced by commitlint)

```
feat(scope): add new feature
fix(scope): fix bug
chore(deps): update dependencies
```

**Before pushing:** Always run `bun run validate`

---

## Template Development Workflow

When dogfooding this template (testing it in a real project), use this workflow to push fixes back upstream.

### Setup (one-time)

```bash
# Create a new repo from template via GitHub UI
# Clone it locally
git clone git@github.com:youruser/your-new-project.git
cd your-new-project

# Add template as upstream remote
git remote add template git@github.com:nathanvale/bun-typescript-starter.git
```

### Pushing Fixes Upstream

When you find an issue in the template while using it:

```bash
# 1. Fix the issue in your dogfood project
# 2. Commit the fix
git add .
git commit -m "fix: description of the fix"

# 3. Push to your project's origin (optional, for your project)
git push origin main

# 4. Push to template upstream
git push template HEAD:main
```

### Pulling Template Updates

```bash
# Fetch latest from template
git fetch template

# Merge template changes into your project
git merge template/main --allow-unrelated-histories
```

---

## Publishing

This template uses **OIDC Trusted Publishing** for npm releases.

### First Publish (requires NPM_TOKEN)

1. Add `NPM_TOKEN` secret to GitHub repo settings
2. Create a changeset: `bun version:gen`
3. Push to main, merge the "Version Packages" PR

### After First Publish (OIDC)

1. Configure trusted publisher at: https://www.npmjs.com/package/YOUR_PACKAGE/access
2. Remove `NPM_TOKEN` secret (no longer needed)
3. Future publishes authenticate via GitHub OIDC

---

## CI/CD Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pr-quality.yml` | PR | Lint, types, tests |
| `publish.yml` | Push to main | Version & publish |
| `autogenerate-changeset.yml` | PR | Auto-generate changeset if missing |
| `commitlint.yml` | PR | Validate commit messages |
| `security.yml` | Schedule/PR | CodeQL + Trivy scans |

**GitHub App:** [Changeset Bot](https://github.com/apps/changeset-bot) — comments on PRs with changeset status (install per-repo)

---

## Customization

After running `bun run setup`:

1. **Add source files** in `src/`
2. **Add tests** alongside source (`*.test.ts`)
3. **Update exports** in `bunup.config.ts`
4. **Configure path aliases** in `tsconfig.json` if needed

---

## Special Rules

### ALWAYS

1. Run `bun run validate` before pushing
2. Create changesets for user-facing changes
3. Use named exports (no defaults)

### NEVER

1. Push directly to main (pre-push hook blocks)
2. Skip validation before commits
3. Use destructive git commands (`reset --hard`, `push --force`)
