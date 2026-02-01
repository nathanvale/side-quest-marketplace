---
name: clip
description: Inbox capture that matches Web Clipper output. Clips URLs or inline text as clipping notes with LLM-generated titles. Batch-capable for multiple URLs. No classification, no area/project assignment — triage handles that.
argument-hint: "<url1> [url2 url3 ...] or <inline text to capture>"
user-invocable: true
context: fork
allowed-tools: mcp__plugin_para-obsidian_para-obsidian__para_create, mcp__plugin_para-obsidian_para-obsidian__para_commit, mcp__plugin_para-obsidian_para-obsidian__para_template_fields, mcp__firecrawl__firecrawl_scrape, mcp__youtube-transcript__get_video_info
---

# Clip

Inbox capture that produces clipping notes matching Obsidian Web Clipper output — real page titles, raw fetched content, `<!-- highlights:0 -->` marker. No classification, no Layer 1 formatting, no area/project assignment. Everything gets organized later by `/para-obsidian:triage`.

**Design philosophy:** ADHD-friendly capture with Web Clipper parity. Save a link, get a real note — not a stub. Capture now, organize later.

---

## Step 0 — Discover Template Metadata

Before processing any input, query the clipping template for its current structure:

```
para_template_fields({ template: "clipping", response_format: "json" })
```

Extract from response:
- `validArgs` → which args to pass to `para_create` (e.g., `source`, `clipped`, `domain`)
- `creation_meta.dest` → destination folder (e.g., `"00 Inbox"`)
- `creation_meta.contentTargets` → which section heading accepts content injection (e.g., `["Content"]`)
- `creation_meta.titlePrefix` → emoji prefix (e.g., `"✂️ "`)

Use these discovered values throughout the skill instead of hardcoding them. If the template changes, this skill auto-adapts.

---

## Input Detection

Parse `$ARGUMENTS` to determine mode:

**Step 1:** Extract all URLs from arguments (regex: `https?://\S+`).

| Result | Mode |
|--------|------|
| 1+ URLs found | **URL mode** — create clipping notes |
| No URLs found | **Inline text mode** — create clipping note |

**Step 2:** Deduplicate URLs before processing (URL mode only).

---

## Mode 1: URL Capture (Clipping Notes)

For each URL, create a clipping note that triage recognizes as `itemType: "clipping"`.

### For each URL:

**Step 1 — Extract domain:**

Strip `www.` prefix from hostname:
```
github.com/anthropics/claude-code  →  domain: "github.com"
www.kentcdodds.com/blog/aha        →  domain: "kentcdodds.com"
```

**Step 2 — Fetch content:**

The clip skill should produce notes identical to what the Obsidian Web Clipper creates — including page content in the Content section. Fetch content for every URL.

| URL Pattern | Tool | Extract |
|-------------|------|---------|
| `youtube.com`, `youtu.be` | `get_video_info` + `firecrawl_scrape` | Title from video info, description + embed from Firecrawl |
| `x.com`, `twitter.com` | **Skip** (no tool available yet) | Use domain as title, empty content |
| Everything else | `firecrawl_scrape` | `metadata.title` + `markdown` body |

**YouTube URLs:**
```
get_video_info({ url: "<url>" })
→ extract title from response

firecrawl_scrape({ url: "<url>", formats: ["markdown"], onlyMainContent: true })
→ extract markdown as page content (video description, chapters, links)
```

Combine into content: video embed `![](url)` followed by the scraped description.

**General URLs (Firecrawl):**
```
firecrawl_scrape({
  url: "<url>",
  formats: ["markdown"],
  onlyMainContent: true
})
→ extract metadata.title as page title
→ extract markdown as page content
```

**X/Twitter URLs:** Skip fetching. Firecrawl is blocklisted for x.com. Use domain as title, no content. Future x-twitter plugin will handle this.

**If fetch fails:** Fall back to domain as title with empty content. Never block capture on fetch failure.

**Step 3 — Derive title:**

Use the **fetched page title** as the note title. If fetching was skipped or failed, fall back to domain-based title:
- Single `github.com` URL → title: `github.com`
- Two `github.com` URLs → titles: `github.com - anthropics`, `github.com - modelcontextprotocol`

For domain fallback, extract the slug from the first meaningful path segment (skip empty segments).

**Step 4 — Create clipping note:**

Use discovered values from Step 0 (`validArgs` for args, `creation_meta.dest` for dest, `creation_meta.contentTargets[0]` for content section heading):

```
para_create({
  template: "clipping",
  title: "<fetched-or-derived-title>",
  dest: "<discovered-dest>",
  args: {
    source: "<full-url>",
    clipped: "<YYYY-MM-DD>",
    domain: "<domain>"
  },
  content: {
    "<discovered-content-target>": "<fetched-content>\n\n<!-- highlights:0 -->"
  },
  response_format: "json"
})
```

The `content` parameter injects the fetched page content into the content target section discovered from `creation_meta.contentTargets`. The `<!-- highlights:0 -->` marker matches Web Clipper output format.

If no content was fetched (X/Twitter, or fetch failure), omit the `content` parameter entirely.

Process URLs sequentially — each fetch + `para_create` call completes before the next. Collect results for the report.

### After all URLs created:

**Step 5 — Batch commit:**

```
para_commit({
  message: "Clip: <N> URLs to inbox",
  response_format: "json"
})
```

