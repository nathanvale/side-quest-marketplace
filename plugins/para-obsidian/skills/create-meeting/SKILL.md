---
name: create-meeting
description: Create meeting notes from analyzed voice/transcription proposals. Use when triage orchestrator routes a proposal with proposed_template=meeting. Populates attendees, notes, decisions, and action items via para_create.
user-invocable: false
allowed-tools: mcp__plugin_para-obsidian_para-obsidian__para_create, mcp__plugin_para-obsidian_para-obsidian__para_fm_set, mcp__plugin_para-obsidian_para-obsidian__para_rename, mcp__plugin_para-obsidian_para-obsidian__para_template_fields, AskUserQuestion
---

# Create Meeting

Create a meeting note from an analyzed voice/transcription proposal.

**Key design:** Uses `para_create` with `content` parameter to populate body sections in a single atomic operation. This ensures meeting notes are created with actual content, not empty placeholders.

## Input

You receive a proposal object from `analyze-voice` with full body content:

```json
{
  "file": "00 Inbox/🎤 2024-01-22 3-45pm.md",
  "type": "transcription",
  "proposed_title": "Sprint 42 Planning Session",
  "proposed_template": "meeting",
  "summary": "2-3 sentence summary",
  "suggested_areas": ["[[🌱 Work]]"],
  "suggested_projects": ["[[🎯 GMS]]"],
  "resource_type": "meeting",
  "meeting_type": "planning",
  "meeting_date": "2024-01-22T15:45:00",

  "attendees": ["[[June Xu]]", "[[Mustafa Jalil]]", "Speaker 3"],
  "meeting_notes": [
    "Migration timeline: 3-week phased approach",
    "Tech debt blocking features"
  ],
  "decisions": ["Proceed with phased migration"],
  "action_items": [
    { "assignee": "[[June Xu]]", "task": "Review migration PR", "due": "2024-01-25" },
    { "task": "Prepare onboarding materials", "due": null }
  ],
  "follow_up": ["Demo Phase 1 at next standup"]
}
```

## Output

Create the meeting note with populated body sections and establish bi-directional links.

## Workflow

### Step 0: Discover Template Metadata

Before creating the note, query the meeting template for its current structure:

```
para_template_fields({ template: "meeting", response_format: "json" })
```

Extract from response:
- `validArgs` → which args to pass (e.g., `meeting_date`, `meeting_type`, `transcription`, `summary`, `area`, `project`)
- `creation_meta.dest` → destination folder
- `creation_meta.sections` → body section headings (e.g., `"Attendees"`, `"Notes"`, `"Decisions Made"`, `"Action Items"`, `"Follow-up"`)

Use these discovered values throughout the workflow instead of hardcoding them.

### Step 1: Validate Area/Project

**REQUIRED:** Meeting notes must have either `area` or `project` in frontmatter.

If proposal has `suggested_areas` or `suggested_projects`:
- Use the first suggestion

If neither present:
- Use `AskUserQuestion` to prompt:
  - "Which area or project does this meeting belong to?"
  - Provide context-based options from the meeting content

### Step 2: Format Body Content

Transform proposal arrays into markdown for template section injection:

```javascript
// Attendees → bulleted wikilinks
const attendeesContent = proposal.attendees
  .map(a => `- ${a}`)
  .join('\n');

// Notes → bulleted list
const notesContent = proposal.meeting_notes
  .map(n => `- ${n}`)
  .join('\n');

// Decisions → bulleted list
const decisionsContent = proposal.decisions
  .map(d => `- ${d}`)
  .join('\n');

// Action Items → checkbox format with assignee and due date
const actionItemsContent = proposal.action_items
  .map(item => {
    const assignee = item.assignee ? `${item.assignee} - ` : '';
    const due = item.due ? ` (due: ${item.due})` : '';
    return `- [ ] ${assignee}${item.task}${due}`;
  })
  .join('\n');

// Follow-up → bulleted list
const followUpContent = proposal.follow_up
  .map(f => `- ${f}`)
  .join('\n');
```

### Step 3: Create Meeting Note

