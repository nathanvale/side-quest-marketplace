# Para-Obsidian Roadmap

Future ideas and enhancements for the plugin.

---

## LLM Features

### Convert Command Enhancements

- [ ] `--replace` flag - Delete original file after successful conversion + validation
- [ ] Batch convert - Process multiple files at once (`convert --dir "00 Inbox" --template booking`)
- [ ] Model selection in config - Set default model in `.para-obsidianrc`
- [ ] Retry with fallback - If local LLM fails, optionally retry with cloud model

### New LLM Commands

- [ ] `summarize` - Generate summary of a note using local LLM
- [ ] `tag-suggest` - Suggest tags based on note content
- [ ] `link-suggest` - Suggest wikilinks to related notes
- [ ] `review` - AI-assisted weekly review generation
- [ ] `extract-tasks` - Pull action items from meeting notes
- [ ] `template-detect` - Analyze content and suggest best template type
- [ ] `enrich` - Add missing frontmatter fields by inferring from content
- [ ] `semantic-duplicates` - Find conceptually similar notes (not just title match)

---

## Automation

### Scheduled Inbox Processing

- [ ] Automated inbox cleanup script - Process `00 Inbox` on schedule
- [ ] launchd plist generator - Create macOS-native scheduled tasks
- [ ] Batch convert inbox notes - Auto-detect template type and convert
- [ ] Stale note detection - Flag notes sitting in inbox too long

**Implementation options:**
- cron (simple, universal)
- launchd (macOS native, survives sleep/wake, more reliable)

---

## Other Ideas

### Vault Health & Maintenance

- [ ] `stats` command - Vault dashboard (note counts by type, orphans, stale notes)
- [ ] `orphans` command - Find notes with no incoming links
- [ ] `broken-links` command - Detect and fix broken wikilinks
- [ ] `archive-stale` - Auto-archive projects with no activity for N days
- [ ] `duplicates` - Find potential duplicate notes (title similarity)

### Quick Capture

- [ ] `capture` command - Quick capture from clipboard to inbox
- [ ] `capture --url` - Fetch URL metadata and create resource note
- [ ] Voice memo transcription → capture note

### Review & Reflection

- [ ] `weekly-prep` - Generate weekly review template pre-filled with activity
- [ ] `daily-rollover` - Roll incomplete tasks to today's daily note
- [ ] `project-status` - Generate status report across all active projects
- [ ] `area-check` - Reminder for areas not reviewed recently

### Integrations

- [ ] Calendar import - Create notes from calendar events (ical)
- [ ] Dataview query generator - Natural language → Dataview queries
- [ ] Export to PDF/HTML - Publish-ready output
- [ ] Backup command - Timestamped vault snapshots

### Templates & Migration

- [ ] Interactive migration wizard - Guide through template version upgrades
- [ ] Template diff - Show what changed between template versions
- [ ] Custom template creator - Scaffold new template types

---

## Completed

- [x] `convert` command - Extract frontmatter + content from freeform notes using local LLM (qwen2.5:14b)