One commit for all notes. Never commit per-note.

---

## Mode 2: Inline Text Capture

Capture free text from the conversation into a clipping note.

**Step 1 — Generate title:**

Generate a concise, descriptive title (under 60 characters) that captures the essence of the text. Use your judgment as an LLM — don't just truncate, summarize the core idea into a clear title.

**Step 2 — Create clipping note:**

```
para_create({
  template: "clipping",
  title: "<generated-title>",
  dest: "<discovered-dest>",
  args: {
    source: "conversation",
    clipped: "<YYYY-MM-DD>"
  },
  content: {
    "<discovered-content-target>": "<full-inline-text>\n\n<!-- highlights:0 -->"
  },
  response_format: "json"
})
```

The `content` parameter injects text into the content target section discovered from Step 0.

**Defaults:** `source: "conversation"`. Zero-friction capture — no enum choices required. Triage or manual review can adjust later.

**Step 3 — Commit:**

```
para_commit({
  message: "Clip: <title>",
  response_format: "json"
})
```

---

## Reporting

**URL mode (batch):**
```
Clipped N URLs to inbox:

  1. ✂️ AHA Programming             ← kentcdodds.com/blog/aha-programming
  2. ✂️ Claude Code                  ← github.com/anthropics/claude-code
  3. ✂️ x.com                        ← x.com/housecor/status/123456 (no content — X not supported yet)

Committed. Run /para-obsidian:triage to classify.
```

**URL mode (single):**
```
Clipped: ✂️ AHA Programming → 00 Inbox/✂️ AHA Programming.md
Committed. Run /para-obsidian:triage to classify.
```

**Inline mode:**
```
Clipped: <title> → 00 Inbox/<title>.md
Committed. Run /para-obsidian:triage to process.
```

---

## Error Handling

| Scenario | Action |
|----------|--------|
| Empty arguments | Report: "Nothing to clip. Pass URLs or text to capture." |
| Invalid URL (parse fails) | Skip that URL, report as warning, continue with remaining |
| Content fetch fails | Fall back to domain title + empty body. Report warning, continue. |
| `para_create` fails for one URL | Log error, continue with remaining URLs |
| All URLs fail | Report all failures, create nothing |
| `para_commit` fails | Report warning — notes still exist uncommitted |
| Duplicate URL in batch | Deduplicate before processing |
| Filename collision | `para_create` handles this automatically (appends number) |

**Soft failure philosophy:** Never block on individual failures in batch mode. Create what you can, report what failed. Fetch failures degrade gracefully to domain-only stubs.

---

## What This Does NOT Do

- **No classification** — triage determines area/project/template
- **No Layer 1 formatting** — triage handles content distillation
- **No user prompts** — zero gates, zero decisions
- **No area/project assignment** — triage handles this
- **No X/Twitter content** — future x-twitter plugin will handle this

---

## Triage Compatibility

Notes created by this skill are fully compatible with `/para-obsidian:triage`:

| Mode | `type` field | Triage detection | Triage action |
|------|-------------|------------------|---------------|
| URL | `clipping` | `type === "clipping"` + source is URL | Routes to `analyze-web` worker for classification |
| Inline text | `clipping` | `type === "clipping"` + source is NOT URL | Stays in inbox (manual review items) |

Clipping notes with fetched content give triage a head start — it can classify from the content already present rather than re-fetching.

---

## Examples

### Single URL
```
/para-obsidian:clip https://kentcdodds.com/blog/aha-programming
```
Creates: `00 Inbox/✂️ AHA Programming.md` (with full article content)

### Batch URLs
```
/para-obsidian:clip https://github.com/anthropics/claude-code https://youtube.com/watch?v=abc123 https://kentcdodds.com/blog/aha-programming
```
Creates 3 notes in `00 Inbox/` with fetched titles and content, commits all at once.

### YouTube URL
```
/para-obsidian:clip https://www.youtube.com/watch?v=dQw4w9WgXcQ
```
Creates: `00 Inbox/✂️ <Video Title>.md` (title only, no transcript — triage fetches that)

### Inline capture (mid-conversation insight)
```
/para-obsidian:clip The key insight is that Layer 1 captures raw content, Layer 2 bolds the most important 10-20%, and Layer 3 highlights the top 10% of bold passages.
```
Creates: `00 Inbox/Progressive Summarization Layer Strategy.md` (LLM-generated title)

### Inline capture (quick thought)
```
/para-obsidian:clip Check if React Server Components solve the waterfall problem for GMS checkout flow
```
Creates: `00 Inbox/RSC for GMS Checkout Waterfall Problem.md` (LLM-generated title)

---

## Completion Signal

After reporting results, emit a structured completion signal so the brain orchestrator can parse the outcome:

- **URL mode (batch):** `SKILL_RESULT:{"status":"ok","skill":"clip","summary":"Clipped N URLs to inbox"}`
- **URL mode (partial failures):** `SKILL_RESULT:{"status":"partial","skill":"clip","clipped":N,"failed":M}`
- **Inline mode:** `SKILL_RESULT:{"status":"ok","skill":"clip","summary":"Clipped inline text to inbox"}`
- **All failed:** `SKILL_RESULT:{"status":"error","skill":"clip","error":"All URLs failed to clip"}`
- **Empty args:** `SKILL_RESULT:{"status":"error","skill":"clip","error":"Nothing to clip"}`
