# URL Routing

Single source of truth for domain detection and tool selection.

## Domain Detection

Detect source type from URL:

```typescript
function detectSourceType(url: string): string {
  const hostname = new URL(url).hostname.replace('www.', '');

  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    return 'youtube';
  }
  if (hostname.includes('x.com') || hostname.includes('twitter.com')) {
    return 'twitter';
  }
  if (hostname.includes('github.com')) {
    return 'github';
  }
  if (hostname.includes('atlassian.net') || hostname.includes('confluence')) {
    return 'confluence';
  }

  // Default: treat as public article
  return 'article';
}
```

## Routing Table

| Domain Pattern | Source Type | Tool | Parallel? | Reason |
|----------------|-------------|------|-----------|--------|
| `youtube.com`, `youtu.be` | youtube | YouTube Transcript MCP | ✅ Yes | Stateless API |
| `x.com`, `twitter.com` | twitter | Chrome DevTools | ❌ No | Single browser |
| `github.com` | github | Firecrawl | ✅ Yes | Public, no auth |
| `atlassian.net`, `confluence` | confluence | Chrome DevTools | ❌ No | Needs auth |
| Everything else | article | Firecrawl | ✅ Yes | Batch API |

## Tool Selection Summary

| Source Type | Primary Tool | Fallback |
|-------------|--------------|----------|
| YouTube | `mcp__youtube-transcript__get_transcript` | `get_video_info` (metadata only) |
| X/Twitter | `mcp__chrome-devtools__navigate_page` + `take_snapshot` | User-assisted |
| GitHub | `mcp__firecrawl__firecrawl_scrape` | WebFetch |
| Confluence | `mcp__chrome-devtools__navigate_page` + `take_snapshot` | User-assisted |
| Article | `mcp__firecrawl__firecrawl_scrape` | WebFetch |

## CRITICAL Rules

1. **NEVER use Firecrawl for x.com or twitter.com** - Returns "website not supported"
2. **NEVER skip Chrome DevTools for Twitter** - Firecrawl will fail
3. **ALWAYS check tool availability** before assuming a tool works
4. **YouTube and Firecrawl can parallelize** - Chrome DevTools cannot

## Coordinator Grouping Pattern

When orchestrating multiple items, group by parallelization capability:

```typescript
const parallelItems = [];     // YouTube, Firecrawl - spawn in batches of 5
const sequentialItems = [];   // Chrome DevTools - spawn one at a time

for (const item of inboxItems) {
  const sourceType = detectSourceType(item.sourceUrl);

  if (sourceType === 'youtube' || sourceType === 'article' || sourceType === 'github') {
    parallelItems.push(item);
  } else if (sourceType === 'twitter' || sourceType === 'confluence') {
    sequentialItems.push(item);
  }
}
```

See `parallelization.md` for batch execution patterns.
