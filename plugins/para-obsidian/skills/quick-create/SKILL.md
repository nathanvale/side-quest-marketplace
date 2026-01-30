---
name: quick-create
description: Create a note from any URL with automatic template routing, enrichment, and content injection. Detects resource, meeting, invoice, and booking content automatically.
argument-hint: "<url> [--template resource|meeting|invoice|booking] [--area '[[Area]]'] [--project '[[Project]]'] [--title 'Title']"
user-invocable: true
context: fork
allowed-tools: AskUserQuestion, ToolSearch, WebFetch, mcp__plugin_para-obsidian_para-obsidian__para_create, mcp__plugin_para-obsidian_para-obsidian__para_replace_section, mcp__plugin_para-obsidian_para-obsidian__para_commit, mcp__plugin_para-obsidian_para-obsidian__para_list_areas, mcp__plugin_para-obsidian_para-obsidian__para_list_projects, mcp__plugin_para-obsidian_para-obsidian__para_fm_set, mcp__plugin_para-obsidian_para-obsidian__para_template_fields, mcp__firecrawl__firecrawl_scrape, mcp__youtube-transcript__get_video_info, mcp__youtube-transcript__get_transcript, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__take_snapshot
---

# Quick Create

Create a note from any URL in one invocation. Enriches content, classifies it, routes to the correct template (resource, meeting, invoice, booking), and commits to vault.

**Key design:** Runs in a forked subagent for execution fidelity. The URL contains everything needed — the subagent fetches content fresh. This ensures all workflow phases (especially area/project gates) are followed as the driving task, not advisory context.

## Input

Parse from skill arguments:

| Argument | Required | Example |
|----------|----------|---------|
| URL | Yes | `https://youtube.com/watch?v=abc123` |
| `--template` | No | `--template booking` (override auto-detection) |
| `--area` | No | `--area '[[🌱 AI Practice]]'` |
| `--project` | No | `--project '[[🎯 Claude Code Mastery]]'` |
| `--title` | No | `--title 'Custom Title Here'` |

## Shared Skills (Reference Knowledge)

This skill delegates to canonical shared skills rather than duplicating logic:

| Skill | Purpose | Reference |
|-------|---------|-----------|
| **Enrichment routing** | Tool selection by URL domain | @../triage/references/enrichment-strategies.md |
| **Classification** | Template, area, resourceType decision tree | @../para-classifier/references/classification-decision-tree.md |
| **Emoji mapping** | source_format → title prefix (auto-applied by `para_create`, do NOT add manually) | @../para-classifier/references/emoji-mapping.md |
| **Content processing** | Create → commit → inject → commit pipeline | @../content-processing/SKILL.md |
| **Proposal schema** | Canonical field names and types | @../triage/references/proposal-schema.md |

---

## Workflow

### Phase 1: Initialize

**Step 1 — Load vault context (ALWAYS, before anything else):**

```
para_list_areas({ response_format: "json" })
para_list_projects({ response_format: "json" })
```

Store the full lists. These are needed for classification validation, proposal display, and the Edit flow. Load them even if `--area` or `--project` flags are provided — flags still need validation against the vault.

**Step 2 — Parse arguments:** Extract URL and optional flags (`--template`, `--area`, `--project`, `--title`).

### Phase 2: Enrich

Follow the enrichment routing from @../triage/references/enrichment-strategies.md.

**Select tool based on URL domain:**

| Domain | Tool |
|--------|------|
| `youtube.com`, `youtu.be` | YouTube Transcript MCP (`get_video_info` + `get_transcript`) |
| `x.com`, `twitter.com` | Chrome DevTools (`navigate_page` + `take_snapshot`) |
| Everything else | Firecrawl (`firecrawl_scrape`) |

**Fallback chain:** If Firecrawl fails or is unavailable, use `WebFetch` as fallback.

### Phase 3: Classify & Propose

This phase combines classification with proposal presentation. The user gate (AskUserQuestion) fires at the end — nothing is created until the user approves.

#### 3.1 Determine Template

If `--template` flag provided, use that value directly (skip auto-detection).

Otherwise, use @../para-classifier/references/classification-decision-tree.md to determine `proposed_template`:

| Content Signal | Template |
|----------------|----------|
| Booking confirmation, reservation, ticket | `booking` |
| Invoice, receipt, bill, payment due | `invoice` |
| Meeting notes, standup, retro, 1:1 | `meeting` |
| Everything else (articles, videos, threads) | `resource` |

#### 3.2 Classify Content

Use the classification decision tree to extract template-specific fields.

**For resources:** `resourceType` (article, video, thread, reference, idea), `source_format`, `author`, summary.

**For meetings:** `meeting_type`, `meeting_date`, attendees, notes, decisions, action items, follow-up.

**For invoices:** `provider`, `invoice_date`, `amount`, `currency`, `status`.

**For bookings:** `booking_type`, `booking_ref`, `provider`, `booking_date`, `cost`, `currency`, `status`.

#### 3.3 Title — NO Emoji Prefix

