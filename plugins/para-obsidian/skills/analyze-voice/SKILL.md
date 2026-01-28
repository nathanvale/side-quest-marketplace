---
name: analyze-voice
description: Analyze voice memo transcriptions and return resource/meeting proposals. Extracts speakers, notes, decisions, action items for meeting body content. Worker skill for triage orchestrator.
user-invocable: false
allowed-tools: mcp__plugin_para-obsidian_para-obsidian__para_read, mcp__plugin_para-obsidian_para-obsidian__para_fm_get
---

# Analyze Voice Memo

Analyze a single voice memo transcription and return a **proposal** (not a final note).

**Key design:** This skill reads the full transcription content so the coordinator never has to. All extracted content (attendees, notes, decisions, action items) is captured in the proposal for injection into the meeting body.

## Input

You receive:
- `file`: Path to transcription in inbox (e.g., `00 Inbox/🎤 2024-01-22 3-45pm.md`)
- `areas`: Available areas in vault
- `projects`: Available projects in vault
- `stakeholders`: Known people with names, roles, and companies (from config)

## Output

Return a JSON proposal with ALL fields (UX fields are required for the review table):

```json
{
  // Identity
  "file": "00 Inbox/🎤 2024-01-22 3-45pm.md",
  "type": "transcription",

  // Core proposal fields
  "proposed_title": "Descriptive Title from Content",
  "proposed_template": "meeting",  // "resource" | "meeting" | "capture"
  "summary": "2-3 sentence summary of what was discussed",
  "suggested_areas": ["[[🌱 Work]]"],
  "suggested_projects": ["[[🎯 Project Name]]"],
  "resource_type": "meeting",  // meeting|conversation|idea|reflection

  // UX fields (REQUIRED - for review table and "Deeper" option)
  "categorization_hints": [
    "Multiple speakers with status updates",
    "Action items assigned with deadlines",
    "Sprint backlog prioritization discussion"
  ],
  "source_format": "audio",  // Always "audio" for voice memos
  "confidence": "high",  // "high"|"medium"|"low" - low triggers "Deeper" option
  "notes": "All speakers from GMS squad - project auto-inferred",  // or null

  // Meeting-specific fields (when proposed_template === "meeting")
  "meeting_type": "planning",  // standup|1on1|planning|retro|workshop|general
  "meeting_date": "2024-01-22T15:45:00",
  "attendees": ["[[John Smith]]", "[[Jane Doe]]", "Speaker 3"],
  "meeting_notes": [
    "Migration timeline: 3-week phased approach",
    "Tech debt blocking several features",
    "New hire onboarding next week"
  ],
  "decisions": [
    "Proceed with phased migration approach",
    "Prioritize auth module refactor"
  ],
  "action_items": [
    { "assignee": "[[John Smith]]", "task": "Review migration PR", "due": "2024-01-25" },
    { "assignee": "[[Jane Doe]]", "task": "Schedule auth refactor meeting", "due": null },
    { "task": "Prepare onboarding materials for new hire", "due": "2024-01-29" }
  ],
  "follow_up": [
    "Demo Phase 1 at next standup",
    "Check in on auth progress mid-week"
  ]
}
```

### UX Fields (REQUIRED - for review table)

| Field | Description |
|-------|-------------|
| `categorization_hints` | Array of 3 key points explaining why this categorization was chosen |
| `source_format` | Always `"audio"` for voice memos |
| `confidence` | `"high"` \| `"medium"` \| `"low"` - low triggers "Deeper" option in review |
| `notes` | Special considerations (e.g., "Could also be a brainstorm session") or null |

### Body Content Fields (for meetings)

| Field | Description |
|-------|-------------|
| `attendees` | List of speaker names as wikilinks (if matched) or plain text |
| `meeting_notes` | Key discussion points, observations, notable comments |
| `decisions` | Important decisions reached in the meeting |
| `action_items` | Structured tasks with assignee, description, and optional due date |
| `follow_up` | Next steps, items to prepare, future meeting items |

## Workflow

### Step 1: Read Transcription

```
para_read({ file: "[input file]", response_format: "json" })
para_fm_get({ file: "[input file]", response_format: "json" })
```

