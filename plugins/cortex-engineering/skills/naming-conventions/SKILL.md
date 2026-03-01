---
name: naming-conventions
description: Naming conventions for Claude Code plugin components -- skills, commands, agents, argument hints, and descriptions. Use when creating, renaming, or auditing any plugin component to ensure correct naming patterns, description quality, and context budget optimization.
user-invocable: false
---

# Naming Conventions

Knowledge base for naming Claude Code plugin components correctly. Names serve humans (typing, recall), descriptions serve Claude (routing, auto-discovery), and each component type has a natural part of speech.

## The Naming Taxonomy

Every component type has a natural part of speech. Consistency within a type creates a predictable mental model.

| Entity | Case | Part of Speech | Length | Examples |
|--------|------|---------------|--------|---------|
| Plugin | kebab-case | Noun/noun-compound | 1-3 words | `cortex-engineering`, `git-workflow` |
| Skill (action) | kebab-case | Verb or verb-phrase | 1-3 words | `research`, `deploy-staging` |
| Skill (knowledge) | kebab-case | Noun or noun-compound | 1-3 words | `api-conventions`, `frontmatter` |
| Command | kebab-case | Verb (imperative) | 1-2 words | `deploy`, `fix-issue` |
| Agent | kebab-case | Role-noun | 1-3 words | `debugger`, `code-reviewer` |
| argument-hint | POSIX brackets | Descriptive noun | <30 chars | `<topic>`, `[format]` |

## Naming Patterns by Use Case

| Pattern | When to use | Examples |
|---------|-------------|---------|
| verb-noun | Action skills/commands (dominant) | `fix-issue`, `explain-code`, `deploy-staging` |
| noun-noun | Reference/knowledge content | `api-conventions`, `legacy-system-context` |
| single verb | High-frequency universal actions | `simplify`, `batch`, `deploy` |
| adjective-noun | Specialized variants | `deep-research`, `safe-reader` |
| platform-task | Domain-scoped tools | `youtube-research`, `spam-check` |

## Invocation Control Changes Naming Strategy

- **User-invoked skills/commands** (`disable-model-invocation: true`): optimize for human recall -- verb-noun, memorable, typable
- **Auto-triggered skills**: description is primary, name can be shorter/compressed
- **Commands**: always user-invoked, so typeability is the top priority

## The Five Rules of Plugin Hierarchy Coherence

**Rule 1: Never repeat the plugin name in component names.**
The namespace already provides scope. `cortex-engineering:frontmatter` not `cortex-engineering:cortex-engineering-frontmatter`.

**Rule 2: Match skill names to their command counterparts.**
If `/research` delegates to a skill, the skill should also be named `research`, not `producing-research-documents`.

**Rule 3: Use the description for AI routing, not the name.**
The name is for humans (typing, remembering). The description is for Claude (routing, auto-discovery). Don't try to make the name do both jobs.

**Rule 4: Maintain part-of-speech consistency within a type.**
Commands should all be verbs. Agents should all be role-nouns. Knowledge skills should all be nouns. Action skills should all be verbs.

**Rule 5: Treat published names as API contracts.**
Plugin names are in `marketplace.json`. Skill names become `/slash-commands`. Agent names appear in permission rules. Renaming any of these is a semver-major change.

## Name Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|-------------|-------------|-----|
| Overly generic: `check`, `process` | Too broad, fails both recall and discovery | Add domain context: `spam-check` |
| Ambiguous siblings: `update` vs `upgrade` | Users can't remember which is which | Use distinct verbs with clear boundaries |
| Plugin name repeated: `cortex:cortex-research` | Namespace stuttering | Drop prefix: `cortex:research` |
| Abbreviation conflicts | Prefix collision in autocomplete | Use full, distinctive words |
| Too long: `code-review-and-security-analysis-agent` | Untypable, exceeds mental model | 1-3 words max |
| Missing domain context: `check` vs `spam-check` | Ambiguous across workflows | Front-load the domain |

## Agent Naming

Use **role-nouns**, not action-verbs. Agents are persistent entities with identity.

- **Good:** `code-reviewer`, `debugger`, `beat-reporter`, `formatter`
- **Bad:** `review-code` (verb-object -- that's a task), `reviewing` (gerund -- ambiguous)

The builder-validator pattern is the dominant architectural naming idiom. The names map directly to enforced tool restrictions. Naming is enforcement.

## SKILL.md `name` vs Directory Name

When the `name` field differs from the directory name, the `name` field wins for `/slash-command` invocation. **Keep them matching** for maximum predictability. The description handles the verbose explanation.

## Namespace Strategy

- **Global skills** (`~/.claude/skills/`): broader names, cross-project relevance
- **Project skills** (`.claude/skills/`): more specialized, project context baked in
- **Plugin skills**: auto-namespaced via `plugin:skill`, so the skill name itself can be shorter

## Technical Constraints

- Lowercase letters, numbers, hyphens only
- Maximum 64 characters
- The `name` field directly becomes the `/slash-command` invocation
- Same-name collisions resolve by priority: enterprise > personal > project

## Reference Files

For detailed guidance on specific topics:
- [description-writing.md](references/description-writing.md) -- The WHAT+WHEN+WHEN NOT pattern, pushy language, activation rates, and length optimization
- [argument-hints.md](references/argument-hints.md) -- POSIX conventions, length limits, and examples
- [budget-strategy.md](references/budget-strategy.md) -- 2% context budget, skill count limits, and description length tradeoffs

## Source Research

Full research document: `docs/research/2026-03-01-naming-conventions-claude-code-plugins.md`