**NEVER add emoji prefixes to the title.** `para_create` automatically applies the correct emoji prefix via `applyTitlePrefix()` using the template type and `source_format` frontmatter field. Adding emojis manually causes double-prefixing (e.g., `📚 📚📰 Title`).

Pass a plain, descriptive title:
- Good: `"The Task Tool - Claude Code's Agent Orchestration System"`
- Bad: `"📚📰 The Task Tool - Claude Code's Agent Orchestration System"`

The code handles: base prefix (`📚` for resources) + source_format emoji (`📰` for article, `🎬` for video, etc.) automatically.

#### 3.4 Suggest Area & Project (REQUIRED — NEVER EMPTY)

**You MUST populate area before presenting the proposal. NEVER present a proposal with empty areas.**

If `--area` flag provided, use that value (still validate it exists in the loaded areas list).

If not provided via flags:
1. Match content against the areas and projects loaded in Phase 1
2. Prefer the most specific match
3. **Multiple areas:** When content clearly spans multiple domains (e.g., AI + Home Server), suggest multiple areas as an array
4. Assign `confidence` level: `"high"` (obvious match), `"medium"` (reasonable guess), `"low"` (ambiguous)

**If no confident match is found:** Use `AskUserQuestion` immediately to ask the user to select from the loaded areas list. Do NOT proceed with empty areas.

```
AskUserQuestion({
  questions: [{
    question: "Which area does this content belong to?",
    header: "Area",
    options: [
      // Populate from para_list_areas results
      { label: "🤖 AI Practice", description: "AI and machine learning content" },
      { label: "🌱 Home Server", description: "Home infrastructure and self-hosting" },
      // ... more areas from vault
    ],
    multiSelect: true  // Allow multiple areas when content spans domains
  }]
})
```

**Format for `para_create` args:**
- Single area: `areas: "[[🌱 AI Practice]]"` (string)
- Multiple areas: `areas: '["[[🌱 AI Practice]]", "[[🌱 Home Server]]"]'` (JSON array string)

`para_create` parses JSON array strings automatically via `tryParseJsonArray()`.

#### 3.5 Format Layer 1 Content (resources only)

For resources, prepare the Layer 1 content now so it can be previewed in the proposal and injected in Phase 4. Follow the content-processing skill's Layer 1 formatting rules:

- Use `####` headings or deeper (never `#`, `##`, `###`)
- Articles: first 3 paragraphs + key headings with topic sentences + conclusion (2-3k tokens)
- YouTube: ~10% sampled transcript segments with timestamps (2-3k tokens)
- Threads: full thread content in order

#### 3.6 Build Proposal (canonical schema)

Build the proposal using the canonical schema from @../triage/references/proposal-schema.md:

```typescript
{
  proposed_title: string,           // Plain title — NO emoji prefix (para_create adds it)
  proposed_template: "resource" | "meeting" | "invoice" | "booking",
  summary: string,                  // 2-3 sentences
  area: string | string[],         // "[[Area]]" or ["[[Area 1]]", "[[Area 2]]"]
  project: string | string[] | null, // "[[Project]]", ["[[P1]]", "[[P2]]"], or null
  resourceType: string,            // article, video, thread, etc.
  source_format: string,           // article, video, thread, document
  confidence: "high" | "medium" | "low",
  categorization_hints: string[],  // 3 bullet points explaining why this area/template
  notes: string | null,            // Special considerations (null if none)
}
```

**Note:** Quick-create always classifies URL input into a specific template (resource, meeting, invoice, booking). For quick text captures without classification, use `/para-obsidian:clip` instead.

#### 3.7 Present Proposal & Gate

**STOP — Validate before presenting:**
- `area` is populated (at least one area selected or suggested)
- `title` is populated
- `summary` is populated

If any field is missing, go back to the relevant step. Never present a proposal with empty areas.

Present the proposal, then use `AskUserQuestion` to gate:

**Resource proposal:**
```
Resource Proposal:
  Title:       [proposed title] (emoji auto-applied by para_create)
  Type:        [resourceType] ([source_format])
  Area:        [[🌱 Area Name]] (or multiple: [[A]], [[B]])
  Project:     [[🎯 Project Name]] (or "none")
  Author:      [author or "unknown"]
  Confidence:  [high|medium|low]
  Summary:     [2-3 sentence summary]
  Why:         • [categorization_hint_1]
               • [categorization_hint_2]
               • [categorization_hint_3]

Layer 1 preview:
  [first ~200 chars of formatted Layer 1 content...]
```

**Meeting proposal:**
```
Meeting Proposal:
  Title:       [proposed title]
  Type:        [meeting_type]
  Date:        [meeting_date]
  Area:        [[🌱 Area Name]]
  Project:     [[🎯 Project Name]] (or "none")
  Attendees:   [count] participants
  Confidence:  [high|medium|low]
  Summary:     [2-3 sentence summary]
  Why:         • [hint_1] • [hint_2] • [hint_3]
```

**Invoice proposal:**
```
Invoice Proposal:
  Title:       [proposed title]
  Provider:    [provider]
  Date:        [invoice_date]
  Amount:      [amount] [currency]
  Status:      [status]
  Area:        [[🌱 Area Name]]
  Confidence:  [high|medium|low]
  Summary:     [2-3 sentence summary]
  Why:         • [hint_1] • [hint_2] • [hint_3]
```

