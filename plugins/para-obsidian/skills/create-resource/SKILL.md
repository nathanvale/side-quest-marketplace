---
name: create-resource
description: Create resource notes from analyzed proposals. Use when triage orchestrator routes a proposal with proposed_template=resource. Handles frontmatter setup and original file cleanup via para_create.
user-invocable: false
allowed-tools: mcp__plugin_para-obsidian_para-obsidian__para_create, mcp__plugin_para-obsidian_para-obsidian__para_delete, mcp__plugin_para-obsidian_para-obsidian__para_rename
---

# Create Resource

Create a resource note from an analyzed proposal.

## Input

You receive a proposal object from an analyzer skill:

```json
{
  "file": "00 Inbox/✂️ Article Title.md",
  "type": "clipping|transcription|attachment",
  "proposed_title": "Meaningful Title",
  "proposed_template": "resource",
  "summary": "2-3 sentence summary",
  "categorization_hints": ["hint1", "hint2", "hint3"],
  "suggested_areas": ["[[🌱 Area Name]]"],
  "suggested_projects": ["[[🎯 Project Name]]"],
  "resource_type": "article|tutorial|reference|thread|video|idea",
  "source_format": "article|video|thread|document|audio",
  "author": "Author Name",
  "source_url": "https://..."
}
```

## Output

Create the resource note and handle the original file.

## Workflow

### Step 1: Create Resource Note

**CRITICAL:** Use frontmatter-only approach. ALL data in `args`, NEVER in `content`.

```
para_create({
  template: "resource",
  title: proposal.proposed_title,
  dest: "03 Resources",
  args: {
    summary: proposal.summary,
    source: proposal.source_url,
    resource_type: proposal.resource_type,
    source_format: proposal.source_format,  // Enables 📚🎬 emoji prefix (video, thread, etc.)
    areas: proposal.suggested_areas[0],
    projects: proposal.suggested_projects[0] || null,
    author: proposal.author || null,
    distilled: "false"
  },
  response_format: "json"
})
```

### Step 2: Handle Original File

Based on the original file type:

| Type | Action |
|------|--------|
| `clipping` | Delete: `para_delete({ file, confirm: true })` |
| `transcription` | Archive: `para_rename({ from, to: "04 Archives/Transcriptions/..." })` |
| `attachment` | Keep in place (referenced via source link) |

### Step 3: Return Result

Return success with created file path:

```json
{
  "success": true,
  "created": "03 Resources/Meaningful Title.md",
  "original_action": "deleted|archived|kept"
}
```

## Frontmatter Fields

The resource template expects these frontmatter fields:

| Field | Required | Description |
|-------|----------|-------------|
| `summary` | Yes | 2-3 sentence description |
| `source` | Yes | Original URL or file link |
| `resource_type` | Yes | article, tutorial, reference, thread, video, idea |
| `source_format` | No | article, video, thread, document, audio |
| `areas` | Yes | Wikilink to parent area |
| `projects` | No | Wikilink to related project |
| `author` | No | Content author if known |
| `distilled` | Yes | Always "false" for new resources |

## Error Handling

If `para_create` fails:
1. Do NOT proceed to delete/archive original
2. Return error with details
3. Let coordinator decide retry strategy

```json
{
  "success": false,
  "error": "Template validation failed: missing required field 'areas'",
  "proposal": { ... }
}
```

## Layer 1 Content Injection

**This skill does NOT inject Layer 1 content.** It only creates the note with frontmatter.

Layer 1 injection (populating "Layer 1: Captured Notes" via `para_replace_section`) is the **calling subagent's responsibility**. The triage subagent has the enriched content in its context and calls `para_replace_section` after `para_create`. See [subagent-prompts.md](../triage/references/subagent-prompts.md) Step 4 for details.

## Why This Skill Exists

Extracted from triage orchestrator Phase 5 to enable:

1. **Reuse** - Other workflows can create resources without full triage
2. **Testing** - Worker can be tested independently
3. **Single responsibility** - Knows only about resource creation, not analysis
