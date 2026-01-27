# Enrichment Strategies

Domain-specific content fetching for clipping distillation.

## Content Sourcing Reference

For detailed tool selection and patterns, see the shared content sourcing documentation:

- **URL Routing:** @plugins/para-obsidian/references/content-sourcing/url-routing.md
- **YouTube:** @plugins/para-obsidian/references/content-sourcing/youtube.md
- **X/Twitter:** @plugins/para-obsidian/references/content-sourcing/x-twitter.md
- **Firecrawl:** @plugins/para-obsidian/references/content-sourcing/firecrawl.md

---

## Quick Reference

| Domain Pattern | Tool | Why | Fallback |
|----------------|------|-----|----------|
| `x.com`, `twitter.com` | **Chrome DevTools** | Firecrawl is BLOCKED | Ask user |
| `youtube.com`, `youtu.be` | **YouTube Transcript MCP** | Specialized API | Use description |
| Everything else | **Firecrawl** | General scraping | WebFetch |

### NEVER Do This

- **NEVER** use Firecrawl for x.com or twitter.com URLs - it returns "website not supported"
- **NEVER** skip Chrome DevTools and go straight to Firecrawl for Twitter
- **NEVER** assume a tool is unavailable without trying it first

---

## Content Extraction Patterns

After fetching, extract these fields:

| Field | Priority Sources |
|-------|------------------|
| `title` | H1, meta title, URL path |
| `author` | Byline, meta author, channel name |
| `published` | Meta date, URL date pattern |
| `content` | Main article body, transcript, tweet text |
| `summary` | Meta description, first paragraph |

---

## Error Handling

| Error | Strategy |
|-------|----------|
| Network timeout | Retry once with longer timeout |
| 403/401 | Note auth required, use existing clipping content |
| 404 | Note content unavailable, ask if user has copy |
| Rate limit | Wait and retry, or proceed with existing content |
| Empty response | Use existing clipping content, note limitation |

### Graceful Degradation

Always proceed even with partial content:

```
I was able to fetch partial content from this URL. The summary may be incomplete,
but let's work with what we have. You can add context if you remember more.
```
