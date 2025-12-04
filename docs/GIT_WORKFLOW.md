# Git Workflow

Comprehensive Git workflow guidelines for the SideQuest Marketplace project.

---

## Conventional Commits (REQUIRED)

**Format:** `<type>(<scope>): <subject>`

| Type | Usage | Example |
|------|-------|---------|
| `feat` | New feature | `feat(kit): add AST search with tree-sitter` |
| `fix` | Bug fix | `fix(bun-runner): resolve stream race condition` |
| `docs` | Documentation | `docs(readme): update installation steps` |
| `style` | Code style (no logic change) | `style(biome-runner): format plugin.json` |
| `refactor` | Code restructure | `refactor(root): rename tsconfig.base.json to tsconfig.json` |
| `perf` | Performance improvement | `perf(ast): parallelize file processing` |
| `test` | Tests | `test(validators): add edge case coverage` |
| `build` | Build system | `build(deps): upgrade Biome to 2.3.7` |
| `ci` | CI/CD changes | `ci(github): add validation workflow` |
| `chore` | Maintenance | `chore(marketplace): register para-obsidian plugin` |
| `revert` | Revert previous commit | `revert: "feat(kit): add broken feature"` |

**Scopes:** Plugin name (`git`, `atuin`, `kit`) or `root` for workspace-level changes

**Rules:**
- Header max 100 chars
- Subject cannot be empty
- Body/footer line length unlimited (reduced friction)

---

## Hooks

**Pre-commit** (`.husky/pre-commit`):
- Runs `bun run validate` to check all plugins
- Fails on invalid plugin structure, missing files, schema violations

**Commit-msg** (`.husky/commit-msg`):
- Validates commit message format (commitlint)
- Rejects non-conventional commits

---

## Branches

- `main` — Production-ready
- `feature/*` — New features
- `fix/*` — Bug fixes

---

## Workflow Commands

```bash
# Stage changes
git add .

# Commit (pre-commit hook runs validation)
git commit -m "feat(my-plugin): add new feature"

# OR use AI-assisted commit
/git:commit

# Push to remote
git push origin main

# Create PR with AI summary
/git:create-pr
```

---

## Recent Activity Pattern

The project maintains consistent conventional commit format:
- `fix(bun-runner)`: Test failure parsing improvements
- `feat(kit)`: Phase 1 commands added (grep, search, commit, summarize)
- `chore(marketplace)`: Plugin registrations
- Recent focus: Bun-runner fixes, Kit CLI integration, Biome/TSC runners
