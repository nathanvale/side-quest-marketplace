---
description: Process daily log entries (voice memos, URLs, text) into structured inbox notes
---

# Log Triage

Process daily note log entries into structured notes.

**Skill Reference:** This command uses the `log-triage` skill which contains comprehensive knowledge about processing voice memos, URLs, and text entries into structured inbox notes.

## What It Does

- Extract 🎤 voice memos into meeting notes (with full raw transcription preserved)
- Convert URLs into clipping notes by type (YouTube, GitHub, article, etc.)
- Turn reminders/thoughts into capture notes

## Process

1. **Load the log-triage skill** for detailed templates, URL mappings, and transcription handling
2. Find the daily note for the specified date (or most recent with entries)
3. Parse the `## Log` section for entries
4. Show what each entry will become and ask for confirmation
5. Create notes in `00 Inbox` following the skill's templates
6. Replace processed entries with `✅ <time> - Processed → [[Note Title]]`

**Optional argument:** Date in YYYY-MM-DD format (defaults to most recent note with entries)

ARGUMENTS: $ARGUMENTS
