# Claude Code Skill Expert

Expert guidance for creating high-quality Claude Code skills following Anthropic's official best practices.

## What This Plugin Provides

A comprehensive skill that guides Claude through creating, improving, and auditing SKILL.md files using proven patterns from Anthropic's documentation.

## When to Use

The skill activates automatically when you:
- Create a new SKILL.md file
- Improve an existing skill's structure
- Audit a skill for token efficiency
- Troubleshoot skill triggering issues
- Optimize skill context usage

## Key Concepts Covered

### 1. Progressive Disclosure
Structure skills as a table of contents where content loads on-demand:
- Metadata loads at startup
- SKILL.md loads when triggered
- Reference files load only as needed

### 2. Output Templates
Create separate `references/output-templates.md` files with exact copy-paste formats that show:
- Strictness levels ("ALWAYS use this exact format")
- Visual examples
- Data mapping (field → placeholder)
- Concrete examples

### 3. Token Efficiency
- Keep SKILL.md under 500 lines
- Split mutually exclusive content into separate files
- Use code for deterministic operations (doesn't load into context)
- One-level-deep references

### 4. Name & Description Quality
The most critical fields - Claude uses these to decide when to trigger:
- Include what the skill does
- Include when to use it (trigger phrases)
- Use third person
- Include key terms users would mention

## Example: Well-Structured Skill

See the `the-cinema-bandit` plugin's ticket-booking skill:

```
skills/ticket-booking/
├── SKILL.md (127 lines)          # Lean workflow
└── references/
    ├── output-templates.md        # Strict formats
    ├── cli-commands.md            # CLI reference
    └── error-handling.md          # Recovery patterns
```

Key features:
- Progressive disclosure (47% smaller than original)
- Exact output templates with examples
- Clear action → output → wait pattern
- Visual workflow diagram
- Reference files loaded on-demand

## Quality Checklist

Before considering a skill complete:
- [ ] Name is gerund form (e.g., `processing-pdfs`)
- [ ] Description includes what + when to use
- [ ] SKILL.md under 500 lines
- [ ] Templates in separate file with exact formats
- [ ] One-level-deep references
- [ ] Clear numbered workflow steps
- [ ] Validation checkpoints defined
- [ ] Error handling documented
- [ ] Examples provided
- [ ] No nested subdirectories

## Official Resources

The skill references:
- [Skill Authoring Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Claude 4 Prompting Guide](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices)
- [Equipping Agents for the Real World](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)

## Installation

This plugin is part of the SideQuest marketplace. The skill is automatically available once the plugin is installed.

## Author

Nathan Vale <hi@nathanvale.com>
