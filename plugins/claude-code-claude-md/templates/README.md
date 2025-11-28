# CLAUDE.md Templates

Shared reference files for creating and auditing CLAUDE.md files across all levels.

## Purpose

These templates are referenced by multiple slash commands:
- `/init` - Uses templates to generate project CLAUDE.md files
- `/audit` - Uses quality checks and best practices for validation

## Template Files

| File | Purpose | Used By |
|------|---------|---------|
| `best-practices.md` | Anthropic's official CLAUDE.md guidelines | `/init`, `/audit` |
| `user-template.md` | User-level (~/.claude/CLAUDE.md) template structure | `/init` |
| `project-template.md` | Project-level (./CLAUDE.md) template structure | `/init` |
| `module-template.md` | Module-level (feature/CLAUDE.md) template structure | `/init` |
| `quality-checks.md` | Shared audit criteria for all levels | `/audit` |
| `formatting-guide.md` | Token efficiency and formatting best practices | `/init`, `/audit` |

## Design Principles

1. **DRY** - Templates defined once, referenced by multiple commands
2. **Progressive Disclosure** - Claude Code loads templates only when needed (via `@` references)
3. **Maintainability** - Update template once, all commands benefit
4. **Composability** - Commands contain logic, templates contain content

## Usage in Commands

Commands reference templates using the `@` prefix:

```markdown
# In commands/init.md
For project template structure, see:
@../templates/project-template.md

# In commands/audit.md
Apply quality checks from:
@../templates/quality-checks.md
```

## Token Budgets

| Level | Recommended | Max Before Split |
|-------|-------------|------------------|
| User | 50-100 lines | 150 lines |
| Project | 100-200 lines | 300 lines |
| Module | 30-50 lines | 100 lines |

**Rule**: Section >50 lines → Extract to @import

## Maintenance

When updating:
- Keep templates focused and concise
- Use emphasis markers for critical rules
- Include examples where helpful
- Test changes with both `/init` and `/audit` commands
