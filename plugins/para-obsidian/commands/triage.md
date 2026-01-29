---
description: Process inbox items - single file or bulk with parallel batches
argument-hint: "[filename|all|clippings|voice|attachments]"
---

# Triage Inbox

Process inbox items with intelligent routing. Single file or bulk processing.

## Usage

```
/para-obsidian:triage                     # Process all inbox items (batches of 5)
/para-obsidian:triage "✂️ Article.md"    # Process single clipping
/para-obsidian:triage "🎤 Voice memo.md" # Process single voice memo
/para-obsidian:triage clippings           # Only web clippings
/para-obsidian:triage voice               # Only voice memos
/para-obsidian:triage attachments         # Only PDFs/DOCX
```

## Instructions

When invoked, load the `triage` skill for full workflow details:

```
@plugins/para-obsidian/skills/triage/SKILL.md
```

## Review Actions

| Key | Action |
|-----|--------|
| **A** | Accept all and execute |
| **E 1,3** | Edit items before accepting |
| **D 5** | Delete items from inbox |
| **3 50** | Get 3 alternative categorizations |
| **Q** | Quit (proposals saved, resume later) |
