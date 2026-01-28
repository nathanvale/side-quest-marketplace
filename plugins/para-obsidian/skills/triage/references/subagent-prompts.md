# Subagent Prompts

## Overview

Each subagent handles BOTH enrichment AND analysis for a single inbox item. This keeps enriched content out of the coordinator's context.

**Subagent responsibilities:**
1. Fetch full content (enrich)
2. Analyze and create proposal
3. Persist via TaskUpdate

**Coordinator responsibilities:**
1. Scan inbox, create tasks
2. Load vault context (areas/projects) ONCE
3. Spawn subagents with context
4. Present table, handle edits
5. Execute para_create calls

---

## Model Selection

| Task | Model | Rationale |
|------|-------|-----------|
| Enrich + Analyze | `haiku` | Fast, cheap, good for categorization |
| Complex content | `sonnet` | Use if haiku struggles with nuance |

---

## Combined Enrich + Analyze Prompt

**CRITICAL:** Coordinator passes vault context. Subagent fetches content and creates proposal.

```typescript
Task({
  subagent_type: "general-purpose",
  description: "Process: ${title}",
  model: "haiku",
  prompt: `
    You are processing a single inbox item: enrich, analyze, and persist.

    ## Item Details
    Task ID: ${taskId}
    File: ${file}
    Source URL: ${sourceUrl}
    Source Type: ${sourceType}

    ## Vault Context (pre-loaded - use these, don't fetch)

    ### Areas
    ${JSON.stringify(areas, null, 2)}

    ### Projects
    ${JSON.stringify(projects, null, 2)}

    **CRITICAL:** Only use areas/projects from the lists above. Never hallucinate names.

    ## Step 1: Enrich (fetch full content)

    Based on source type, fetch the content:

    **YouTube:**
    \`\`\`
    mcp__youtube-transcript__get_transcript({ url: "${sourceUrl}" })
    \`\`\`
    If transcript unavailable, use:
    \`\`\`
    mcp__youtube-transcript__get_video_info({ url: "${sourceUrl}" })
    \`\`\`

    **Article/GitHub:**
    \`\`\`
    mcp__firecrawl__firecrawl_scrape({ url: "${sourceUrl}", formats: ["markdown"] })
    \`\`\`

    **X/Twitter:**
    \`\`\`
    mcp__chrome-devtools__navigate_page({ url: "${sourceUrl}", timeout: 30000 })
    mcp__chrome-devtools__take_snapshot({})
    \`\`\`
    Extract tweet text from snapshot.

    **Voice/Attachment:**
    Content already in file:
    \`\`\`
    para_read({ file: "${file}" })
    \`\`\`

    ## Step 2: Analyze

    Based on the enriched content, create a proposal with ALL required fields:

    ### Core Fields (required for all types)
    - **proposed_title**: Meaningful, descriptive title (not the filename)
    - **proposed_template**: "resource" | "meeting" | "capture"
    - **summary**: 2-3 sentences capturing key value/insights
    - **area**: Wikilink to existing area [[Area Name]]
    - **project**: Wikilink to existing project, or null if none applies
    - **resourceType**: One of: article | video | thread | meeting | reference | idea

    ### UX Fields (required for review table)
    - **categorization_hints**: Array of 3 key points explaining why you chose this categorization
      Example: ["Multiple speakers discussing sprint tasks", "Action items assigned with deadlines", "Technical backlog prioritization"]
    - **source_format**: "article" | "video" | "audio" | "document" | "thread" | "image"
    - **confidence**: "high" | "medium" | "low"
      - high: Clear format, obvious categorization
      - medium: Likely correct but could be wrong
      - low: Ambiguous, multiple valid interpretations (triggers "Deeper" option)
    - **notes**: Special considerations or caveats (e.g., "Transcription has garbled names", "Could also be a brainstorm session")

    ### Meeting-Specific Fields (when proposed_template === "meeting")
    - **meeting_type**: standup | 1on1 | planning | retro | workshop | general
    - **meeting_date**: ISO date from recorded/created field
    - **attendees**: Array of wikilinks/names ["[[June Xu]]", "Speaker 3"]
    - **meeting_notes**: Array of key discussion points
    - **decisions**: Array of decisions made
    - **action_items**: Array of { assignee, task, due } objects
    - **follow_up**: Array of next steps

    **CRITICAL:** Only use areas/projects from the vault context above. Never hallucinate names.

    ## Step 3: Persist (CRITICAL - do not skip)

    **This is the most important step.** Call TaskUpdate to save your work:

    \`\`\`
    TaskUpdate({
      taskId: "${taskId}",
      status: "in_progress",
      metadata: {
        proposal: {
          title: "Your proposed title",
          summary: "Your 2-3 sentence summary",
          area: "[[Existing Area]]",
          project: "[[Existing Project]]" or null,
          resourceType: "article"
        }
      }
    })
    \`\`\`

    This ensures your work survives if the session crashes.

    ## Output (CRITICAL - Dual Communication)

    You must provide BOTH for the coordinator:

    ### 1. Persist to Task (crash resilience)
    Call TaskUpdate as shown in Step 3.

    ### 2. Return Structured Text (immediate use)
    After TaskUpdate, return a parseable proposal so the coordinator doesn't need extra tool calls:

    \`\`\`
    PROPOSAL_JSON:{"taskId":"${taskId}","proposed_title":"Your Title","proposed_template":"resource","summary":"2-3 sentences","area":"[[Area]]","project":"[[Project]]","resourceType":"article","source_format":"article","confidence":"medium","categorization_hints":["hint1","hint2","hint3"],"notes":null,"file":"${file}"}
    \`\`\`

    This allows the coordinator to use your proposal immediately without calling TaskGet.

    **Example complete output (resource):**
    \`\`\`
    ✓ Analyzed: "Claude Code iMessage Integration"
      Area: [[🤖 AI Practice]]
      Project: [[🎯 Clawdbot Setup & Integration]]
      Type: article
      Confidence: high

    PROPOSAL_JSON:{"taskId":"1","proposed_title":"Claude Code iMessage Integration","proposed_template":"resource","summary":"Tutorial showing how to integrate Claude Code with iMessage for AI-powered messaging...","area":"[[🤖 AI Practice]]","project":"[[🎯 Clawdbot Setup & Integration]]","resourceType":"article","source_format":"video","confidence":"high","categorization_hints":["YouTube tutorial format","Step-by-step integration guide","Focuses on iMessage automation"],"notes":null,"file":"00 Inbox/✂️ Claude Code iMessage.md"}
    \`\`\`

    **Example complete output (meeting):**
    \`\`\`
    ✓ Analyzed: "Sprint 47 Planning Session"
      Area: [[💼 Work]]
      Project: [[🎯 GMS - Gift Card Management System]]
      Type: meeting (planning)
      Confidence: high

    PROPOSAL_JSON:{"taskId":"2","proposed_title":"Sprint 47 Planning Session","proposed_template":"meeting","summary":"GMS team sprint planning covering voucher API dependencies, bulk print order features, and backlog prioritization.","area":"[[💼 Work]]","project":"[[🎯 GMS - Gift Card Management System]]","resourceType":"meeting","source_format":"audio","confidence":"high","categorization_hints":["Multiple speakers with status updates","Action items assigned with deadlines","Sprint backlog discussion"],"notes":"All speakers from GMS squad - project auto-inferred","meeting_type":"planning","meeting_date":"2026-01-28","attendees":["[[June Xu]]","[[Mustafa Jalil]]"],"meeting_notes":["..."],"decisions":["..."],"action_items":[{"assignee":"[[June Xu]]","task":"Review PR","due":"2026-01-30"}],"follow_up":["..."],"file":"00 Inbox/🎤 2026-01-28 4-27pm.md"}
    \`\`\`
  `
})
```

---

## Spawning in Parallel

**CRITICAL:** To run subagents in parallel, include multiple Task calls in a single message.

```typescript
// Single message with 5 Task calls = parallel execution
Task({ subagent_type: "general-purpose", description: "Process: Item 1", ... })
Task({ subagent_type: "general-purpose", description: "Process: Item 2", ... })
Task({ subagent_type: "general-purpose", description: "Process: Item 3", ... })
Task({ subagent_type: "general-purpose", description: "Process: Item 4", ... })
Task({ subagent_type: "general-purpose", description: "Process: Item 5", ... })
```

**EXCEPTION:** X/Twitter items must be sequential (single Chrome browser instance).

---

## Proposal Schema

```typescript
interface Proposal {
  // Core fields (all types)
  proposed_title: string;        // Meaningful, descriptive title
  proposed_template: "resource" | "meeting" | "capture";
  summary: string;               // 2-3 sentences capturing key value
  area: string;                  // Wikilink: "[[Area Name]]"
  project: string | null;        // Wikilink or null
  resourceType: string;          // article, video, thread, meeting, reference, idea