**CRITICAL:** Use `para_create` with `content` parameter to inject body sections.

Use discovered values from Step 0 (`creation_meta.dest` for dest, `creation_meta.sections` for section headings, `validArgs` for field names):

```typescript
para_create({
  template: "meeting",
  title: proposal.proposed_title,
  dest: "<discovered-dest>",
  args: {
    meeting_date: proposal.meeting_date,
    meeting_type: proposal.meeting_type,
    transcription: `[[${transcriptionNoteName}]]`,  // Note name without path
    summary: proposal.summary,
    area: proposal.suggested_areas[0],
    project: proposal.suggested_projects[0] || null
  },
  content: {
    // Use section headings from creation_meta.sections
    "<discovered-attendees-section>": attendeesContent,
    "<discovered-notes-section>": notesContent,
    "<discovered-decisions-section>": decisionsContent,
    "<discovered-action-items-section>": actionItemsContent,
    "<discovered-follow-up-section>": followUpContent
  },
  response_format: "json"
})
```

**Arguments (frontmatter):** Use fields from `validArgs` discovered in Step 0.
- `meeting_date` — ISO format: `YYYY-MM-DDTHH:mm:ss`
- `meeting_type` — See [meeting-types.md](references/meeting-types.md)
- `transcription` — Note name WITHOUT path or `.md`, wrapped in `[[...]]`
- `summary` — Concise 1-line description (max 100 chars)
- `area` OR `project` — **One required** — Wikilink to parent

**Content (body sections):** Use section headings from `creation_meta.sections` discovered in Step 0. Match the heading text exactly as returned by `para_template_fields`.

### Step 4: Link Transcription to Meeting

Extract meeting filename from `para_create` result, then create bi-directional link:

```typescript
para_fm_set({
  file: "<TRANSCRIPTION_PATH>",
  set: { "meeting": "[[<MEETING_NOTE_NAME>]]" },
  response_format: "json"
})
```

### Step 5: Archive Transcription

Move the original transcription to archives:

```typescript
para_rename({
  from: "<TRANSCRIPTION_PATH>",
  to: "04 Archives/Transcriptions/<FILENAME>",
  response_format: "json"
})
```

### Step 6: Return Result

```json
{
  "success": true,
  "created": "Meetings/🗣️ Sprint 42 Planning Session.md",
  "transcription_archived": "04 Archives/Transcriptions/🎤 2024-01-22 3-45pm.md",
  "meeting_type": "planning",
  "sections_populated": ["Attendees", "Notes", "Decisions Made", "Action Items", "Follow-up"]
}
```

## Meeting Types

See [references/meeting-types.md](references/meeting-types.md) for valid values and inference signals.

## Body Content Formatting Examples

### Attendees Section
```markdown
- [[June Xu]]
- [[Mustafa Jalil]]
- Speaker 3
```

### Notes Section
```markdown
- Migration timeline: 3-week phased approach
- Tech debt blocking several features
- New hire onboarding prep needed
```

### Decisions Made Section
```markdown
- Proceed with phased migration approach
- Prioritize auth module refactor
```

### Action Items Section
```markdown
- [ ] [[June Xu]] - Review migration PR (due: 2024-01-25)
- [ ] [[Mustafa Jalil]] - Schedule auth refactor meeting
- [ ] Prepare onboarding materials (due: 2024-01-29)
```

### Follow-up Section
```markdown
- Demo Phase 1 at next standup
- Check auth progress mid-week
```

## Error Handling

If meeting creation fails:
1. Do NOT archive transcription
2. Return error with details
3. Transcription remains in inbox for retry

```json
{
  "success": false,
  "error": "Missing required field: area or project",
  "proposal": { ... }
}
```

## Why This Skill Exists

Extracted from `meeting-from-transcription` to enable:

1. **Unified triage** - Triage orchestrator routes meetings here
2. **Template routing** - When `proposed_template === "meeting"`, use this skill
3. **Single responsibility** - Knows about meeting creation, not analysis
4. **Populated body sections** - Uses `para_create` content parameter instead of empty placeholders
