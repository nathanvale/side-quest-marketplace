---
description: Process daily log entries (voice memos, URLs, text) into structured inbox notes
allowed-tools: Read, mcp__para-obsidian_para-obsidian__para_read, mcp__para-obsidian_para-obsidian__para_list, mcp__para-obsidian_para-obsidian__para_create, mcp__para-obsidian_para-obsidian__para_insert, mcp__para-obsidian_para-obsidian__para_list_areas, mcp__para-obsidian_para-obsidian__para_list_projects, mcp__firecrawl__firecrawl_scrape, mcp__youtube-transcript__get_transcript, WebFetch, Edit, Write, Bash
model: haiku
---

# Log Triage

Process daily note log entries into structured notes.

Use the **log-triage** skill to:
- Extract 🎤 voice memos into meeting notes (with raw transcription preserved)
- Convert URLs into clipping notes by type (YouTube, GitHub, article, etc.)
- Turn reminders/thoughts into capture notes

**Workflow:**
1. Find the most recent daily note with log entries in `000 Timestamps/Daily Notes/`
2. Parse the `## Log` section for entries
3. Show what each entry will become and ask for confirmation
4. Create notes in `00 Inbox`
5. Remove processed entries from daily note

**Optional argument:** Date in YYYY-MM-DD format (defaults to most recent note with entries)

ARGUMENTS: $ARGUMENTS
