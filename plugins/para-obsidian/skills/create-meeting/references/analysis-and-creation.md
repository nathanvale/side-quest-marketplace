# Analysis & Creation Pipeline

Shared logic for Paths A, B, and C: analyze the transcription, then create → link → archive → report.

---

## Speaker Matching

Match speaker names/aliases from the transcription against the stakeholders list (from `para_stakeholder_list`).

### Matching Rules (try in order)

1. **Exact name match** — "June Xu" → `[[June Xu]]`
2. **Alias match** — "MJ" → `[[Mustafa Jalil]]` (via alias field)
3. **Email prefix match** — "JXu3" → `[[June Xu]]` (via email field)
4. **Partial name match** — "June" → `[[June Xu]]` (if unambiguous)
5. **No match** — Keep as plain text: `"Speaker 3"` or `"Unknown (marketing team)"`

Output matched speakers as wikilinks, unmatched as plain text.

### Project Inference from Speakers

If ALL identified speakers share the same squad/project in stakeholders:

```
Speakers: June Xu, Mustafa Jalil, Joshua Green
All in squad: "GMS (POS Yellow)"
→ project: "[[🎯 GMS - Gift Card Management System]]"
```

If speakers span multiple squads, do not auto-infer — ask the user in the confirmation step.

---

## Meeting Type Classification

Use signals from the table below to classify. Priority:

1. **Explicit mention** in text — "this is our standup", "retro meeting"
2. **Characteristic vocabulary** — see signal words below
3. **Participant count** — two people likely = `1-on-1`
4. **Default** — `general` if uncertain

If `--type` was passed as an argument, use that override and skip inference.

### Meeting Types

| Type | Description | Inference Signals |
|------|-------------|-------------------|
| `1-on-1` | Two people, personal/career discussion | Names mentioned, "1:1", "check-in", "career", "feedback" |
| `standup` | Quick status updates, blockers | "standup", "blockers", "yesterday", "today", "sync" |
| `planning` | Sprint planning, roadmap, scoping | "sprint", "planning", "backlog", "estimate", "roadmap", "scope" |
| `retro` | Retrospective | "retro", "retrospective", "went well", "improve", "action items" |
| `review` | Code/design review, demo | "review", "demo", "feedback", "PR", "pull request", "design" |
| `interview` | Job interview | "candidate", "interview", "role", "hiring", "position" |
| `stakeholder` | External stakeholders, business updates | "stakeholder", "client", "customer", "partner", "executive" |
| `general` | Default fallback | When none of the above patterns match |

### Inference Priority

1. Check for explicit meeting type mentions ("this is a standup", "retro meeting")
2. Look for characteristic vocabulary (see signals above)
3. Consider participant count (two people likely = 1-on-1)
4. Default to `general` if uncertain

### From Proposals

When receiving a proposal from `analyze-voice`:
- Use `proposal.meeting_type` if present
- If null, the analysis couldn't determine type — default to `general`

---

## Content Extraction

Extract structured data from the transcription:

### Attendees

All speakers identified during matching. Format as array:

```json
["[[June Xu]]", "[[Mustafa Jalil]]", "Speaker 3"]
```

### Summary

1-2 sentence description of the meeting. If the transcription frontmatter already has a `summary` field, use it as a starting point but refine based on full content.

### Meeting Notes

Key discussion points. Look for:
- Status updates ("we've finished...", "currently working on...")
- Problems discussed ("the issue is...", "blocked by...")
- Ideas proposed ("what if we...", "we could...")
- Technical explanations ("the way it works is...")

Format as array of strings, one per point.

### Decisions

Important outcomes agreed upon. Look for:
- "We decided..."
- "Let's go with..."
- "The plan is..."
- "Agreed that..."
- "We'll proceed with..."

Format as array of strings.

### Action Items

Structured tasks with assignee and due date:

```json
[
  { "assignee": "[[June Xu]]", "task": "Review migration PR", "due": "2026-02-05" },
  { "assignee": null, "task": "Prepare onboarding materials", "due": null }
]
```

Look for:
- "[Name] will..." / "[Name] needs to..."
- "I need to..." / "We should..."
- "Action item:" / "TODO:"
- "By [date]..." / "Before Friday..."

Use wikilinks for matched stakeholders. Set `due` to ISO date if mentioned, `null` otherwise.

### Follow-up

Items for future discussion or preparation:
- "Let's revisit this next week"
- "Follow up on..."
- "Check on... mid-week"
- "Demo at next standup"

Format as array of strings.

---

## Area/Project Assignment

Priority order:

