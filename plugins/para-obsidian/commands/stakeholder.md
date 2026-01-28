---
description: Manage stakeholders - list, add, remove, or lookup
argument-hint: "[list|add|remove|lookup] [name-or-query]"
---

# Stakeholder Management

Manage stakeholders for voice memo speaker matching and meeting classification.

## Usage

```
/para-obsidian:stakeholder              # List current stakeholders
/para-obsidian:stakeholder add          # Add stakeholders (bulk or one-at-a-time)
/para-obsidian:stakeholder remove "MJ"  # Remove by name or alias
/para-obsidian:stakeholder "MJ"         # Lookup by name, alias, or email
```

## Instructions

When invoked, load the `stakeholder-manage` skill:

```
@plugins/para-obsidian/skills/stakeholder-manage/SKILL.md
```
