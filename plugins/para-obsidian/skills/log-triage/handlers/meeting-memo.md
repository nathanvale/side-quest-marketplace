# Meeting Memo Handler

Process voice memos (🎤) into structured meeting notes.

## Step 0 — Discover Template Metadata

Before creating notes, query the meeting template for its current structure:

```
para_template_fields({ template: "meeting", response_format: "json" })
```

Extract from response:
- `validArgs` → which args to pass (e.g., `meeting_type`, `meeting_date`, `area`, `company`)
- `creation_meta.dest` → destination folder
- `creation_meta.sections` → body section headings (e.g., `"Attendees"`, `"Notes"`, `"Decisions Made"`, `"Action Items"`, `"Follow-up"`)

Use these discovered values instead of hardcoding them.

## Detection

**Pattern:** `- [time] - 🎤 [transcription]`

Long voice memos (>200 words) with meeting signals → meeting note.

## Extraction Goals

From raw transcription, extract:

| Section | What to Extract |
|---------|-----------------|
| **Title** | Meeting topic or key subject |
| **Attendees** | Names and roles mentioned |
| **Notes** | Key information, context, project details |
| **Decisions Made** | Conclusions or agreements reached |
| **Action Items** | Tasks as checkboxes (Dataview compatible!) |

## Transcription Cleanup Rules

Before inserting, apply basic cleanup:
- **Remove filler words:** "um", "uh", "like" (when filler), "you know", "sort of"
- **Fix grammar:** Correct obvious errors, add missing words
- **Add punctuation:** Proper periods, commas, question marks
- **Break into paragraphs:** At natural topic changes or speaker switches
- **Preserve tone:** Keep conversational style and ALL content

**DO NOT summarize or truncate.** The entire transcription must be preserved.

## Note Creation

**Step 1: Create note with extracted content**

Use discovered values from Step 0 (`creation_meta.dest` for dest, `creation_meta.sections` for section headings, `validArgs` for field names):

```
para_create({
  template: "meeting",
  title: "GMS Project Kickoff - Jackie",
  dest: "<discovered-dest>",
  args: {},
  content: {
    "<discovered-attendees-section>": "- Jackie (Team Lead)\n- Josh Green (Tech Lead)\n- Nathan",
    "<discovered-notes-section>": "### Key Points\n- GMS = Gift Card Management System\n- Reseller integration with Black Hawk\n- Deadline: July",
    "<discovered-decisions-section>": "- Estimates in days, not story points\n- All-in day: Thursday",
    "<discovered-action-items-section>": "- [ ] Get MacBook bun number to Jackie\n- [ ] Test VPN from home\n- [ ] Look at Miro board"
  },
  response_format: "json"
})
```

**Step 2: Set frontmatter**

Use fields from `validArgs` discovered in Step 0:

```
para_fm_set({
  file: "<discovered-dest>/🗣️ Note Title.md",
  set: {
    meeting_type: "general",
    meeting_date: "2026-01-06",
    area: "[[Career & Contracting]]",
    company: "Bunnings"
  }
})
```

**Step 3: Append Raw Transcription**

The meeting template does NOT have a Raw Transcription section. Add it after the last discovered section heading:

```
para_insert({
  file: "<discovered-dest>/🗣️ Note Title.md",
  heading: "<last-discovered-section>",
  content: "\n---\n\n## Raw Transcription\n\n> [Full cleaned transcription in blockquote format]",
  mode: "after"
})
```

## Template Output

```markdown
---
type: meeting
meeting_type: general
meeting_date: 2026-01-06
area: "[[Career & Contracting]]"
company: Bunnings
template_version: 1
---

# GMS Project Kickoff - Jackie

## Attendees

- Jackie (Team Lead, on leave until 27th)
- Josh Green (Tech Lead, Perth)
- June (Frontend/Backend dev)

## Notes

- GMS = Gift Card Management System
- Reseller integration with Black Hawk
- Deadline: July (likely to extend)

## Decisions Made

- Estimates in days, not story points
- All-in day: Thursday

## Action Items

- [ ] Get MacBook bun number to Jackie
- [ ] Test VPN from home tonight
- [ ] Look at Miro board for resellers

## Follow-up

-

---

## Raw Transcription

> [Full cleaned transcription preserved here...]
```

## Reference Example

See: `02 Areas/🤝🏻 Contract - Bunnings/🗣️ IT Onboarding - Bunnings.md`
