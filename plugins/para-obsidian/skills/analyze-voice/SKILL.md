---
name: analyze-voice
description: Analyze voice memo transcriptions, create notes with appropriate content, and return lightweight proposals. For resources (ideas, reflections), creates note with Layer 1 transcription. For meetings, extracts structured body content. Worker skill for triage orchestrator.
user-invocable: false
---

# Analyze Voice Memo

Analyze a single voice memo transcription, **create the appropriate note**, and return a lightweight proposal.

**Key design:** This skill reads the full transcription AND creates the note before returning. For meetings, it extracts structured body content. For resources (ideas, reflections), it injects the transcription as Layer 1. The full content stays in subagent context - only the proposal flows back.

## Input

You receive:
- `file`: Path to transcription in inbox (e.g., `00 Inbox/🎤 2024-01-22 3-45pm.md`)
- `areas`: Available areas in vault
- `projects`: Available projects in vault
- `stakeholders`: Known people with names, roles, and companies (from config)

## Output

Return a JSON proposal per @plugins/para-obsidian/skills/triage/references/proposal-schema.md.

**Key:** Use `area` (single wikilink), `project` (single wikilink or null), `resourceType` (camelCase). Include `file`, `type: "transcription"`, `created`, and `layer1_injected` alongside the standard proposal fields.

For voice memos, always set `source_format: "audio"`. For meetings, include meeting-specific fields (`meeting_type`, `meeting_date`, `attendees`, `meeting_notes`, `decisions`, `action_items`, `follow_up`).

## Workflow

### Step 1: Read Transcription

```
para_read({ file: "[input file]", response_format: "json" })
```

Extract frontmatter fields (`recorded`, `summary`, pre-filled `areas`/`projects`, and any existing metadata) from the YAML header in the `para_read` response. Do NOT call `para_fm_get` separately — `para_read` returns the full file including frontmatter.

Also extract the full transcription text from the body.

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

### Step 5.5: Pre-Creation Self-Check

Before calling `para_create`, verify your `args` object includes these critical fields:

**If meeting:**
- [ ] `summary` — one-sentence description
- [ ] `area` — single wikilink
- [ ] `meeting_type` — `standup`, `1on1`, `planning`, `retro`, `workshop`, `general`

**If resource:**
- [ ] `summary` — one-sentence description
- [ ] `areas` — wikilink(s)
- [ ] `source_format` — `audio`
- [ ] `resource_type` — `idea`, `reflection`, `conversation`

If any field is missing but you determined a value in Steps 3-5, add it to `args` now.

### Step 6: Create Note (Single Call)

**This is where content stays isolated.** Use `para_create` with the `content` parameter for both meetings and resources:

**Meeting-specific:** Pass meeting body content (attendees, notes, decisions, action items, follow-up) via `content` parameter. Set `layer1_injected: null` for meetings.

```
para_create({
  template: "meeting",
  title: proposed_title,
  args: { ...meeting fields from validArgs },
  content: {
    "<attendees-section>": attendeesList,
    "<notes-section>": notesList,
    "<decisions-section>": decisionsList,
    "<action-items-section>": actionItemsList,
    "<follow-up-section>": followUpList
  },
  response_format: "json"
})
```

**Resource-specific:** Pass transcription as Layer 1 via `content` parameter. Set `layer1_injected: true`.
- If transcription <2k tokens: Include full transcription
- If transcription >2k tokens: Sample key segments using these strategies:
  - Include the **opening** (first 2-3 paragraphs for context)
  - Include sections with **key insights** (look for declarative statements, "the key thing is...", "what I learned...")
  - Include sections with **action items** or decisions
  - Include the **closing** (last 1-2 paragraphs for conclusion)
  - Preserve **timestamps** in sampled sections (e.g., `[03:45]`)
  - Target 2-3k tokens total
- Always add: `*Transcription captured. Use /distill-resource to extract key insights.*`

```
para_create({
  template: "resource",
  title: proposed_title,
  args: { ...resource fields from validArgs },
  content: {
    "<content-target-heading>": formattedTranscription
  },
  response_format: "json"
})
```

No separate `para_commit` or `para_replace_section` calls needed — the CLI handles injection and commit internally.

**IMPORTANT:** Do NOT archive or delete the original transcription. Cleanup is the coordinator's responsibility (Phase 5, after user review).

### Step 7: Verify & Repair

**During triage:** Skip this step entirely. Set `verification_status: "pending_coordinator"` and `verification_issues: []`. The coordinator handles verification in Phase 2.5 — it stamps and checks all critical fields from PROPOSAL_JSON.

**Standalone callers (non-triage):** Call `para_fm_get` on the created file. Check the critical fields for your template (meeting or resource) using the same table from Step 5.5. If any MISMATCH: `para_fm_set({ file, set: { ...repairs }, response_format: "json" })`. Set `verification_status`: `"verified"`, `"repaired"`, `"needs_review"`, or `"skipped"`.

### Step 8: Return Proposal

Return the lightweight JSON proposal. The note is already created.

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

### Meeting Proposal (note already created)

```json
{
  "file": "00 Inbox/🎤 2024-01-22 3-45pm.md",
  "type": "transcription",
  "proposed_title": "Sprint 42 Planning Session",
  "proposed_template": "meeting",
  "summary": "Team planning session discussing priorities for Sprint 42. Focus on completing the migration project and addressing tech debt in the auth module.",
  "created": "04 Archives/Meetings/Sprint 42 Planning Session.md",
  "layer1_injected": null,
  "verification_status": "verified",
  "verification_issues": [],
  "categorization_hints": [
    "Migration project is highest priority",
    "Auth module tech debt blocking other work",
    "New hire starting next week needs onboarding"
  ],
  "area": "[[🌱 Work]]",
  "project": "[[🎯 GMS - Gift Card Management System]]",
  "resourceType": "meeting",     // For meetings: resourceType is always "meeting"
  "source_format": "audio",      // Input was a voice memo
  "meeting_type": "planning",    // Meeting subtype (standup, 1on1, planning, etc.)
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

### Resource Proposal (voice memo → idea, note already created with Layer 1)

```json
{
  "file": "00 Inbox/🎤 2024-01-20 8-30am.md",
  "type": "transcription",
  "proposed_title": "API Gateway Caching Idea",
  "proposed_template": "resource",
  "summary": "Quick brainstorm about implementing response caching at the API gateway level to reduce database load.",
  "created": "03 Resources/API Gateway Caching Idea.md",
  "layer1_injected": true,
  "categorization_hints": [
    "Redis-based caching at gateway",
    "TTL based on endpoint patterns",
    "Could reduce DB load by 40%"
  ],
  "area": "[[🌱 Work]]",
  "project": "[[🎯 Performance Optimization]]",
  "resourceType": "idea",
  "source_format": "audio",
  "meeting_type": null,
  "meeting_date": null,
  "confidence": "high",
  "notes": "Single speaker, personal brainstorm",
  "verification_status": "verified",
  "verification_issues": []
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
      "resourceType": "meeting",
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
      "resourceType": "idea",
      "meeting_type": null,
      "rationale": "Exploratory tone, no firm decisions, 'what if' language"
    },
    {
      "label": "C",
      "interpretation": "1:1 with Manager",
      "proposed_title": "1:1 - Career Discussion",
      "proposed_template": "meeting",
      "resourceType": "meeting",
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
