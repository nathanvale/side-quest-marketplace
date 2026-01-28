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

## What This Does

**Single file:** Routes directly to appropriate worker skill, presents proposal for review.

**Bulk processing:**
1. **Syncs voice memos** - Runs `para voice` to transcribe any new Apple Voice Memos into inbox
2. **Scans inbox** - Finds clippings, transcriptions, and attachments
3. **Batches of 5** - Processes 5 items in parallel using subagents
4. **Sequential review** - Presents proposals one at a time
5. **Collaborative actions** - Accept, Edit, Skip, Delete, or go Deeper
6. **State persistence** - Quit anytime, resume later

## Instructions

When invoked, load the `triage` skill:

```
@plugins/para-obsidian/skills/triage/SKILL.md
```

## Review Actions

| Key | Action | What Happens |
|-----|--------|--------------|
| **A** | Accept | Create note from proposal |
| **E** | Edit | Modify proposal details |
| **S** | Skip | Keep in inbox for later |
| **D** | Delete | Remove from inbox |
| **3** | Deeper | Get 3 alternative categorizations |
| **Q** | Quit | Save progress, exit |

## The "Deeper" Option

When you choose **3** (Deeper), especially for voice memos, you get **3 different interpretations**:

```
Option A: Meeting Notes (standup)
→ Team sync discussing sprint progress...

Option B: Personal Reflection
→ Thinking through career direction...

Option C: Brainstorm Session
→ Ideas for new feature implementation...

Which interpretation? (A/B/C)
```

This is particularly useful for voice memos where the content could be categorized multiple ways.

## Example Session

```
User: /para-obsidian:triage

AI: Found 9 items in inbox:
    • 4 clippings
    • 3 voice memos
    • 2 attachments (PDFs)

    Processing batch 1 of 2...

AI: ## Proposal 1 of 3

    **📝 Claude Code iMessage Integration**
    From: ✂️ Arman Hezarkhani thread.md

    ### Summary
    Tutorial showing how to run Claude Code inside iMessage...

    **Actions:** A(ccept) E(dit) S(kip) D(elete) 3(deeper) Q(uit)

User: A

AI: ✅ Created: 📚 Claude Code iMessage Integration.md
    🗑️ Deleted: ✂️ Arman Hezarkhani thread.md

    ## Proposal 2 of 3
    ...
```

## Why Parallel + Sequential?

**The Problem:** Processing 20 items sequentially fills context by item 5.

**The Solution:**
- Each item analyzed in isolated subagent context (no rot)
- 5 items processed simultaneously (5x faster)
- Only lightweight proposals return to main context
- You review one at a time (collaborative control)

## Resume Capability

Progress saved to `~/.claude/para-triage-state.json`. If you quit mid-session:

```
User: /para-obsidian:triage

AI: Found saved progress: 4 of 9 items processed.
    Resume from where you left off? (y/n)
```

## Single File vs Bulk

| Mode | When | Behavior |
|------|------|----------|
| **Single** | Filename provided | Direct to worker, one proposal, done |
| **Bulk** | No filename | Scan inbox, batch of 5, sequential review |

Single file mode is simpler - no batching, no state persistence, just process and done.
