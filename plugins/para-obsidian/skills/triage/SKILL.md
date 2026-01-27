---
name: triage
description: Process inbox items using parallel subagents with single-table review. Subagents persist proposals immediately via TaskUpdate for crash resilience.
user-invocable: true
disable-model-invocation: true
allowed-tools: Task, Read, TaskCreate, TaskUpdate, TaskList, TaskGet, AskUserQuestion, mcp__plugin_para-obsidian_para-obsidian__para_read, mcp__plugin_para-obsidian_para-obsidian__para_list, mcp__plugin_para-obsidian_para-obsidian__para_create, mcp__plugin_para-obsidian_para-obsidian__para_delete, mcp__plugin_para-obsidian_para-obsidian__para_rename, mcp__plugin_para-obsidian_para-obsidian__para_frontmatter_get, mcp__plugin_para-obsidian_para-obsidian__para_frontmatter_set, mcp__plugin_para-obsidian_para-obsidian__para_list_areas, mcp__plugin_para-obsidian_para-obsidian__para_list_projects, mcp__youtube-transcript__get_transcript, mcp__youtube-transcript__get_video_info, mcp__firecrawl__firecrawl_scrape, mcp__firecrawl__firecrawl_search, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__take_snapshot, mcp__chrome-devtools__list_pages, mcp__chrome-devtools__select_page, mcp__chrome-devtools__new_page
---

# Triage Coordinator

Process inbox items with **parallel subagents** and **single-table review**.

**Key design:** Subagents persist proposals immediately via TaskUpdate. If session crashes at item 23 of 50, items 1-22 are saved and resumable.

## Scope

**Single-session workflow.** Creates quick resource notes with `distilled: false`. Use `/para-obsidian:distill-resource` for progressive summarization.

---

## Architecture Overview

```
Phase 1: Initialize (coordinator)
├── Scan inbox, create tasks (status: pending)
└── Load vault context (areas, projects)

Phase 2: Enrich + Analyze (subagents)
├── Each subagent: fetch content → analyze → persist proposal
├── Parallel for YouTube, articles (batches of 5)
├── Sequential for X/Twitter (single browser)
└── Enriched content stays in subagent context (coordinator stays clean)

Phase 3: Present (coordinator)
├── Read all tasks, filter for analyzed
├── Render table with all proposals
└── User chooses: Accept all, Edit specific, Delete specific

Phase 4: Edit (only if requested)
└── Quick inline edits for selected items

Phase 5: Execute (coordinator)
├── Create all resources (para_create)
├── Delete/archive originals
└── Cleanup tasks
```

**Key insight:** Subagents handle BOTH enrichment AND analysis. Enriched content never flows through coordinator context.

**See:** [architecture.md](references/architecture.md) for diagrams.

---

## Input Routing

Check `$ARGUMENTS`:

| Input | Action |
|-------|--------|
| Empty or `all` | Full inbox processing |
| `clippings` / `voice` / `attachments` | Filter by type |
| `"filename.md"` | Single file mode (skip batching) |

---

## Phase 0: Check for Resume

```typescript
TaskList()
```

Filter for tasks where `id.startsWith("triage:")`.

If existing triage tasks found:
```
Found existing triage session:
• 32 analyzed (proposals saved)
• 18 pending

Resume? (y/n)
```

If yes → Skip to Phase 2 (process pending items only).

---

## Phase 1: Initialize

### 1.1 Load Vault Context

```typescript
para_list_areas({ response_format: "json" })
para_list_projects({ response_format: "json" })
```

### 1.2 Scan Inbox

```typescript
para_list({ path: "00 Inbox", response_format: "json" })
```

Categorize each item by:

**Item Type (for analysis skill):**
| Type | Detection | Analysis Skill |
|------|-----------|----------------|
| `clipping` | `type === "clipping"` | distill-web |
| `transcription` | `type === "transcription"` | distill-voice |
| `attachment` | PDF/DOCX | distill-attachment |

