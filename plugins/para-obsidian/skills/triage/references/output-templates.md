# Output Templates

## Single Table Format

After all analysis completes, present ONE table with ALL proposals:

```markdown
# Inbox Triage: 50 items

| #  | Title                                  | Area           | Project           | Type   | Conf |
|----|----------------------------------------|----------------|-------------------|--------|------|
| 1  | ClawdBot Setup Guide                   | 🤖 AI Practice  | 🎯 Clawdbot       | video  | ✓    |
| 2  | AI Replacing Libraries - Theo          | 🤖 AI Practice  | -                 | video  | ✓    |
| 3  | Pizza Moncur Restaurant                | 🏡 Home         | -                 | ref    | ?    |
| 5  | Q1 Planning Meeting Notes              | 💼 Work         | 🎯 Sprint 42      | meet   | ✓    |
| .. | ...                                    | ...            | ...               | ...    | ...  |
| 50 | TypeScript Migration Guide             | 🤖 AI Practice  | -                 | article| ~    |

Legend: ✓ = high confidence, ~ = medium, ? = low (use "3" for alternatives)

## Actions

• **A** - Accept all and execute
• **E 1,3,7** - Edit items 1, 3, 7 (change area/project) before accepting
• **D 5,12** - Delete items 5 and 12 (remove from inbox)
• **3 50** - Get 3 alternative categorizations for item 50
• **Q** - Quit (proposals saved, resume later)
```

When some items failed, add a **Status** column: `✓` (ready), `ENRICH` (enrichment failed), `ANALYZE` (analysis failed). Failed items can be retried with `R`.

---

## Inbox Summary (Phase 1)

```
Found 50 items in inbox:

📋 By Type:
• 40 clippings (web articles, threads)
• 8 voice memos (transcriptions)
• 2 attachments (PDFs, docs)

📋 By Enrichment:
• 35 parallel (YouTube, Firecrawl)
• 5 sequential (Confluence via Chrome)
• 10 no enrichment needed

Starting enrichment phase...
```

---

## Edit Mode Format

```
## Editing Item 3: Pizza Moncur Restaurant

Current:
• Area: 🏡 Home
• Project: -
• Type: ref

Change: (A)rea, (P)roject, (T)ype, (D)elete, or Enter to skip?
```

---

## Completion Report

```
✅ Triage complete!

Processed 50 items:
• 42 resources created (40 with Layer 1, 2 without)
• 5 meetings created
• 1 edited → re-created with changes
• 2 captures (stayed in inbox)

Use /para-obsidian:distill-resource to add progressive summarization.
```

---

## Resume Prompt

```
Found existing triage session:

📊 Status:
• 32 analyzed (proposals saved)
• 18 pending (need analysis)
• 0 completed

Resume from where you left off? (y/n)
```

---

## Action Reference

| Action | Input | Behavior |
|--------|-------|----------|
| Accept all | `A` | Create all resources, handle originals |
| Edit specific | `E 1,3,7` | Edit items 1, 3, 7 then accept all |
| Delete specific | `D 5,12` | Delete items 5, 12 from inbox, accept rest |
| Retry failed | `R 5,8` | Re-enrich items 5, 8 that failed |
| Skip failed | `S 5` | Keep item 5 in inbox for later |
| Quit | `Q` | Exit, proposals saved in tasks for resume |
| Combined | `E 1,3 D 5` | Edit 1,3 and delete 5, then accept rest |

---

## Item Type Icons

| Type | Icon | After Processing |
|------|------|------------------|
| Clipping | ✂️ | DELETE original |
| Transcription | 🎤 | ARCHIVE to 04 Archives/ |
| Attachment | 📎 | KEEP (linked via source) |

---

## Resource Type Abbreviations

| Full | Abbrev |
|------|--------|
| article | article |
| video | video |
| thread | thread |
| meeting | meet |
| reference | ref |
| tutorial | tut |
