---
description: $ARGUMENTS - Quick capture to Obsidian inbox with PARA-compliant frontmatter
allowed-tools: Read, mcp__MCP_DOCKER__obsidian_append_content
---

# Quick Capture to Second Brain

Capture a new item to `00_Inbox/` using the template at [templates/capture.md](../templates/capture.md).

## Input

The user's capture: **$ARGUMENTS**

## Process

1. **Determine resonance** - Why is this worth saving?
   - inspiring, useful, personal, or surprising
2. **Assess urgency** - high (24h), medium (few days), low (no pressure)
3. **Generate title** → Convert to Title Case (see `_shared/naming-convention.md`)
4. **Read template** at `templates/capture.md`
5. **Replace Templater prompts** with: title, $ARGUMENTS content, resonance, urgency
6. **Create file** in `00_Inbox/[Title].md` using `obsidian_append_content`
7. **Confirm**: "Captured to inbox: [[Title]] - Process within 48h with /para:process"