**Booking proposal:**
```
Booking Proposal:
  Title:       [proposed title]
  Type:        [booking_type]
  Provider:    [provider]
  Date:        [booking_date]
  Reference:   [booking_ref]
  Cost:        [cost] [currency] (or "not specified")
  Status:      [status]
  Area:        [[🌱 Area Name]]
  Confidence:  [high|medium|low]
  Summary:     [2-3 sentence summary]
  Why:         • [hint_1] • [hint_2] • [hint_3]
```

**Gate — AskUserQuestion (REQUIRED):**

```
AskUserQuestion({
  questions: [{
    question: "How would you like to proceed with this proposal?",
    header: "Action",
    options: [
      { label: "Accept", description: "Create the note as proposed" },
      { label: "Edit", description: "Modify area, project, title, or template before creation" },
      { label: "Cancel", description: "Abort without creating anything" }
    ],
    multiSelect: false
  }]
})
```

**If user picks Edit:** Ask which field to change using `AskUserQuestion`. Show available options (areas list from Phase 1, projects list, templates). Update the proposal fields, then re-present the proposal and gate again.

**If user picks Cancel:** Exit cleanly. Report "Cancelled — no changes made."

**If user picks Accept:** Proceed to Phase 4.

### Phase 4: Create & Commit

Follow the **content-processing** skill pipeline (@../content-processing/SKILL.md). All templates use the same flow:

1. **Discover metadata** — `para_template_fields({ template: proposed_template, response_format: "json" })` to get `creation_meta` (dest, prefix, sections) and `validArgs`.
2. **Create note** — `para_create({ template, title, args, response_format: "json" })` with only valid fields from classification. Destination auto-resolved, invalid fields filtered.
3. **Commit** — `para_commit({ message: "Add [template]: [title]", response_format: "json" })` immediately after creation.
4. **If resource** — Inject Layer 1 via `para_replace_section` into "Layer 1: Captured Notes", then commit again with `"Add Layer 1: [title]"`.
5. **If meeting** — Pass structured body via `content` parameter on `para_create` (attendees, notes, decisions, action items, follow-up). See content-processing skill for the exact format.

**Null-safety:** Omit any args with null values (never pass `null`). See content-processing skill for null-safety rules.

**If injection fails (resources):** Continue without Layer 1. The resource still exists — user can add content later via `/para-obsidian:distill-resource`.

#### Success Report

Report with canonical status fields (`created`, `layer1_injected`):

**Resource success:**
```
Created: 03 Resources/[Title].md
  Area:          [[🌱 Area Name]] (or multiple areas)
  Project:       [[🎯 Project Name]]
  Confidence:    [high|medium|low]
  Layer 1:       ✓ injected (or "⚠ skipped - [reason]")
  Commit:        ✓ committed (or "⚠ skipped - [reason]")

Use /para-obsidian:distill-resource to deepen with progressive summarization.
```

**Meeting success:**
```
Created: 03 Resources/Meetings/[Title].md
  Area:          [[🌱 Area Name]]
  Project:       [[🎯 Project Name]]
  Sections:      ✓ populated (attendees, notes, decisions, action items, follow-up)
  Commit:        ✓ committed
```

**Invoice success:**
```
Created: 04 Archives/Invoices/[Title].md
  Provider:      [provider]
  Amount:        [amount] [currency]
  Status:        [status]
  Commit:        ✓ committed
```

**Booking success:**
```
Created: 04 Archives/Bookings/[Title].md
  Provider:      [provider]
  Date:          [booking_date]
  Ref:           [booking_ref]
  Commit:        ✓ committed
```

---

## Error Handling

| Scenario | Action |
|----------|--------|
| URL unreachable | Try fallback chain (Firecrawl → WebFetch). If all fail, report error. |
| Content empty/unparseable | Report to user, suggest `/para-obsidian:clip` as fallback |
| `para_create` fails | Report error, do not proceed |
| `para_replace_section` fails | Set Layer 1 status to skipped, continue with commit |
| `para_commit` fails | Note in report, note still exists |
| User cancels | Clean exit, no changes made |

**Soft failure philosophy:** Note creation is primary. Layer 1 injection and commit are enhancements. Don't block note creation if downstream steps fail.

## Examples

### YouTube Video
```
/para-obsidian:quick-create https://www.youtube.com/watch?v=ey4u7OUAF3c
```

### Article with Flags
```
/para-obsidian:quick-create https://kentcdodds.com/blog/aha-programming --area '[[🌱 AI Practice]]' --title 'AHA Programming'
```

### X/Twitter Thread
```
/para-obsidian:quick-create https://x.com/housecor/status/1234567890
```

### Booking Confirmation
```
/para-obsidian:quick-create https://booking-confirmation.example.com/abc123 --template booking
```

### Force Template Override
```
/para-obsidian:quick-create https://some-url.com/page --template invoice --area '[[🏠 Personal Finance]]'
```
