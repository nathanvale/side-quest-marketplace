# Twitter/X.com Handler

Process `twitter.com` or `x.com` URLs into clipping notes.

## Step 0 — Discover Template Metadata

Before creating notes, query the tweet template for its current structure:

```
para_template_fields({ template: "tweet---x-post", response_format: "json" })
```

Extract from response:
- `validArgs` → which args to pass (e.g., `source`, `clipped`, `author`, `handle`, `posted`, `ai_summary`, `topics`, `sentiment`)
- `creation_meta.dest` → destination folder
- `creation_meta.contentTargets` → section headings for content injection
- `creation_meta.sections` → all body section headings

Use these discovered values instead of hardcoding them.

## Extraction Challenge

**X requires JavaScript** - Firecrawl and WebFetch cannot scrape X.com directly.

### Approach 1: Chrome DevTools MCP (Preferred)

```
1. mcp__chrome-devtools__navigate_page({ url: "https://x.com/..." })
2. mcp__chrome-devtools__take_snapshot() - Get page content
3. mcp__chrome-devtools__evaluate_script() - Extract specific fields
```

### Approach 2: URL Parsing (Fallback)

If Chrome DevTools unavailable, parse URL for basic info:
- Username from path: `x.com/{username}/status/{id}`
- Tweet ID from path

Then ask user to provide the tweet content manually.

## Fields to Extract

| Field | Source | Example |
|-------|--------|---------|
| `author` | Display name | "Matt Pocock" |
| `handle` | @username | "@mattpocockuk" |
| `posted` | Post date | "2026-01-09" |
| `content` | Full text | Tweet or X Article body |

## AI-Generated Fields

Generate these from the scraped content:

- **ai_summary**: "In 10 words or less, what is the key point?"
- **topics**: "2-3 topic tags as comma-separated list"
- **sentiment**: "positive, negative, neutral, or controversial"

## Note Creation

Use discovered values from Step 0 (`creation_meta.dest` for dest, `creation_meta.contentTargets` for section headings, `validArgs` for field names):

```
para_create({
  template: "tweet---x-post",
  title: "{Author} - {AI-generated 3-6 word topic}",
  dest: "<discovered-dest>",
  content: {
    "<discovered-content-target>": "[Full post text]",
    "<discovered-ai-summary-section>": "> [Generated summary]"
  },
  response_format: "json"
})
```

Then set frontmatter (use only fields from `validArgs`):
```
para_fm_set({
  file: "<discovered-dest>/...",
  set: {
    source: "https://x.com/...",
    author: "Matt Pocock",
    handle: "@mattpocockuk",
    posted: "2026-01-09",
    ai_summary: "AI coding agent loops using Ralph",
    topics: "AI, programming, automation",
    sentiment: "positive"
  }
})
```

## Note Naming

`{Author} - {AI-generated 3-6 word topic summary}`

Generate a unique title from content to prevent filename collisions.

## Template Output

```markdown
---
type: clipping
resource_type: tweet
source: "https://x.com/mattpocockuk/status/123456789"
clipped: 2026-01-09
author: Matt Pocock
handle: "@mattpocockuk"
posted: 2026-01-09
ai_summary: AI coding agent loops using Ralph and Claude
topics: AI, programming, automation
sentiment: positive
---

# Matt Pocock - AI Coding Agents With Ralph

## AI Summary

> This post introduces Ralph, a technique for running AI coding agents iteratively...

---

**Author:** Matt Pocock (@mattpocockuk)
**Posted:** 2026-01-09
**Clipped:** 2026-01-09
**Link:** [View on X](https://x.com/mattpocockuk/status/123456789)

## Content

[Full post content]

## My Notes


```
