---
description: Create a PARA area for ongoing life responsibilities with collaborative validation
argument-hint: "[area description]"
---

# Create Area

Create PARA-compliant area notes for ongoing life responsibilities through collaborative dialogue.

## Usage

```
/para-obsidian:create-area                     # Interactive area creation
/para-obsidian:create-area "Career"            # Create with initial context
/para-obsidian:create-area "Manage my health"  # Create from description
```

## What This Does

1. **Loads existing areas** - Prevents duplicates, shows current structure
2. **Validates it's an area** - Ensures it's ongoing (no end date), not a project
3. **Defines standards** - Optionally capture what standards to maintain
4. **Creates area** - With validated frontmatter and suggested content

## Instructions

When invoked, load the `create-area` skill:

```
@plugins/para-obsidian/skills/create-area/SKILL.md
```

The skill guides you through:

1. **Phase 0**: Load `para_list_areas()` to prevent duplicates
2. **Phase 1**: Gather intent, validate it's truly an area (not a project)
3. **Phase 2**: Define standards and routines (optional)
4. **Phase 3**: Confirm proposal and create

## Areas vs Projects

| Aspect | Area | Project |
|--------|------|---------|
| **End state** | Never "done" | Can be completed |
| **Timeline** | Ongoing forever | Has deadline |
| **Verb** | Maintain, manage | Complete, finish |
| **Example** | "Health" | "Lose 10kg" |

**Key test:** If it has an end state, it's a project, not an area.

## Example Session

```
User: /para-obsidian:create-area

AI: Your current areas:
    - 🏡 Home
    - 🐶 Pet - Muffin
    - 🤖 AI Practice
    ...

    What life responsibility do you want to track?

User: Career development

AI: "Career" is a classic area - ongoing professional responsibility.

    What standards do you want to maintain?
    (Type yours, or "skip")

User: skip

AI: ## Area Proposal

    **Title:** 🌱 Career
    **Status:** active

    **Ready to create?**

User: yes

AI: Created: 🌱 Career.md → 02 Areas
```

## MCP Tool Independence

The `para_create` CLI command remains fully functional for scripted use:

```bash
para create --template area --title "Career"
```

This skill adds collaborative validation for interactive use.
