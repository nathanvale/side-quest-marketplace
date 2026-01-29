---
name: quick-create
description: Create a note from any URL with automatic template routing, enrichment, and content injection. Detects resource, meeting, invoice, and booking content automatically.
argument-hint: "<url> [--template resource|meeting|invoice|booking] [--area '[[Area]]'] [--project '[[Project]]'] [--title 'Title']"
user-invocable: true
allowed-tools: AskUserQuestion, ToolSearch, WebFetch, mcp__plugin_para-obsidian_para-obsidian__para_create, mcp__plugin_para-obsidian_para-obsidian__para_replace_section, mcp__plugin_para-obsidian_para-obsidian__para_commit, mcp__plugin_para-obsidian_para-obsidian__para_list_areas, mcp__plugin_para-obsidian_para-obsidian__para_list_projects, mcp__plugin_para-obsidian_para-obsidian__para_fm_set, mcp__firecrawl__firecrawl_scrape, mcp__youtube-transcript__get_video_info, mcp__youtube-transcript__get_transcript, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__take_snapshot
---

# Quick Create

Create a note from any URL in one invocation. Enriches content, classifies it, routes to the correct template (resource, meeting, invoice, booking), and commits to vault.

**Key design:** Runs inline (not as subagent), so it naturally has access to everything discussed in the current session. If you already fetched a YouTube transcript or scraped an article earlier in the conversation, reuse that content instead of fetching again.

## Input

Parse from skill arguments:

| Argument | Required | Example |
|----------|----------|---------|
| URL | Yes | `https://youtube.com/watch?v=abc123` |
| `--template` | No | `--template booking` (override auto-detection) |
| `--area` | No | `--area '[[🌱 AI Practice]]'` |
| `--project` | No | `--project '[[🎯 Claude Code Mastery]]'` |
| `--title` | No | `--title 'Custom Title Here'` |

## Workflow

### Phase 1: Input & Context

1. **Parse arguments** - Extract URL and optional flags (`--template`, `--area`, `--project`, `--title`)
2. **Check conversation context** - Before fetching, check if URL content already exists in the conversation (e.g., YouTube transcript already pulled, Firecrawl already scraped, user-provided notes). Use existing content first.
3. **Load vault context** if `--area` or `--project` not provided:

```
para_list_areas({ response_format: "json" })
para_list_projects({ response_format: "json" })
```

### Phase 2: Enrich

Follow the content-processing skill's enrichment routing (via @plugins/para-obsidian/skills/triage/references/enrichment-strategies.md).

**Select tool based on domain.** See @../triage/references/content-sourcing for full routing logic.

| Domain | Tool | Reference |
|--------|------|-----------|
| `x.com`, `twitter.com` | Chrome DevTools | @references/content-sourcing/x-twitter.md |
| `youtube.com`, `youtu.be` | YouTube Transcript MCP | @references/content-sourcing/youtube.md |
| Everything else | Firecrawl | @references/content-sourcing/firecrawl.md |

**Skip enrichment** if content already exists in conversation context.

**Fallback chain:** If Firecrawl fails or is unavailable, use `WebFetch` as fallback.

### Phase 3: Classify & Format

#### 3.1 Determine Template

If `--template` flag provided, use that value directly (skip auto-detection).

Otherwise, using @../para-classifier/references/classification-decision-tree.md, determine the `proposed_template`:

| Content Signal | Template |
|----------------|----------|
| Booking confirmation, reservation, ticket | `booking` |
| Invoice, receipt, bill, payment due | `invoice` |
| Meeting notes, standup, retro, 1:1 | `meeting` |
| Everything else (articles, videos, threads) | `resource` |

#### 3.2 Classify Content (template-specific)

**For resources:** Determine `resourceType` (article, video, thread, reference, idea), `source_format`, `author`, summary.

**For meetings:** Extract `meeting_type`, `meeting_date`, attendees, notes, decisions, action items, follow-up.

**For invoices:** Extract `provider`, `invoice_date`, `amount`, `currency`, `status`.

**For bookings:** Extract `booking_type`, `booking_ref`, `provider`, `booking_date`, `cost`, `currency`, `status`.

#### 3.3 Map Emoji Prefix (resources only)

Using @../para-classifier/references/emoji-mapping.md, determine the emoji prefix for the note title based on `source_format`:

| Source Format | Prefix |
|---------------|--------|
| video | `📺 ` |
| thread | `🧵 ` |
| article | (none - default resource) |
| document | `📄 ` |

Non-resource templates use their own naming conventions (no emoji prefix).

#### 3.4 Suggest Area & Project

If not provided via flags:
- Match content against available areas and projects
- Prefer the most specific match
- If no confident match, suggest the most likely candidate
- **Multiple areas:** When content clearly spans multiple domains (e.g., AI + Home Server), suggest multiple areas. Use AskUserQuestion with a multi-select option or "Both" choice.

