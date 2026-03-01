---
name: skill-authoring
description: Expert guidance for creating Claude Code skills and slash commands. Use when authoring new skills, improving existing skills, creating commands, or understanding skill structure and best practices.
user-invocable: false
---

# Creating Skills & Commands

This skill teaches how to create effective Claude Code skills following the official specification from [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills).

## Commands and Skills Are Now The Same Thing

Custom slash commands have been merged into skills. A file at `.claude/commands/review.md` and a skill at `.claude/skills/review/SKILL.md` both create `/review` and work the same way. Existing `.claude/commands/` files keep working. Skills add optional features: a directory for supporting files, frontmatter to control invocation, and automatic context loading.

**If a skill and a command share the same name, the skill takes precedence.**

## When To Create What

**Use a command file** (`commands/name.md`) when:
- Simple, single-file workflow
- No supporting files needed
- Task-oriented action (deploy, commit, triage)

**Use a skill directory** (`skills/name/SKILL.md`) when:
- Need supporting reference files, scripts, or templates
- Background knowledge Claude should auto-load
- Complex enough to benefit from progressive disclosure

Both use identical YAML frontmatter and markdown content format.

## Standard Markdown Format

Use YAML frontmatter + markdown body with **standard markdown headings**. Keep it clean and direct.

```markdown
---
name: my-skill-name
description: What it does and when to use it
---

# My Skill Name

## Quick Start
Immediate actionable guidance...

## Instructions
Step-by-step procedures...

## Examples
Concrete usage examples...
```

## Frontmatter Reference

All fields are optional. Only `description` is recommended.

| Field | Required | Description |
|-------|----------|-------------|
| `name` | No | Display name. Lowercase letters, numbers, hyphens (max 64 chars). Defaults to directory name. |
| `description` | Recommended | What it does AND when to use it. Claude uses this for auto-discovery. Max 1024 chars. |
| `argument-hint` | No | Hint shown during autocomplete. Example: `[issue-number]` |
| `disable-model-invocation` | No | Set `true` to prevent Claude auto-loading. Use for manual workflows like `/deploy`, `/commit`. Default: `false`. |
| `user-invocable` | No | Set `false` to hide from `/` menu. Use for background knowledge. Default: `true`. |
| `allowed-tools` | No | Tools Claude can use without permission prompts. Example: `Read, Bash(git *)` |
| `model` | No | Model to use. Options: `haiku`, `sonnet`, `opus`. |
| `context` | No | Set `fork` to run in isolated subagent context. |
| `agent` | No | Subagent type when `context: fork`. Options: `Explore`, `Plan`, `general-purpose`, or custom agent name. |

### Invocation Control

| Frontmatter | User can invoke | Claude can invoke | When loaded |
|-------------|----------------|-------------------|-------------|
| (default) | Yes | Yes | Description always in context, full content loads when invoked |
| `disable-model-invocation: true` | Yes | No | Description not in context, loads only when user invokes |
| `user-invocable: false` | No | Yes | Description always in context, loads when relevant |

**Use `disable-model-invocation: true`** for workflows with side effects: `/deploy`, `/commit`, `/triage-prs`, `/send-slack-message`. You don't want Claude deciding to deploy because your code looks ready.

**Use `user-invocable: false`** for background knowledge that isn't a meaningful user action: coding conventions, domain context, legacy system docs.

## Dynamic Features

### Arguments

Use `$ARGUMENTS` placeholder for user input. If not present in content, arguments are appended automatically.

```yaml
---
name: fix-issue
description: Fix a GitHub issue
disable-model-invocation: true
---

Fix GitHub issue $ARGUMENTS following our coding standards.
```

Access individual args: `$ARGUMENTS[0]` or shorthand `$0`, `$1`, `$2`.

### Dynamic Context Injection

The `!` + backtick-wrapped command syntax runs shell commands before content is sent to Claude. For example, writing `!` followed by a command in backticks (like `gh pr diff`) will execute that command and inject the output.

**Example skill using dynamic context:**

The PR diff and changed files lines below would use the bang-backtick syntax to call `gh pr diff` and `gh pr diff --name-only` respectively, injecting the output before Claude sees the content.

```yaml
---
name: pr-summary
description: Summarize changes in a pull request
context: fork
agent: Explore
---

## Context
- PR diff: (use bang-backtick with: gh pr diff)
- Changed files: (use bang-backtick with: gh pr diff --name-only)

Summarize this pull request...
```

### Running in a Subagent

Add `context: fork` to run in isolation. The skill content becomes the subagent's prompt. It won't have conversation history.

```yaml
---
name: deep-research
description: Research a topic thoroughly
context: fork
agent: Explore
---

Research $ARGUMENTS thoroughly:
1. Find relevant files
2. Analyze the code
3. Summarize findings
```

## Progressive Disclosure

Keep SKILL.md under 500 lines. Split detailed content into reference files:

```
my-skill/
├── SKILL.md           # Entry point (required, overview + navigation)
├── reference.md       # Detailed docs (loaded when needed)
├── examples.md        # Usage examples (loaded when needed)
└── scripts/
    └── helper.py      # Utility script (executed, not loaded)
```

Link from SKILL.md: `For API details, see [reference.md](reference.md).`