1. **From transcription frontmatter** — `areas` or `projects` fields if pre-filled
2. **From speaker inference** — if all speakers share a squad (see above)
3. **From content signals** — project names, area keywords in the text
4. **Ask the user** — via `AskUserQuestion` in the confirmation step

At least one of `area` or `project` is required. If both can be inferred, include both.

---

## Creation Pipeline — Create → Link → Archive → Report

The converged pipeline used by all four paths after analysis is complete.

### Step 1: Discover Template Structure

If not already loaded (Paths A/B/C load this in Phase 2):

```
para_template_fields({ template: "meeting", response_format: "json" })
```

Extract `validArgs` and `creation_meta.sections`. Ignore `creation_meta.dest` — we hardcode `04 Archives/Meetings`.

### Step 2: Format Body Content

Transform extracted data into markdown for template section injection:

**Attendees** — comma-separated for frontmatter arg (strip wikilink brackets):

```
proposal.attendees.map(a => a.replace(/^\[\[|\]\]$/g, '')).join(', ')
```

**Notes** — bulleted list:

```markdown
- Migration timeline: 3-week phased approach
- Tech debt blocking features
```

**Decisions** — bulleted list:

```markdown
- Proceed with phased migration
- Prioritize auth module refactor
```

**Action Items** — checkbox format with assignee and due:

```markdown
- [ ] [[June Xu]] - Review migration PR (due: 2026-02-05)
- [ ] [[Mustafa Jalil]] - Schedule auth refactor meeting
- [ ] Prepare onboarding materials (due: 2026-02-09)
```

**Follow-up** — bulleted list:

```markdown
- Demo Phase 1 at next standup
- Check auth progress mid-week
```

### Step 3: Create Meeting Note

```
para_create({
  template: "meeting",
  title: "<proposed_title>",
  dest: "04 Archives/Meetings",
  skip_guard: true,
  no_autocommit: true,
  args: {
    meeting_date: "<ISO datetime>",
    meeting_type: "<type>",
    transcription: "[[<note name without path or .md>]]",
    summary: "<1-line summary, max 100 chars>",
    attendees: "<comma-separated names>",
    area: "<wikilink or null>",
    project: "<wikilink or null>"
  },
  content: {
    "<Attendees section heading>": "<attendee list as markdown>",
    "<Notes section heading>": "<notes as bulleted list>",
    "<Decisions section heading>": "<decisions as bulleted list>",
    "<Action Items section heading>": "<action items as checkboxes>",
    "<Follow-up section heading>": "<follow-up as bulleted list>"
  },
  response_format: "json"
})
```

**Why `skip_guard` and `no_autocommit`:** The `voice convert` CLI (Phase 1) creates an uncommitted transcription note in `00 Inbox/`. Without `skip_guard`, `para_create` fails on the git guard check, forcing a recovery commit and full retry. With `no_autocommit`, all changes are deferred to the final `para_commit` for an atomic commit. This is the same pattern used by triage for batch operations.

**Key details:**

- Use section headings from `creation_meta.sections` (e.g., `"Attendees"`, `"Notes"`, `"Decisions Made"`, `"Action Items"`, `"Follow-up"`). Match exactly.
- Use field names from `validArgs`. Only include args that are in `validArgs`.
- `transcription` arg: Note name only, no path, no `.md`, wrapped in `[[...]]`.
- Omit keys with `null` values from `args` — don't pass `project: null`.
- `dest` is always `04 Archives/Meetings` regardless of what `creation_meta.dest` says.

### Step 4: Link Transcription to Meeting (skip for Path D)

Extract the created meeting filename from the `para_create` response, then set a bi-directional link on the transcription:

```
para_fm_set({
  file: "<transcription_path>",
  set: { "meeting": "[[<meeting note name>]]" },
  response_format: "json"
})
```

### Step 5: Archive Transcription (skip for Path D)

Move the transcription from inbox to archives:

```
para_rename({
  from: "<transcription_path>",
  to: "04 Archives/Transcriptions/<filename>",
  response_format: "json"
})
```

Keep the original filename (e.g., `🎤 2026-02-02 3-45pm.md`).

### Step 6: Commit (skip for Path D)

```
para_commit({ message: "meeting: <proposed_title>", response_format: "json" })
```

### Step 7: Report

Output the `SKILL_RESULT` as defined in the main SKILL.md Phase 5.

### Path D Exceptions

When the input is a proposal from `analyze-voice` (via triage):

- **Skip Steps 4-6** — triage orchestrator owns archiving, linking, and committing
- **Still run Steps 1-3** — create the meeting note with body content
- **Step 7** — report success with `created` path but no `transcription_archived`