**Format for `para_create` args:**
- Single area: `areas: "[[🌱 AI Practice]]"` (string)
- Multiple areas: `areas: '["[[🌱 AI Practice]]", "[[🌱 Home Server]]"]'` (JSON array string)

`para_create` parses JSON array strings automatically. Obsidian stores as proper YAML list:
```yaml
areas:
  - "[[🤖 AI Practice]]"
  - "[[🌱 Home Server]]"
```

#### 3.5 Format Layer 1 Content (resources only)

Follow the content-processing skill's Layer 1 formatting rules (see content-processing skill, "Layer 1 Injection" section).

### Phase 4: Propose & Confirm

Present a template-conditional proposal to the user:

**Resource proposal:**
```
Resource Proposal:
  Title:    [emoji] [proposed title]
  Type:     [resourceType] ([source_format])
  Area:     [[🌱 Area Name]]
  Project:  [[🎯 Project Name]] (or "none")
  Author:   [author or "unknown"]
  Summary:  [2-3 sentence summary]

Layer 1 preview:
  [first ~200 chars of formatted Layer 1 content...]

Accept / Edit / Cancel?
```

**Meeting proposal:**
```
Meeting Proposal:
  Title:      [proposed title]
  Type:       [meeting_type]
  Date:       [meeting_date]
  Area:       [[🌱 Area Name]]
  Project:    [[🎯 Project Name]] (or "none")
  Attendees:  [count] participants
  Summary:    [2-3 sentence summary]

Accept / Edit / Cancel?
```

**Invoice proposal:**
```
Invoice Proposal:
  Title:      [proposed title]
  Provider:   [provider]
  Date:       [invoice_date]
  Amount:     [amount] [currency]
  Status:     [status]
  Area:       [[🌱 Area Name]]
  Summary:    [2-3 sentence summary]

Accept / Edit / Cancel?
```

**Booking proposal:**
```
Booking Proposal:
  Title:      [proposed title]
  Type:       [booking_type]
  Provider:   [provider]
  Date:       [booking_date]
  Reference:  [booking_ref]
  Cost:       [cost] [currency] (or "not specified")
  Status:     [status]
  Area:       [[🌱 Area Name]]
  Summary:    [2-3 sentence summary]

Accept / Edit / Cancel?
```

Use AskUserQuestion with options:
- **Accept** - Create as proposed
- **Edit** - Let user modify fields before creation
- **Cancel** - Abort without creating anything

If user chooses **Edit**, ask which fields to change and re-present the updated proposal.

### Phase 5: Create & Commit

Follow the **content-processing** skill's generic pipeline. All templates use the same flow:

1. **Discover metadata** — `para_template_fields({ template: proposed_template })` to get `creation_meta` (dest, prefix, sections) and `validArgs`.
2. **Create note** — `para_create({ template, title, args })` with only valid fields from classification. Destination auto-resolved, invalid fields filtered.
3. **Commit** — `para_commit` immediately after creation.
4. **If resource** — Inject Layer 1 via `para_replace_section` into "Layer 1: Captured Notes", then commit again.
5. **If meeting** — Pass structured body via `content` parameter on `para_create` (attendees, notes, decisions, action items, follow-up).

**Omit** any args with null values (never pass `null`). See content-processing skill for null-safety rules.

**If injection fails (resources):** Continue without Layer 1. The resource still exists — user can add content later via `/para-obsidian:distill-resource`.

#### 5.1 Report Success

**Resource success:**
```
Created: 03 Resources/[Title].md
  Area:     [[🌱 Area Name]]
  Project:  [[🎯 Project Name]]
  Layer 1:  ✓ injected (or "⚠ skipped - [reason]")
  Commit:   ✓ committed (or "⚠ skipped - [reason]")

Use /para-obsidian:distill-resource to deepen with progressive summarization.
```

**Meeting success:**
```
Created: 03 Resources/Meetings/[Title].md
  Area:     [[🌱 Area Name]]
  Project:  [[🎯 Project Name]]
  Sections: ✓ populated (attendees, notes, decisions, action items, follow-up)
  Commit:   ✓ committed
```

**Invoice success:**
```
Created: 04 Archives/Invoices/[Title].md
  Provider: [provider]
  Amount:   [amount] [currency]
  Status:   [status]
  Commit:   ✓ committed
```

**Booking success:**
```
Created: 04 Archives/Bookings/[Title].md
  Provider: [provider]
  Date:     [booking_date]
  Ref:      [booking_ref]
  Commit:   ✓ committed
```

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

### URL from Conversation
```
User: [earlier in conversation, already scraped an article via Firecrawl]
User: /para-obsidian:quick-create https://already-scraped-url.com/article
→ Skill reuses existing content from conversation context
```
