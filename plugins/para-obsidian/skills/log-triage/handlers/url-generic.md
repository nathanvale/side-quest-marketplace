# Generic URL Handler

Process URLs that don't match specific handlers (Twitter, YouTube, etc.).

## Step 0 — Discover Template Metadata

After selecting a template from the mapping table below, query it for its current structure:

```
para_template_fields({ template: "<matched-template-name>", response_format: "json" })
```

Extract from response:
- `validArgs` → which args to pass to `para_create`
- `creation_meta.dest` → destination folder
- `creation_meta.contentTargets` → section headings for content injection
- `creation_meta.sections` → all body section headings

Use these discovered values for note creation instead of hardcoding section names or destinations.

## URL → Clipping Type Mapping

| Domain/Path Pattern | Template | Notes |
|---------------------|----------|-------|
| `github.com/{owner}/{repo}` | `github-repo.md` | Owner, repo from path |
| `*.atlassian.net/wiki/` | `documentation.md` | May need auth |
| `docs.*`, `developer.*` | `documentation.md` | Path segments |
| `medium.com`, `substack.com` | `article.md` | Blog/newsletter |
| `reddit.com/r/{sub}/comments/` | `reddit-post.md` | Subreddit, post |
| `stackoverflow.com/questions/` | `stack-overflow.md` | Question ID |
| `en.wikipedia.org/wiki/` | `wikipedia.md` | Article title |
| `goodreads.com/book/` | `book.md` | Book title |
| `imdb.com/title/` | `movie.md` | Movie title |
| `spotify.com/episode/` | `podcast-episode.md` | Episode |
| `udemy.com`, `coursera.org` | `course---tutorial.md` | Course |
| `amazon.com` | `product---gift-idea.md` | Product |
| `airbnb.com`, `booking.com` | `accommodation.md` | Listing |
| `yelp.com` | `restaurant.md` | Restaurant |
| `eventbrite.com`, `meetup.com` | `event.md` | Event |
| `maps.google.com` | `place.md` | Place |
| `chatgpt.com/share/` | `chatgpt-conversation.md` | Chat |
| `claude.ai/share/` | `claude-conversation.md` | Chat |
| `apps.apple.com` | `app---software.md` | App |
| *Default* | `article.md` | Best guess |

## Extraction Process

**Step 1: Try Firecrawl**

```
mcp__firecrawl__firecrawl_scrape({
  url: "https://example.com/article",
  formats: ["markdown"]
})
```

**Step 2: Extract fields from response**

- Title (from `<title>` or `<h1>`)
- Author (from meta tags or byline)
- Published date
- Domain
- Summary (first paragraph or meta description)
- Full content

**Step 3: If Firecrawl fails**

Parse URL for basic info:
- Domain from URL
- Title from path segments (decode URL encoding)
- Note that content requires authentication

## Note Creation

Use discovered values from Step 0 (`creation_meta.dest` for dest, `creation_meta.contentTargets` or `creation_meta.sections` for section headings, `validArgs` for field names):

```
para_create({
  template: "<matched-template>",
  title: "[Extracted Title]",
  dest: "<discovered-dest>",
  content: {
    "<discovered-ai-summary-section>": "> - Key point 1\n> - Key point 2\n> - Key point 3",
    "<discovered-content-section>": "[Content from Firecrawl, truncated to 15000 chars]"
  },
  response_format: "json"
})
```

Use fields from `validArgs` discovered in Step 0:

```
para_fm_set({
  file: "<discovered-dest>/...",
  set: {
    source: "https://...",
    author: "John Smith",
    published: "2026-01-05",
    domain: "example.com"
  }
})
```

## Fallback Example (Auth Required)

URL: `https://bunnings.atlassian.net/wiki/spaces/POS/pages/123/Onboarding+Plan`

Parsed:
- Domain: `bunnings.atlassian.net` → type: documentation
- Space: POS (from path)
- Title: "Onboarding Plan" (from last segment, decoded)

```markdown
---
type: clipping
resource_type: documentation
source: "https://bunnings.atlassian.net/wiki/..."
clipped: 2026-01-06
domain: "bunnings.atlassian.net"
area: "[[Career & Contracting]]"
---

# Onboarding Plan

## AI Summary

> Confluence documentation page (POS space). Content requires authentication.

---

**Source:** [bunnings.atlassian.net](https://...)

---

## Why I Saved This


```