Extract:
- Full transcription text
- `recorded` date (for `meeting_date`)
- `summary` (if present - can hint at meeting type)
- Pre-filled `areas` or `projects` (if any)
- Any existing metadata

### Step 2: Match Speakers to Stakeholders

**CRITICAL:** Match speaker names/aliases against the `stakeholders` list.

For each speaker mentioned in the transcription:
1. Check against stakeholder `name` (exact or partial match)
2. Check against stakeholder `alias` (e.g., "MJ" → "Mustafa Jalil")
3. Check against email prefix (e.g., "JXu3" → "June Xu")
4. If matched, output as wikilink: `"[[June Xu]]"`
5. If no match, output as plain text: `"Speaker 3"` or `"Unknown (marketing team)"`

**Project inference:** If ALL identified speakers share the same squad/project in stakeholders, infer that project:
```
Speakers: June Xu, Mustafa Jalil, Joshua Green
All in squad: "GMS (POS Yellow)"
→ suggested_projects: ["[[🎯 GMS - Gift Card Management System]]"]
```

### Step 3: Analyze Content

Voice memos are inherently ambiguous. Analyze for:

1. **Summary hint**: If `summary` exists in frontmatter, use it as a quick signal for meeting type (e.g., "team planning session" → planning, "1:1 with manager" → 1on1)
2. **Speaker roles**: Matched stakeholders' roles help classify (e.g., conversation with "manager" → likely 1on1)
3. **Speaker count**: One person (reflection) vs multiple (meeting)?
4. **Tone**: Professional, personal, brainstorming?
5. **Structure**: Agenda items, action items, freeform?
6. **Time markers**: "Next week", "by Friday" suggest action items
7. **Names mentioned**: People, projects, tools?

### Step 4: Categorize

| Pattern | Resource Type | Meeting Type |
|---------|---------------|--------------|
| Multiple speakers, status updates | meeting | standup |
| Two people, career/personal topics | meeting | 1on1 |
| Sprint planning, backlog discussion | meeting | planning |
| What went well/wrong, improvements | meeting | retro |
| Technical deep-dive, learning | meeting | workshop |
| Multiple speakers, general discussion | meeting | general |
| Single speaker, thinking aloud | idea | null |
| Single speaker, emotions/journaling | reflection | null |
| Discussion with back-and-forth | conversation | null |

### Step 5: Extract Body Content (for meetings)

**Attendees:** All speakers identified in Step 2 (wikilinks for matched, plain text otherwise).

**Meeting Notes:** Key discussion points, observations, notable comments. Look for:
- Status updates
- Problems discussed
- Ideas proposed
- Technical explanations

**Decisions:** Important decisions reached. Look for:
- "We decided..."
- "Let's go with..."
- "The plan is..."
- "Agreed that..."

**Action Items:** Extract structured tasks with:
- `assignee`: Wikilink if matched stakeholder, otherwise name or omit
- `task`: What needs to be done
- `due`: Date if mentioned (YYYY-MM-DD format), otherwise null

Look for:
- "I need to..."
- "We should..."
- "[Name] will..."
- "Action item:"
- "TODO:"
- "By [date]..."
- "Follow up on..."

**Follow-up:** Items for future discussion or preparation.

### Step 6: Return Proposal

Return the JSON proposal structure with all extracted body content. Do NOT create the note.

## Voice Memo Challenges

Voice memos are the **hardest to categorize** because:

1. **No clear boundaries** - Conversations meander
2. **Context missing** - You don't know the full situation
3. **Multiple topics** - One recording may cover several things
4. **Transcription errors** - Names, technical terms may be garbled

**When in doubt, set `confidence: "low"`** so the user can choose "Deeper" for multiple options.

## Confidence Levels

| Level | When to Use |
|-------|-------------|
| `high` | Clear meeting format, obvious participants, structured content |
| `medium` | Likely interpretation but could be wrong |
| `low` | Ambiguous content, multiple valid interpretations |

**Default to `medium` or `low` for voice memos.** They're inherently ambiguous.

## Example Output

### Meeting Proposal (with body content)

