---
name: clip
description: Zero-friction inbox capture. Clips URLs as clipping notes or inline text as capture notes. No enrichment, no classification, no user prompts. Batch-capable for multiple URLs. Use when saving links for later triage, or capturing mid-conversation insights.
argument-hint: "<url1> [url2 url3 ...] or <inline text to capture>"
user-invocable: true
context: fork
allowed-tools: mcp__plugin_para-obsidian_para-obsidian__para_create, mcp__plugin_para-obsidian_para-obsidian__para_commit
---

# Clip

Zero-friction inbox capture. Dumps URLs or text into `00 Inbox/` with no enrichment, no classification, no user prompts. Everything gets processed later by `/para-obsidian:triage`.

**Design philosophy:** ADHD-friendly capture. The moment you think "save this for later," it should be done in seconds. No decisions, no gates, no enrichment overhead. Capture now, organize later.

---

## Input Detection

Parse `$ARGUMENTS` to determine mode:

**Step 1:** Extract all URLs from arguments (regex: `https?://\S+`).

| Result | Mode |
|--------|------|
| 1+ URLs found | **URL mode** — create clipping notes |
| No URLs found | **Inline text mode** — create capture note |

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

**Step 2 — Derive title:**

Use domain as the title. If multiple URLs share the same domain in this batch, append a path slug for disambiguation:
- Single `github.com` URL → title: `github.com`
- Two `github.com` URLs → titles: `github.com - anthropics`, `github.com - modelcontextprotocol`

Extract the slug from the first meaningful path segment (skip empty segments).

**Step 3 — Create clipping note:**

```
para_create({
  template: "clipping",
  title: "<derived-title>",
  dest: "00 Inbox",
  args: {
    source: "<full-url>",
    clipped: "<YYYY-MM-DD>",
    clipping_type: "article"
  },
  response_format: "json"
})
```

**Why `clipping`:** There is one unified clipping template. Triage reclassifies from scratch using the `source` URL — the initial `clipping_type: article` is a harmless default that gets overwritten during enrichment. The critical fields for triage detection are `type: clipping` and `source: <url>`.

**DO NOT fetch page titles.** That adds latency per URL and requires enrichment tools. For a batch of 10, that's significant overhead. Triage fetches titles during enrichment. Speed wins.

Process URLs sequentially — each `para_create` call completes before the next. Collect results for the report.

### After all URLs created:

**Step 4 — Batch commit:**

```
para_commit({
  message: "Clip: <N> URLs to inbox",
  response_format: "json"
})
```

One commit for all notes. Never commit per-note.

---

## Mode 2: Inline Text Capture

Capture free text from the conversation into a capture note.

**Step 1 — Generate title:**

Derive a short descriptive title from the first ~60 characters of the text. Truncate at a word boundary. If the text is under 60 characters, use the full text as the title.

**Step 2 — Create capture note:**

```
para_create({
  template: "capture",
  title: "<derived-title>",
  dest: "00 Inbox",
  args: {
    source: "conversation",
    resonance: "useful",
    urgency: "low"
  },
  content: {
    "Capture": "<full-inline-text>"
  },
  response_format: "json"
})
```

The `content` parameter injects text into the "Capture" section of the capture template.

**Defaults:** `source: "conversation"`, `resonance: "useful"`, `urgency: "low"`. Sensible defaults for mid-conversation captures. Triage or manual review can adjust later.

**Step 3 — Commit:**

```
para_commit({
  message: "Capture: <title>",
  response_format: "json"
})
```

---

## Reporting

**URL mode (batch):**
```
Clipped N URLs to inbox:

  1. ✂️📰 github.com             ← github.com/anthropics/claude-code
  2. ✂️📰 youtube.com            ← youtube.com/watch?v=abc123
  3. ✂️📰 kentcdodds.com         ← kentcdodds.com/blog/aha-programming

Committed. Run /para-obsidian:triage to enrich and classify.
```

**URL mode (single):**
```
Clipped: ✂️📰 kentcdodds.com → 00 Inbox/✂️📰 kentcdodds.com.md
Committed. Run /para-obsidian:triage to enrich and classify.
```

**Inline mode:**
```
Captured: <title> → 00 Inbox/<title>.md
Committed. Run /para-obsidian:triage to process.
```

---

## Error Handling

| Scenario | Action |
|----------|--------|
| Empty arguments | Report: "Nothing to clip. Pass URLs or text to capture." |
| Invalid URL (parse fails) | Skip that URL, report as warning, continue with remaining |
| `para_create` fails for one URL | Log error, continue with remaining URLs |
| All URLs fail | Report all failures, create nothing |
| `para_commit` fails | Report warning — notes still exist uncommitted |
| Duplicate URL in batch | Deduplicate before processing |
| Filename collision | `para_create` handles this automatically (appends number) |

**Soft failure philosophy:** Never block on individual failures in batch mode. Create what you can, report what failed.

---

## What This Does NOT Do

- **No content fetching** — triage handles enrichment
- **No classification** — triage determines area/project/template
- **No user prompts** — zero gates, zero decisions
- **No title fetching** — domain is enough for inbox items
- **No area/project assignment** — triage handles this
- **No `<!-- highlights:0 -->` marker** — this is not the Web Clipper

---

## Triage Compatibility

Notes created by this skill are fully compatible with `/para-obsidian:triage`:

| Mode | `type` field | Triage detection | Triage action |
|------|-------------|------------------|---------------|
| URL | `clipping` | `type === "clipping"` | Routes to `analyze-web` worker for enrichment + classification |
| Inline text | `capture` | `type === "capture"` | Stays in inbox (captures are manual review items) |

---

## Examples

### Single URL
```
/para-obsidian:clip https://kentcdodds.com/blog/aha-programming
```
Creates: `00 Inbox/✂️📰 kentcdodds.com.md`

### Batch URLs
```
/para-obsidian:clip https://github.com/anthropics/claude-code https://youtube.com/watch?v=abc123 https://x.com/housecor/status/123456 https://kentcdodds.com/blog/aha-programming
```
Creates 4 notes in `00 Inbox/`, commits all at once.

### Inline capture (mid-conversation insight)
```
/para-obsidian:clip The key insight is that Layer 1 captures raw content, Layer 2 bolds the most important 10-20%, and Layer 3 highlights the top 10% of bold passages.
```
Creates: `00 Inbox/The key insight is that Layer 1 captures raw content.md`

### Inline capture (quick thought)
```
/para-obsidian:clip Check if React Server Components solve the waterfall problem for GMS checkout flow
```
Creates: `00 Inbox/Check if React Server Components solve the waterfall.md`
