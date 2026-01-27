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

    Based on the enriched content, create a proposal:

    - **title**: Meaningful, descriptive title (not the filename)
    - **summary**: 2-3 sentences capturing key value/insights
    - **area**: Wikilink to existing area [[Area Name]]
    - **project**: Wikilink to existing project, or null if none applies
    - **resourceType**: One of: article | video | thread | meeting | reference | tutorial

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

    ## Output

    After calling TaskUpdate, confirm:
    "Proposal saved for: [title]"
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
  title: string;           // Meaningful title
  summary: string;         // 2-3 sentences
  area: string;            // Wikilink: "[[Area Name]]"
  project: string | null;  // Wikilink or null
  resourceType: string;    // article, video, thread, meeting, reference, tutorial
}

interface TaskMetadata {
  file: string;            // Original inbox file path
  itemType: string;        // clipping, transcription, attachment
  sourceType: string;      // youtube, twitter, article, etc.
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
5. **Use haiku** - Fast, cheap, good enough for categorization
6. **Return confirmation** - "Proposal saved for: [title]"
7. **X/Twitter is sequential** - Single Chrome browser instance
