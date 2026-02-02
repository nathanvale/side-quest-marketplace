# Firecrawl Content Sourcing

Fetch articles, GitHub repos, documentation, and general web content using Firecrawl MCP.

## Tool

| Tool | Purpose |
|------|---------|
| `mcp__firecrawl__firecrawl_scrape` | Intelligent web scraping with markdown output |

## Supported Domains

Firecrawl works for most public web content:
- Blog posts and articles
- Documentation sites
- GitHub repositories (public)
- News sites
- Product pages

**NOT supported:** x.com, twitter.com (use X-API MCP tools instead — see x-twitter.md)

## Standard Pattern

```
mcp__firecrawl__firecrawl_scrape({
  url: "[source-url]",
  formats: ["markdown"],
  onlyMainContent: true
})
```

Returns:
- `markdown` - Main content as clean markdown
- `metadata` - Title, description, author if detected

## Options

| Option | Purpose | When to Use |
|--------|---------|-------------|
| `onlyMainContent: true` | Strip navigation, ads, footers | Always (default) |
| `waitFor: 3000` | Wait for dynamic content | SPAs, lazy-loaded content |
| `formats: ["markdown"]` | Output format | Always markdown for analysis |

### For Dynamic Content

If content appears truncated or incomplete:

```
mcp__firecrawl__firecrawl_scrape({
  url: "[source-url]",
  formats: ["markdown"],
  onlyMainContent: true,
  waitFor: 3000  // Wait 3s for JavaScript
})
```

## Fallback: WebFetch

If Firecrawl fails (rate limit, site blocked), use WebFetch:

```
WebFetch({
  url: "[source-url]",
  prompt: "Extract the main article content, title, and author"
})
```

## Error Handling

| Error | Strategy |
|-------|----------|
| 429 Rate Limit | Wait 5s, retry up to 3 times |
| 403 Forbidden | Mark as `enrichment_failed` (paywall/auth) |
| 5xx Server Error | Wait 10s, retry once |
| Timeout | Retry with longer timeout (60s) |

### Rate Limit Handling

```typescript
async function scrapeWithRetry(url: string, retries = 3): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await mcp__firecrawl__firecrawl_scrape({
        url,
        formats: ["markdown"],
        onlyMainContent: true
      });
    } catch (error) {
      if (error.status === 429 && attempt < retries) {
        await sleep(5000); // Wait 5s before retry
        continue;
      }
      throw error;
    }
  }
  return null;
}
```

## Batch Processing

Firecrawl supports parallel execution. For multiple URLs:

```typescript
// Process in batches of 10 with delay between batches
const BATCH_SIZE = 10;
const BATCH_DELAY = 2000; // 2s between batches

for (let i = 0; i < articleItems.length; i += BATCH_SIZE) {
  const batch = articleItems.slice(i, i + BATCH_SIZE);

  // Parallel scrape within batch
  await Promise.all(batch.map(item =>
    mcp__firecrawl__firecrawl_scrape({
      url: item.sourceUrl,
      formats: ["markdown"],
      onlyMainContent: true
    })
  ));

  // Delay before next batch (unless last batch)
  if (i + BATCH_SIZE < articleItems.length) {
    await sleep(BATCH_DELAY);
  }
}
```

See `parallelization.md` for orchestration patterns.

## Parallel Execution

Firecrawl API is stateless - multiple URLs can be fetched simultaneously:

```typescript
// Launch all in single message
mcp__firecrawl__firecrawl_scrape({ url: "https://blog.example.com/post1", formats: ["markdown"] })
mcp__firecrawl__firecrawl_scrape({ url: "https://docs.example.com/guide", formats: ["markdown"] })
mcp__firecrawl__firecrawl_scrape({ url: "https://github.com/user/repo", formats: ["markdown"] })
```

## Content Extraction

After fetching, extract these fields from the result:

| Field | Priority Sources |
|-------|------------------|
| `title` | H1, meta title, URL path |
| `author` | Byline, meta author |
| `published` | Meta date, URL date pattern |
| `content` | Main article body |
| `summary` | Meta description, first paragraph |

## Example Output

```json
{
  "markdown": "# Article Title\n\nBy Author Name\n\nArticle content here...",
  "metadata": {
    "title": "Article Title",
    "description": "Meta description",
    "author": "Author Name",
    "publishedDate": "2024-01-15"
  }
}
```