**Source Type (for enrichment):**
| Source | Detection | Tool | Parallel? |
|--------|-----------|------|-----------|
| YouTube | `youtube.com` domain | youtube-transcript | ✅ Yes |
| X/Twitter | `x.com` or `twitter.com` | Chrome DevTools | ❌ No |
| GitHub | `github.com` | Firecrawl | ✅ Yes |
| Public article | Default | Firecrawl | ✅ Yes |
| Voice/Attachment | Has content | None | N/A |

**CRITICAL - X/Twitter:** Web Clipper captures only stubs. You MUST enrich via Chrome DevTools regardless of clipping content.

### 1.3 Create All Tasks Upfront

```typescript
// For each inbox item:
TaskCreate({
  subject: "Triage: ✂️ Article Name",
  description: "File: 00 Inbox/✂️ Article.md\nType: clipping\nSource: youtube",
  activeForm: "Analyzing article",
  metadata: {
    file: "00 Inbox/✂️ Article.md",
    itemType: "clipping",
    sourceType: "youtube",
    proposal: null  // Filled by subagent
  }
})
```

Task IDs are auto-generated. Store mapping: `{ taskId → file }`.

### 1.4 Present Summary

```
Found 50 items in inbox:

📋 By Type:
• 40 clippings
• 8 voice memos
• 2 attachments

📋 By Enrichment:
• 35 parallel (YouTube, articles)
• 5 sequential (X/Twitter)
• 10 no enrichment needed

Starting subagent processing...
```

---

## Phase 2: Parallel Enrich + Analyze

**Key insight:** Each subagent handles BOTH enrichment AND analysis. This keeps enriched content out of the coordinator's context.

### 2.1 Spawn Subagents

For each batch of 5 items, spawn subagents **in a single message** for parallel execution.

**EXCEPTION:** X/Twitter items must be sequential (single Chrome browser). Process these separately after parallel items complete.

```typescript
Task({
  subagent_type: "general-purpose",
  description: "Process: Article Title",
  model: "haiku",
  prompt: `
    You are processing a single inbox item: enrich, analyze, and persist.

    ## Item
    Task ID: ${taskId}
    File: ${file}
    Source URL: ${sourceUrl}
    Source Type: ${sourceType}  // youtube, twitter, article, voice, attachment

    ## Vault Context (use these, don't fetch)

    ### Areas
    ${JSON.stringify(areas, null, 2)}

    ### Projects
    ${JSON.stringify(projects, null, 2)}

    ## Step 1: Enrich (fetch full content)

    Based on source type, fetch the content:

    **YouTube:**
    mcp__youtube-transcript__get_transcript({ url: "${sourceUrl}" })

    **Article/GitHub:**
    mcp__firecrawl__firecrawl_scrape({ url: "${sourceUrl}", formats: ["markdown"] })

    **X/Twitter:**
    mcp__chrome-devtools__navigate_page({ url: "${sourceUrl}", timeout: 30000 })
    mcp__chrome-devtools__take_snapshot({})

    **Voice/Attachment:** Content already in file, use para_read.

    ## Step 2: Analyze

    Based on the enriched content, create a proposal:
    - title: Meaningful, descriptive title
    - summary: 2-3 sentences capturing key value
    - area: Wikilink from vault [[Area Name]]
    - project: Wikilink or null
    - resourceType: article|video|thread|meeting|reference

    **CRITICAL:** Only use areas/projects from the lists above.

    ## Step 3: Persist (CRITICAL - do not skip)

    TaskUpdate({
      taskId: "${taskId}",
      status: "in_progress",
      metadata: {
        proposal: {
          title: "...",
          summary: "...",
          area: "[[Area]]",
          project: "[[Project]]" or null,
          resourceType: "..."
        }
      }
    })

    This ensures your work survives if the session crashes.
  `
})
```

**CRITICAL:** Run 5 Task calls in a single message for parallel execution.

**See:** [subagent-prompts.md](references/subagent-prompts.md) for full templates.

### 2.2 Handle X/Twitter Separately

X/Twitter requires Chrome DevTools (single browser instance). Process sequentially AFTER parallel items:

