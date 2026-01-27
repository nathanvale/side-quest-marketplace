# Tool Selection for Content Fetching

When fetching full source content during distillation, use the appropriate tool based on the domain.

| Domain | Tool |
|--------|------|
| `youtube.com`, `youtu.be` | `mcp__youtube-transcript__get_transcript` |
| `x.com`, `twitter.com` | Chrome DevTools or ask user |
| Everything else | `mcp__firecrawl__firecrawl_scrape` |

**When to Fetch:**

Check if the resource has sufficient content in "Layer 1: Captured Notes". If sparse, fetch the full source using the appropriate tool above.
