# Git Expert Skill

A specialized skill for git operations, history exploration, and intelligent commit management.

## Triggers

Activate this skill when the user:
- Asks about git history ("what did we change", "when did we add", "who wrote this")
- Wants to understand past changes ("why was this code written", "what happened to")
- Needs help with commits ("commit this", "save my work", "checkpoint")
- Asks about branches ("what's different", "compare branches")
- Mentions recent work ("what did we do", "show my changes")

## Capabilities

### History Analysis
- Search commit messages and code changes
- Trace file history to understand evolution
- Find when specific code was introduced or removed
- Identify who made changes and why

### Smart Commits
- Create well-formatted gitmoji commits
- Split large changes into atomic commits
- Handle pre-commit hooks gracefully
- Never commit secrets or sensitive data

### Session Awareness
- Track what was done during the current session
- Show uncommitted work
- Create checkpoints before risky operations

## Tools Available

Use the git-intelligence MCP server tools:
- `get_recent_commits` - Recent commit history
- `search_commits` - Search by message or code
- `get_status` - Current repository state
- `get_diff_summary` - Summary of changes

For file history and branch info, use Bash:
- `git log --oneline -10 -- <filepath>` - File-specific history
- `git branch -a` - Branch information

## Commit Format

Always use gitmoji format:
```
<emoji> <type>(<scope>): <subject>
```

Emoji mappings:
| Emoji | Type | Use for |
|-------|------|---------|
| 🎉 | init | New project |
| ✨ | feat | New feature |
| 🐞 | fix | Bug fix |
| 📃 | docs | Documentation |
| 🌈 | style | Formatting |
| 🦄 | refactor | Refactoring |
| 🎈 | perf | Performance |
| 🧪 | test | Tests |
| 🔧 | build | Build system |
| 🐎 | ci | CI/CD |
| 🐳 | chore | Maintenance |
| ↩ | revert | Revert |

## Best Practices

1. **Before editing**: Check recent commits to understand context
2. **Before committing**: Review all changes, never blind commit
3. **Large changes**: Suggest splitting into atomic commits
4. **Unclear intent**: Ask user for commit scope/description
5. **Secrets detected**: Warn and refuse to commit

## Example Interactions

**User**: "What changed in the auth module recently?"
→ Use `search_commits` with query "auth" or Bash `git log --oneline -10 -- src/auth/`

**User**: "Commit my changes"
→ Run `get_status`, review diffs, create appropriate gitmoji commit

**User**: "What did we do this session?"
→ Check recent commits and current diff, summarize activity

**User**: "Save my work before I try this"
→ Create a checkpoint commit with current context
