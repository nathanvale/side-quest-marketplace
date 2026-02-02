# Tool Selection for Content Fetching

When fetching full source content during distillation, use the appropriate tool based on the domain.

## Content Sourcing Reference

See the shared content sourcing documentation for detailed patterns:
@plugins/para-obsidian/references/content-sourcing/url-routing.md

## Quick Reference

| Domain | Tool |
|--------|------|
| `youtube.com`, `youtu.be` | `mcp__youtube-transcript__get_transcript` |
| `x.com`, `twitter.com` | X-API MCP (`x_get_tweet`) or ask user |
| Everything else | `mcp__firecrawl__firecrawl_scrape` |

**When to Fetch:**

Check if the resource has sufficient content in "Layer 1: Captured Notes". If sparse, fetch the full source using the appropriate tool above.