  // UX fields (for review table and "Deeper" option)
  categorization_hints: string[];  // 3 key points explaining categorization
  source_format: "article" | "video" | "audio" | "document" | "thread" | "image";
  confidence: "high" | "medium" | "low";  // Triggers "Deeper" when low
  notes: string | null;          // Special considerations for reviewer

  // Meeting-specific fields
  meeting_type?: "standup" | "1on1" | "planning" | "retro" | "workshop" | "general";
  meeting_date?: string;         // ISO date from recorded field
  attendees?: string[];          // ["[[Name]]", "Speaker 3"]
  meeting_notes?: string[];      // Key discussion points
  decisions?: string[];          // Decisions made
  action_items?: Array<{ assignee?: string; task: string; due?: string }>;
  follow_up?: string[];          // Next steps
}

interface TaskMetadata {
  file: string;            // Original inbox file path
  itemType: string;        // clipping, transcription, attachment
  sourceType: string;      // youtube, twitter, article, voice, attachment
  sourceUrl: string;       // Original URL
  proposal: Proposal | null;
}
```

---

## para_create Format

**CRITICAL:** Frontmatter-only approach. ALL data in `args`, NEVER in `content`.

### Why Frontmatter-Only?

The resource template uses Dataview to render frontmatter:
```markdown
## Summary
`= this.summary`
```

This means:
- `summary` frontmatter is rendered in the Summary section
- Users can search/filter on `summary` via Dataview
- Content injection (`content: {}`) breaks searchability

### Correct Format

```typescript
para_create({
  template: "resource",
  title: proposal.title,
  dest: "03 Resources",
  args: {
    summary: proposal.summary,           // Rendered by Dataview
    source: sourceUrl,                   // Original URL
    resource_type: proposal.resourceType,
    areas: proposal.area,                // "[[Area Name]]" - wikilink
    projects: proposal.project,          // "[[Project]]" or omit if null
    distilled: "false"                   // Always include
  }
  // ❌ NEVER use: content: { "Summary": "..." }
})
```

### Field Rules

| Field | Format | Required |
|-------|--------|----------|
| `summary` | Plain text, 2-3 sentences | Yes |
| `source` | URL or wikilink | Yes |
| `resource_type` | article, video, thread, etc. | Yes |
| `areas` | Wikilink: `"[[Name]]"` | Yes |
| `projects` | Wikilink or omit | No |
| `distilled` | `"false"` | Yes |

### Fields to NEVER Pass

| Field | Why Not |
|-------|---------|
| `content` parameter | Breaks Dataview rendering |
| `area` (singular) | Wrong field name - use `areas` |
| `project` (singular) | Wrong field name - use `projects` |
| `type` | Auto-set by template |

---

## Coordinator Responsibility

The coordinator (main agent) loads vault context ONCE in Phase 1:

```typescript
// Phase 1: Load vault context
const areas = await para_list_areas({ response_format: "json" });
const projects = await para_list_projects({ response_format: "json" });

// Phase 2: Pass to every subagent prompt
const prompt = `
  ## Vault Context
  ### Areas
  ${JSON.stringify(areas, null, 2)}
  ### Projects
  ${JSON.stringify(projects, null, 2)}
  ...
`;
```

**Why this matters:**
- 50 items × 2 tool calls = 100 tool calls saved
- Faster subagent execution (no round-trip to MCP)
- Consistent context across all subagents
- Coordinator context stays clean (no enriched content)

---

## Best Practices

1. **Subagents enrich their own content** - Keeps coordinator context clean
2. **Pass vault context from coordinator** - Saves tool calls
3. **Only use real areas/projects** - Never hallucinate names
4. **Persist immediately** - TaskUpdate right after analysis
5. **Return PROPOSAL_JSON** - Structured text for coordinator to parse
6. **Use haiku** - Fast, cheap, good enough for categorization
7. **X/Twitter is sequential** - Single Chrome browser instance
8. **Dual communication** - Both TaskUpdate (persistence) AND structured text (immediate use)