Keep references **one level deep** from SKILL.md. Avoid nested chains.

## Naming & Descriptions

### Choosing a Name

Each component type has a natural part of speech. Consistency within a type creates a predictable mental model.

| Component | Case | Part of Speech | Examples |
|-----------|------|---------------|---------|
| Plugin | kebab-case | Noun/noun-compound | `cortex-engineering`, `git-workflow` |
| Skill (action) | kebab-case | Verb or verb-phrase | `research`, `deploy-staging` |
| Skill (knowledge) | kebab-case | Noun or noun-compound | `api-conventions`, `frontmatter` |
| Command | kebab-case | Verb (imperative) | `deploy`, `fix-issue` |
| Agent | kebab-case | Role-noun | `debugger`, `code-reviewer` |

### The Five Rules of Naming

1. **Never repeat the plugin name** in component names -- the namespace handles scope
2. **Match skill names to command counterparts** -- if `/research` delegates to a skill, name the skill `research`
3. **Use the description for AI routing, not the name** -- name is for humans, description is for Claude
4. **Maintain part-of-speech consistency within a type** -- commands are verbs, agents are role-nouns, knowledge skills are nouns
5. **Treat published names as API contracts** -- renaming is a semver-major change

Invocation control changes strategy:
- **User-invoked skills/commands**: optimize for human recall (verb-noun, memorable, typable)
- **Auto-triggered skills**: description matters more than name
- **Keep `name` matching directory name** for predictability

### Name Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|-------------|-------------|-----|
| Overly generic: `check`, `process` | Too broad, fails recall and discovery | Add domain context: `spam-check` |
| Plugin name repeated: `cortex:cortex-research` | Namespace stuttering | Drop prefix: `cortex:research` |
| Too long: `code-review-and-security-analysis-agent` | Untypable | 1-3 words max |
| Ambiguous siblings: `update` vs `upgrade` | Users can't remember which is which | Use distinct verbs |

For advanced naming topics (agent naming, namespace strategy, budget constraints), invoke the naming-conventions skill.

### Writing Effective Descriptions

The description enables skill discovery. Follow the **WHAT + WHEN + WHEN NOT** pattern. Always write in **third person** -- descriptions are injected into the system prompt.

**Good:**
```yaml
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
```

**Bad:**
```yaml
description: Helps with documents
```

Tips:
- Front-load capabilities, include file extensions (`.pdf`, `.xlsx`), user synonyms ("deck" for presentations), and action verbs
- Max 1024 characters, but match length to competition -- unique skills need less, contested domains need more
- Use "pushy" language: "Make sure to use this skill whenever..." outperforms passive phrasing

For the full description-writing guide (activation rates, length strategy, pushy pattern, WHEN NOT clauses), see [description-writing.md](references/description-writing.md).

### Argument Hints

Use POSIX bracket conventions: `<required>`, `[optional]`, `{a|b}` for choices. Keep under 30 characters.

```yaml
argument-hint: <topic>
argument-hint: <issue-number>
argument-hint: <file> [format]
```

For detailed conventions, see [argument-hints.md](references/argument-hints.md).

## What Would You Like To Do?

1. **[Create new skill](workflows/create-new-skill.md)** - Build a skill or command from scratch
2. **[Audit existing skill](workflows/audit-skill.md)** - Check against best practices with scored report
3. **Add component** - Add to an existing skill:
   - a. **[Reference](workflows/add-reference.md)** - Conditional context file
   - b. **[Workflow](workflows/add-workflow.md)** - Step-by-step procedure
   - c. **[Template](workflows/add-template.md)** - Reusable boilerplate
   - d. **[Script](workflows/add-script.md)** - Executable hook or helper
4. **[Get guidance](workflows/get-guidance.md)** - Understand whether/how to build something

**Routing keywords:** `create` -> 1, `audit` -> 2, `add reference` -> 3a, `add workflow` -> 3b, `add template` -> 3c, `add script` -> 3d, `guidance` -> 4

If arguments match a keyword or menu item, read the corresponding workflow and begin.
Otherwise, reply with a number or describe what you need.

$ARGUMENTS

## Anti-Patterns to Avoid

- **XML tags in body** - Use standard markdown headings
- **Vague descriptions** - Be specific with trigger keywords
- **Deep nesting** - Keep references one level from SKILL.md
- **Missing invocation control** - Side-effect workflows need `disable-model-invocation: true`
- **Too many options** - Provide a default with escape hatch
- **Punting to Claude** - Scripts should handle errors explicitly

## Reference Files

For detailed guidance, see:
- [official-spec.md](references/official-spec.md) - Official skill specification
- [best-practices.md](references/best-practices.md) - Skill authoring best practices
- [description-writing.md](references/description-writing.md) - WHAT+WHEN+WHEN NOT pattern, activation rates, length strategy
- [argument-hints.md](references/argument-hints.md) - POSIX conventions and examples
- For advanced topics (budget strategy, activation rate data, agent naming), invoke the naming-conventions skill

## Sources

- [Extend Claude with skills - Official Docs](https://code.claude.com/docs/en/skills)
- [GitHub - anthropics/skills](https://github.com/anthropics/skills)
