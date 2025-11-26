---
description: $ARGUMENTS - Quick capture to Obsidian inbox with PARA-compliant frontmatter
---

# Quick Capture to Second Brain

You are capturing a new item to the user's Obsidian inbox.

## Input

The user's capture: **$ARGUMENTS**

## Process

### 1. Determine Resonance

Based on the content, identify why this is worth saving:
- **inspiring** - Uplifting quote, story, or idea
- **useful** - Template, process, or mental model
- **personal** - Experience, reflection, or lesson learned
- **surprising** - Challenges assumptions, new perspective

### 2. Assess Urgency

- **high** - Time-sensitive, needs action within 24h
- **medium** - Important but can wait a few days
- **low** - Reference material, no time pressure

### 3. Generate Title

Create a concise, descriptive title from the content.

**File Naming**: See `_shared/naming-convention.md`
- **Format**: Title Case with Spaces → `00_Inbox/Title Case with Spaces.md`
- Convert generated title to Title Case (e.g., `React Best Practices.md`)

### 4. Create Note

Use the Obsidian MCP tool to create the note:

```
mcp__MCP_DOCKER__obsidian_append_content
filepath: 00_Inbox/[Generated Title in Title Case].md
```

### 5. Frontmatter Template

```yaml
---
title: [Generated Title]
created: [Current datetime YYYY-MM-DD HH:mm]
type: capture
status: inbox
captured_from: thought
resonance: [inspiring|useful|personal|surprising]
urgency: [low|medium|high]
tags: [inbox]
---
```

### 6. Body Content

```markdown
# [Title]

## Capture

[User's input - $ARGUMENTS]

## Why I Saved This

[Brief note on resonance - 1 sentence]

## Processing Notes

<!-- To be filled during inbox processing -->

## Next Actions

- [ ] Process within 48 hours
```

## Output

After creating the note, respond with:

```
Captured to inbox: [[Title]]

Resonance: [type]
Urgency: [level]

Process within 48h with /para:process
```