```typescript
// After all parallel subagents complete, process Twitter items one at a time
for (const twitterItem of twitterItems) {
  Task({
    subagent_type: "general-purpose",
    description: "Process: Twitter Thread",
    model: "haiku",
    prompt: `... same prompt with sourceType: "twitter" ...`
  })
  // Wait for completion before next
}
```

### 2.3 Wait for Completion

All subagents persist their own proposals via TaskUpdate. Coordinator context stays clean.

---

## Phase 3: Present Single Table

### 3.1 Read All Proposals

```typescript
TaskList()
// Filter: id contains "triage" AND metadata.proposal !== null
```

### 3.2 Render Table

```markdown
# Inbox Triage: 50 items

| #  | Title                           | Area          | Project      | Type  |
|----|--------------------------------|---------------|--------------|-------|
| 1  | ClawdBot Setup Guide           | 🤖 AI Practice | 🎯 Clawdbot  | video |
| 2  | AI Replacing Libraries         | 🤖 AI Practice | -            | video |
| 3  | Pizza Moncur Restaurant        | 🏡 Home        | -            | ref   |
| .. | ...                            | ...           | ...          | ...   |
| 50 | Meeting Notes Q1               | 💼 Work        | -            | meet  |

## Actions
• **A** - Accept all and execute
• **E 1,3,7** - Edit items 1, 3, 7 before accepting
• **D 5,12** - Delete items 5 and 12
• **Q** - Quit (proposals saved for resume)
```

**See:** [output-templates.md](references/output-templates.md)

---

## Phase 4: Edit (If Requested)

For each item in edit list:

```
## Editing Item 3: Pizza Moncur Restaurant

Current:
• Area: 🏡 Home
• Project: -

Change: (A)rea, (P)roject, (D)elete, or Enter to skip?
```

Quick inline edits. Update task metadata with changes.

---

## Phase 5: Execute

### 5.1 Create Resources

**CRITICAL:** Use frontmatter-only approach. ALL data in `args`, NEVER in `content`.

```typescript
para_create({
  template: "resource",
  title: proposal.title,
  dest: "03 Resources",
  args: {
    summary: proposal.summary,
    source: originalUrl,
    resource_type: proposal.resourceType,
    areas: proposal.area,           // Wikilink: "[[Area]]"
    projects: proposal.project,      // Wikilink or omit
    distilled: "false"
  }
})
```

### 5.2 Handle Originals

| Type | Action |
|------|--------|
| Clipping | `para_delete({ file, confirm: true })` |
| Transcription | `para_rename({ from, to: "04 Archives/Transcriptions/..." })` |
| Attachment | Keep in place (linked via source) |

### 5.3 Cleanup Tasks

```typescript
// Mark each as completed
TaskUpdate({ taskId, status: "completed" })

// Or delete all triage tasks
// (Tasks auto-cleanup when session ends)
```

### 5.4 Report

```
✅ Triage complete!

Processed 50 items:
• 47 accepted → created resource notes
• 1 edited → created with changes
• 2 deleted

Use /para-obsidian:distill-resource to add progressive summarization.
```

---

## Quick Reference

### Task States

| State | Meaning |
|-------|---------|
| `pending` | Created, not yet analyzed |
| `in_progress` | Subagent completed, proposal saved |
| `completed` | Resource created |

### Resume Capability

If session crashes/quits:
1. Tasks with `status: "in_progress"` have proposals saved
2. Tasks with `status: "pending"` need re-analysis
3. Run `/triage` again → detects existing tasks → offers resume

### Enrichment Constraints

| Source | Parallel? | Reason |
|--------|-----------|--------|
| YouTube | ✅ Yes | Stateless API |
| Firecrawl | ✅ Yes | Batch API |
| Chrome DevTools | ❌ No | Single browser instance |

---

## References

| File | Content |
|------|---------|
| [architecture.md](references/architecture.md) | Flow diagrams, design rationale |
| [enrichment-strategies.md](references/enrichment-strategies.md) | Tool selection by source |
| [subagent-prompts.md](references/subagent-prompts.md) | Analysis prompt templates |
| [output-templates.md](references/output-templates.md) | Table format, actions |
| [task-patterns.md](references/task-patterns.md) | TaskCreate/Update API usage |
