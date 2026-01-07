---
description: Process daily log entries (voice memos, URLs, text) into structured inbox notes
allowed-tools: Read, mcp__para-obsidian_para-obsidian__para_read, mcp__para-obsidian_para-obsidian__para_list, mcp__para-obsidian_para-obsidian__para_create, mcp__para-obsidian_para-obsidian__para_insert, mcp__para-obsidian_para-obsidian__para_list_areas, mcp__para-obsidian_para-obsidian__para_list_projects, mcp__para-obsidian_para-obsidian__para_frontmatter_set, mcp__firecrawl__firecrawl_scrape, mcp__youtube-transcript__get_transcript, WebFetch, Edit, Write, Bash
model: sonnet
---

# Log Triage

Process daily note log entries into structured notes.

## Entry Types

- **🎤 Voice memos** → Meeting notes with full transcription preserved
- **URLs** → Clipping notes by type (YouTube, GitHub, article, etc.)
- **Text/thoughts** → Capture notes

## Workflow

1. Find the most recent daily note with log entries in `000 Timestamps/Daily Notes/`
2. Parse the `## Log` section for entries
3. Show what each entry will become and ask for confirmation
4. Create notes in `00 Inbox`
5. Replace processed entries in daily note with `✅ <time> - Processed → [[Note Title]]`

**Optional argument:** Date in YYYY-MM-DD format (defaults to most recent note with entries)

---

## Voice Memo Processing (CRITICAL)

When processing 🎤 voice memos, you MUST:

### 1. Create the meeting note from template
Use `para_create` with template `meeting` and appropriate fields.

### 2. Extract key points into the Notes section
Use `para_insert` to add summarized key points under `## Notes`.

### 3. ADD a Raw Transcription section at the end
The meeting template does NOT have this section - you must ADD it using `para_insert` with mode `after` on the `## Follow-up` heading:

```
---

## Raw Transcription

> [Full transcription here in blockquote format]
```

### 4. Clean up the transcription
Before inserting, apply basic cleanup to the raw transcription:
- Remove filler words: "um", "uh", "like" (when filler), "you know"
- Fix obvious grammar issues
- Add proper punctuation
- Break into paragraphs at natural topic changes
- Keep the conversational tone and all content - just clean it up for readability

### 5. Preserve the FULL transcription
Do NOT summarize or truncate. The entire transcription must be preserved in the Raw Transcription section.

**Reference example:** `02 Areas/🤝🏻 Contract - Bunnings/🗣️ IT Onboarding - Bunnings.md`

---

ARGUMENTS: $ARGUMENTS
