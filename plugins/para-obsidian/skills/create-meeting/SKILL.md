---
name: create-meeting
description: >-
  Meeting orchestrator — creates structured meeting notes from any source:
  inline transcription text, VTT files, inbox transcription notes, or triage
  proposals. Use when creating meeting notes or when /meeting is invoked.
user-invocable: false
allowed-tools:
  - AskUserQuestion
  - Bash
  - mcp__plugin_para-obsidian_para-obsidian__para_create
  - mcp__plugin_para-obsidian_para-obsidian__para_fm_set
  - mcp__plugin_para-obsidian_para-obsidian__para_fm_get
  - mcp__plugin_para-obsidian_para-obsidian__para_read
  - mcp__plugin_para-obsidian_para-obsidian__para_rename
  - mcp__plugin_para-obsidian_para-obsidian__para_template_fields
  - mcp__plugin_para-obsidian_para-obsidian__para_list_areas
  - mcp__plugin_para-obsidian_para-obsidian__para_list_projects
  - mcp__plugin_para-obsidian_para-obsidian__para_commit
  - mcp__plugin_para-obsidian_para-obsidian__para_stakeholder_lookup
  - mcp__plugin_para-obsidian_para-obsidian__para_stakeholder_list
---

# Create Meeting — Orchestrator

Creates structured meeting notes from **any source**: inline text, VTT files, inbox transcription notes, or triage proposals. Detects the input type and normalizes all paths to a common creation pipeline.

```
Input Detection
├── Path A: Inline text       → create transcription note → analyze → confirm → create meeting
├── Path B: VTT file          → convert VTT to note       → analyze → confirm → create meeting
├── Path C: Inbox .md file    → validate type              → analyze → confirm → create meeting
├── Path D: Proposal object   → skip analysis              → create meeting (triage handles confirm)
│
▼ All paths converge:
Create meeting in 04 Archives/Meetings/
Link + archive transcription to 04 Archives/Transcriptions/
Report result
```

---

## Phase 0 — Input Detection

Examine the input and determine which path to take. First match wins:

| Signal | Path | Next Step |
|--------|------|-----------|
| JSON object with `proposed_template: "meeting"` | **D** (Proposal) | Jump to Phase 4 |
| File path ending `.vtt` | **B** (VTT) | See [path-workflows.md](references/path-workflows.md) — Path B |
| File path ending `.md` or bare note name | **C** (Inbox note) | Phase 1C below |
| Everything else (free text, pasted content) | **A** (Inline text) | See [path-workflows.md](references/path-workflows.md) — Path A |
| No input at all | **Prompt** | Ask what meeting to create |

**No-input behavior:** Use `AskUserQuestion` — "What meeting should I create? Paste transcription text, provide a file path (.vtt or .md), or describe the meeting."

---

## Phase 1 — Normalize to Transcription Note

Each path produces the same output: a transcription note path in the vault that can be read and analyzed.

### Path A: Inline Text

Raw text (pasted transcription, clipboard content, natural language description).

Follow [path-workflows.md](references/path-workflows.md) — Path A to create a transcription note via the CLI, then continue to Phase 2.

### Path B: VTT File

A `.vtt` subtitle/caption file.

Follow [path-workflows.md](references/path-workflows.md) — Path B to convert to a transcription note via the CLI, then continue to Phase 2.

### Path C: Inbox Note

A `.md` file or bare note name (expanded to `00 Inbox/<name>.md` if no path prefix).

1. Validate the file exists and has `type: transcription` via `para_fm_get`:
   ```
   para_fm_get({ file: "<path>", response_format: "json" })
   ```
2. If `type` is not `transcription`, error:
   ```
   "File <path> has type '<actual>' — expected 'transcription'.
    Use /para-obsidian:create-from-context for non-transcription sources."
   ```
3. Continue to Phase 2 with this file path.

### Path D: Proposal Object

A structured proposal from `analyze-voice` (via triage). Already contains all extracted content.

**Skip Phases 1-3 entirely.** Jump to Phase 4 (Create Meeting Note).

---

## Phase 2 — Load Context (Paths A/B/C only)

Gather everything needed for analysis. Make these calls in parallel:

```
para_list_areas({ response_format: "json" })
para_list_projects({ response_format: "json" })
para_stakeholder_list({ response_format: "json" })  // for speaker matching
para_template_fields({ template: "meeting", response_format: "json" })
para_read({ file: "<transcription_path>", response_format: "json" })
```

From `para_template_fields`, extract:
- `validArgs` — which args to pass (e.g., `meeting_date`, `meeting_type`, `transcription`, `summary`, `attendees`, `area`, `project`)
- `creation_meta.sections` — body section headings (e.g., `"Attendees"`, `"Notes"`, `"Decisions Made"`, `"Action Items"`, `"Follow-up"`)

**Destination override:** Ignore `creation_meta.dest` from the template. Hardcode destination as `04 Archives/Meetings`. The template metadata says `03 Resources/Meetings` which is wrong for this workflow.

---

## Phase 3 — Analyze Content & Confirm (Paths A/B/C only)

Use the transcription content and loaded context to extract structured meeting data.

See [analysis-and-creation.md](references/analysis-and-creation.md) for:
- Speaker matching against stakeholders (name, alias, email prefix → wikilinks)
- Meeting type classification
- Content extraction: attendees, notes, decisions, action items, follow-up, summary
- Area/project inference

### User Confirmation

Present the proposal via `AskUserQuestion`:

```
Meeting: "<proposed_title>"
Type: <meeting_type> | Date: <meeting_date>
Attendees: <attendee list>
Area: <area> | Project: <project or "none">

Extracted:
- <N> meeting notes
- <N> decisions
- <N> action items
- <N> follow-up items
```

Options:
- **"Create meeting"** → Proceed to Phase 4
- **"Edit details"** → Ask what to change, loop back
- **"Cancel"** → Abort with message

---

## Phase 4 — Create Meeting Note

All paths converge here. See the "Creation Pipeline" section in [analysis-and-creation.md](references/analysis-and-creation.md) for the full create → link → archive → report pipeline.

**Summary of what happens:**

1. `para_create` with `template: "meeting"`, `dest: "04 Archives/Meetings"`, body sections via `content` parameter
2. `para_fm_set` on transcription to add bi-directional `meeting` link
3. `para_rename` to archive transcription to `04 Archives/Transcriptions/`
4. `para_commit` to save all changes

**Path D exception:** Skip steps 2-4 (archive + commit). Triage owns those operations.

---

## Phase 5 — Report Result

Return a `SKILL_RESULT` for the calling skill or command to parse:

```
SKILL_RESULT:{
  "success": true,
  "created": "04 Archives/Meetings/Sprint 42 Planning Session.md",
  "transcription_archived": "04 Archives/Transcriptions/🎤 2026-02-02 3-45pm.md",
  "meeting_type": "planning",
  "sections_populated": ["Notes", "Decisions Made", "Action Items", "Follow-up"]
}
```

On error:

```
SKILL_RESULT:{
  "success": false,
  "error": "<description>",
  "phase": "<which phase failed>",
  "recovery": "<what the user can do>"
}
```

---

## Error Handling

| Phase | Failure | Recovery |
|-------|---------|----------|
| 0 | Can't determine input type | Ask user to clarify |
| 1A | CLI `voice convert` fails | Report CLI error, suggest checking input format |
| 1B | VTT file not found or invalid | Report path, suggest checking file exists |
| 1C | File not found or wrong type | Report actual type, suggest correct skill |
| 2 | Template fields unavailable | Report error, suggest checking vault config |
| 3 | No speakers/content found | Create with minimal data, warn user |
| 4 | `para_create` fails | Do NOT archive transcription. Report error for retry |
| 4 | `para_fm_set` fails | Meeting created but link missing. Report partial success |
| 5 | `para_rename` (archive) fails | Meeting created, link set, but transcription not archived. Report partial |

**Critical rule:** If meeting creation (Phase 4 step 1) fails, do NOT proceed to linking or archiving. Transcription stays in place for retry.

---

## Meeting Types

See the "Meeting Types" section in [references/analysis-and-creation.md](references/analysis-and-creation.md) for valid `meeting_type` enum values and inference signals.