```json
{
  "file": "00 Inbox/🎤 2024-01-22 3-45pm.md",
  "type": "transcription",
  "proposed_title": "Sprint 42 Planning Session",
  "proposed_template": "meeting",
  "summary": "Team planning session discussing priorities for Sprint 42. Focus on completing the migration project and addressing tech debt in the auth module.",
  "categorization_hints": [
    "Migration project is highest priority",
    "Auth module tech debt blocking other work",
    "New hire starting next week needs onboarding"
  ],
  "suggested_areas": ["[[🌱 Work]]"],
  "suggested_projects": ["[[🎯 GMS - Gift Card Management System]]"],
  "resource_type": "meeting",
  "source_format": "audio",
  "meeting_type": "planning",
  "meeting_date": "2024-01-22T15:45:00",
  "confidence": "medium",
  "notes": "Speaker 'JS' matched to June Xu via alias",

  "attendees": ["[[June Xu]]", "[[Mustafa Jalil]]", "[[Joshua Green]]"],
  "meeting_notes": [
    "Migration project is highest priority for this sprint",
    "Auth module tech debt blocking several downstream features",
    "New hire (Sarah) starting next Monday - needs onboarding prep",
    "CI pipeline improvements discussed but deferred to next sprint"
  ],
  "decisions": [
    "Proceed with phased migration approach (3 weeks)",
    "Prioritize auth module refactor over new features",
    "Sarah's onboarding to focus on migration codebase first"
  ],
  "action_items": [
    { "assignee": "[[June Xu]]", "task": "Review migration PR", "due": "2024-01-24" },
    { "assignee": "[[Mustafa Jalil]]", "task": "Schedule auth refactor deep-dive", "due": null },
    { "assignee": "[[Joshua Green]]", "task": "Prepare onboarding materials", "due": "2024-01-26" }
  ],
  "follow_up": [
    "Demo Phase 1 migration at next standup",
    "Check auth refactor progress mid-week"
  ]
}
```

### Resource Proposal (voice memo → idea)

```json
{
  "file": "00 Inbox/🎤 2024-01-20 8-30am.md",
  "type": "transcription",
  "proposed_title": "API Gateway Caching Idea",
  "proposed_template": "resource",
  "summary": "Quick brainstorm about implementing response caching at the API gateway level to reduce database load.",
  "categorization_hints": [
    "Redis-based caching at gateway",
    "TTL based on endpoint patterns",
    "Could reduce DB load by 40%"
  ],
  "suggested_areas": ["[[🌱 Work]]"],
  "suggested_projects": ["[[🎯 Performance Optimization]]"],
  "resource_type": "idea",
  "source_format": "audio",
  "meeting_type": null,
  "meeting_date": null,
  "confidence": "high",
  "notes": "Single speaker, personal brainstorm"
}
```

## Deep Analysis Mode

When the coordinator requests "deeper" analysis, return **3 different interpretations**:

```json
{
  "options": [
    {
      "label": "A",
      "interpretation": "Sprint Planning Meeting",
      "proposed_title": "Sprint 42 Planning",
      "proposed_template": "meeting",
      "resource_type": "meeting",
      "meeting_type": "planning",
      "rationale": "Multiple speakers, task assignments, timeline discussion",
      "attendees": ["[[June Xu]]", "[[Mustafa Jalil]]"],
      "meeting_notes": ["..."],
      "decisions": ["..."],
      "action_items": [{ "assignee": "[[June Xu]]", "task": "...", "due": null }]
    },
    {
      "label": "B",
      "interpretation": "Team Brainstorm",
      "proposed_title": "Migration Approach Brainstorm",
      "proposed_template": "resource",
      "resource_type": "idea",
      "meeting_type": null,
      "rationale": "Exploratory tone, no firm decisions, 'what if' language"
    },
    {
      "label": "C",
      "interpretation": "1:1 with Manager",
      "proposed_title": "1:1 - Career Discussion",
      "proposed_template": "meeting",
      "resource_type": "meeting",
      "meeting_type": "1on1",
      "rationale": "Two speakers, personal development mentioned, confidential tone",
      "attendees": ["[[Nathan Vale]]", "Manager"],
      "meeting_notes": ["Career growth discussion", "..."],
      "decisions": ["..."],
      "action_items": []
    }
  ]
}
```

This gives the user meaningful choices when categorization is ambiguous. Each option includes full body content extraction where applicable.
