# Git Workflow

## Commits (Conventional Format Required)

`<type>(<scope>): <subject>`

**Scopes:** Plugin name (`git`, `kit`, `para-obsidian`) or `root`
**Types:** feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert
**Rules:** Header max 100 chars, subject required

## Commands

```bash
/git:commit      # AI-assisted commit (preferred)
/git:create-pr   # Create PR with summary
/git:checkpoint  # Quick WIP save
```

## Hooks (Automatic)

- **Pre-commit:** Runs `bun run validate` — fix failures before committing
- **Commit-msg:** Validates conventional format

## Branches

- `main` — Production
- `feature/*` — New features
- `fix/*` — Bug fixes
