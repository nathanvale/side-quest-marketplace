# Output Templates

## Single Table Format

After all analysis completes, present ONE table with ALL proposals:

```markdown
# Inbox Triage: 50 items

| #  | Title                                  | Area           | Project           | Type   |
|----|----------------------------------------|----------------|-------------------|--------|
| 1  | ClawdBot Setup Guide                   | 🤖 AI Practice  | 🎯 Clawdbot       | video  |
| 2  | AI Replacing Libraries - Theo          | 🤖 AI Practice  | -                 | video  |
| 3  | Pizza Moncur Restaurant                | 🏡 Home         | -                 | ref    |
| 4  | Three-Layer Memory System              | 🤖 AI Practice  | 🎯 Clawdbot       | thread |
| 5  | Q1 Planning Meeting Notes              | 💼 Work         | 🎯 Sprint 42      | meet   |
| .. | ...                                    | ...            | ...               | ...    |
| 50 | TypeScript Migration Guide             | 🤖 AI Practice  | -                 | article|

## Actions

• **A** - Accept all and execute
• **E 1,3,7** - Edit items 1, 3, 7 (change area/project) before accepting
• **D 5,12** - Delete items 5 and 12 (remove from inbox)
• **Q** - Quit (proposals saved, resume later)
```

---

## Inbox Summary (Phase 1)

After scanning inbox, before analysis:

```
Found 50 items in inbox:

📋 By Type:
• 40 clippings (web articles, threads)
• 8 voice memos (transcriptions)
• 2 attachments (PDFs, docs)

📋 By Enrichment:
• 35 parallel (YouTube, Firecrawl)
• 5 sequential (X/Twitter via Chrome)
• 10 no enrichment needed

Starting enrichment phase...
```

---

## Progress Updates (During Analysis)

Keep user informed during parallel analysis:

```
Enrichment complete. Starting analysis...

Analyzing 50 items in parallel (batches of 5)...
• Batch 1/10 complete
• Batch 2/10 complete
...

Analysis complete. Preparing review table...
```

---

## Edit Mode Format

When user selects items to edit with "E 1,3,7":

```
## Editing Item 1: ClawdBot Setup Guide

Current:
• Area: 🤖 AI Practice
• Project: 🎯 Clawdbot

Options:
• (A) Change area
• (P) Change project
• (D) Delete instead
• (Enter) Keep as-is, next item

Your choice:
```

If user chooses to change area:
```
Available areas:
1. 🤖 AI Practice
2. 🏡 Home
3. 💼 Work
4. 🌱 Personal Development
...

Enter number or name:
```

---

## Completion Report

After execution completes:

```
✅ Triage complete!

Processed 50 items:
• 47 accepted → created resource notes
• 1 edited → created with changes
• 2 deleted

📍 Resources created in: 03 Resources/
📍 Transcriptions archived in: 04 Archives/Transcriptions/

Next steps:
• Review new resources in Obsidian
• Run /para-obsidian:distill-resource for progressive summarization
```

---

## Resume Prompt

When existing triage tasks are detected:

```
Found existing triage session:

📊 Status:
• 32 analyzed (proposals saved)
• 18 pending (need analysis)
• 0 completed

Resume from where you left off? (y/n)
```

---

## Error States

### No Items Found
```
Inbox is empty! Nothing to triage.
```

### Enrichment Failed
```
⚠️ Enrichment failed for 3 items:
• ✂️ Twitter Thread.md - Chrome DevTools timeout
• ✂️ YouTube Video.md - Transcript unavailable

Options:
• (S) Skip failed items, continue with rest
• (R) Retry failed items
• (Q) Quit
```

### Analysis Failed
```
⚠️ Analysis failed for 2 items:
• Item 5: Subagent timeout
• Item 12: Invalid response

These items remain as "pending" and can be retried on resume.
Continuing with 48 successful proposals...
```

---

## Action Reference

| Action | Input | Behavior |
|--------|-------|----------|
| Accept all | `A` | Create all resources, handle originals |
| Edit specific | `E 1,3,7` | Edit items 1, 3, 7 then accept all |
| Delete specific | `D 5,12` | Delete items 5, 12 from inbox, accept rest |
| Retry failed | `R 5,8` | Re-enrich items 5, 8 that failed enrichment |
| Skip failed | `S 5` | Keep item 5 in inbox for later processing |
| Quit | `Q` | Exit, proposals saved in tasks for resume |
| Combined | `E 1,3 D 5` | Edit 1,3 and delete 5, then accept rest |

---

## Item Type Icons

| Type | Icon | After Processing |
|------|------|------------------|
| Clipping | ✂️ | DELETE original |
| Transcription | 🎤 | MOVE to Archives |
| Attachment | 📎 | KEEP (linked via source) |

---

## Resource Type Abbreviations

| Full | Abbrev | Use For |
|------|--------|---------|
| article | article | Blog posts, essays |
| video | video | YouTube, tutorials |
| thread | thread | Twitter/X threads |
| meeting | meet | Meeting notes, 1:1s |
| reference | ref | Docs, guides, manuals |
| tutorial | tut | How-to content |

---

## Table with Failed Items

When some items failed enrichment or analysis, the table includes a Status column:

```markdown
# Inbox Triage: 50 items (3 need attention)

| #  | Title                           | Area          | Project      | Type  | Status |
|----|--------------------------------|---------------|--------------|-------|--------|
| 1  | ClawdBot Setup Guide           | 🤖 AI Practice | 🎯 Clawdbot  | video | ✓      |
| 2  | AI Replacing Libraries         | 🤖 AI Practice | -            | video | ✓      |
| 3  | ⚠️ Twitter Thread              | ?             | ?            | thread| ENRICH |
| 4  | Pizza Moncur Restaurant        | 🏡 Home        | -            | ref   | ✓      |
| 5  | ⚠️ Complex Article             | ?             | ?            | article| ANALYZE|
| .. | ...                            | ...           | ...          | ...   | ...    |
| 50 | TypeScript Guide               | 🤖 AI Practice | -            | article| ✓      |

## Legend
• ✓ - Ready to process
• ENRICH - Enrichment failed (retry with R)
• ANALYZE - Analysis failed (retry with R)

## Actions
• **A** - Accept all ready items (47)
• **R 3,5** - Retry failed items 3 and 5
• **D 3,5** - Delete failed items (remove from inbox)
• **S 3,5** - Skip failed items (keep in inbox)
• **E 1,4** - Edit ready items before accepting
• **Q** - Quit (all state saved)
```

---

## Invalid Proposal Warning

When subagent returns malformed proposal:

```
⚠️ Item 5 has invalid proposal:
• Missing: area
• Invalid: resourceType = "blog" (not in allowed list)

Options:
• (E) Edit manually
• (R) Re-analyze
• (D) Delete
```
