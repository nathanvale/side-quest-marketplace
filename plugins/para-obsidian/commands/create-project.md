---
description: Create a PARA project with validated area connections and collaborative workflow
argument-hint: "[project description]"
---

# Create Project

Create PARA-compliant project notes with validated area connections through collaborative dialogue.

## Usage

```
/para-obsidian:create-project                           # Interactive project creation
/para-obsidian:create-project "Set up Clawdbot"        # Create with initial context
/para-obsidian:create-project "Migrate DB by March"    # Include deadline hint
```

## What This Does

1. **Loads vault context** - Fetches existing areas and projects first
2. **Gathers intent** - Asks for outcome and deadline (validates it's a project, not area)
3. **Validates area** - Presents numbered list of existing areas (prevents broken wikilinks)
4. **Creates project** - With validated frontmatter and suggested content

## Instructions

When invoked, load the `create-project` skill:

```
@plugins/para-obsidian/skills/create-project/SKILL.md
```

The skill guides you through:

1. **Phase 0**: Load `para_list_areas()` and `para_list_projects()` first
2. **Phase 1**: Ask for outcome and deadline (if not in initial message)
3. **Phase 2**: Present numbered area selection (NEVER accept free-text)
4. **Phase 3**: Confirm proposal and create with validated frontmatter

## Why This Skill Exists

The `para_create` MCP tool accepts any area value without validation. This can create notes with broken wikilinks (e.g., `[[NonExistentArea]]`).

This skill provides the **intelligence layer** that:
- Loads valid areas before asking
- Only offers areas that exist in the vault
- Handles "create new area" sub-flow properly
- Ensures projects follow PARA philosophy

## PARA Philosophy

**Projects vs Areas:**
- **Project** = Has outcome + deadline. Can be "completed."
- **Area** = Standard to maintain. Continuous, no end date.
- **Every project falls within an area** - they're interdependent.

If user describes something ongoing without an end state, suggest creating an area instead.

## Example Session

```
User: /para-obsidian:create-project

AI: I'll help you create a new project. First, let me load your vault structure.

    Your areas:
    1. 🎹 Movie Love
    2. 🏠 Property
    3. 🏡 Home
    4. 🐶 Pet - Muffin
    5. 📝 Note Taking
    6. 🔧 Dotfiles
    7. 🤖 AI Practice

    What outcome do you want to achieve?

User: Set up Clawdbot for my messaging apps

AI: When do you need this done by?

User: End of February

AI: Which area does this project fall under?

    I'd suggest 🤖 AI Practice since Clawdbot is AI-related.
    Choose a number (1-7), or type "new" to create a new area.

User: 7

AI: ## Project Proposal

    **Title:** 🎯 Clawdbot Setup & Integration
    **Outcome:** Set up Clawdbot for messaging apps
    **Deadline:** 2025-02-28
    **Area:** [[🤖 AI Practice]]

    **Ready to create?** (yes / tell me what to change)

User: yes

AI: Created: 🎯 Clawdbot Setup & Integration.md → 01 Projects
    Linked to: [[🤖 AI Practice]]
```

## MCP Tool Independence

The `para_create` CLI command remains fully functional for scripted/automated use:

```bash
# Direct CLI call - no validation (for scripts)
para create --template project --title "My Project" \
  --arg "Area=[[Custom Area]]" --arg "Target completion date=2025-03-31"
```

This skill adds collaborative validation for interactive use. The underlying tool stays deterministic for automation.
