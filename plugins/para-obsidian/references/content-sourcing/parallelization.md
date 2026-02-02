# Parallelization Patterns

Rules for batch execution when orchestrating content enrichment across multiple items.

## Capability Matrix

| Source Type | Can Parallelize? | Reason |
|-------------|------------------|--------|
| YouTube | ✅ Yes | Stateless API |
| Firecrawl (articles, GitHub, docs) | ✅ Yes | Batch API |
| X-API (X/Twitter) | ✅ Yes | Stateless API |
| Chrome DevTools (Confluence) | ❌ No | Single browser instance |

## Why Chrome DevTools Cannot Parallelize

Chrome DevTools MCP runs a **single browser instance** (used for Confluence only):
- One browser = one active page at a time
- `select_page` switches context, but tools operate on selected page only
- Authenticated sessions share cookies
- Concurrent navigation would corrupt state

**Note:** X/Twitter no longer uses Chrome DevTools. It uses stateless X-API MCP tools and can parallelize freely.

## Orchestration Pattern

### Step 1: Group by Capability

```typescript
const parallelItems = [];     // YouTube, Firecrawl, X-API
const sequentialItems = [];   // Chrome DevTools (Confluence only)

for (const item of inboxItems) {
  const sourceType = detectSourceType(item.sourceUrl);

  if (sourceType === 'youtube' || sourceType === 'article' || sourceType === 'github' || sourceType === 'twitter') {
    parallelItems.push(item);
  } else if (sourceType === 'confluence') {
    sequentialItems.push(item);
  } else {
    parallelItems.push(item);  // Voice/attachment - no enrichment needed
  }
}
```

### Step 2: Spawn Parallel Subagents

Launch in batches of 5 subagents per message:

```typescript
// Batch of 5 subagents in single message
Task({ prompt: `...sourceType: youtube, sourceUrl: ${url1}...` })
Task({ prompt: `...sourceType: article, sourceUrl: ${url2}...` })
Task({ prompt: `...sourceType: youtube, sourceUrl: ${url3}...` })
Task({ prompt: `...sourceType: article, sourceUrl: ${url4}...` })
Task({ prompt: `...sourceType: voice, file: ${file5}...` })
```

### Step 3: Spawn Sequential Subagents

One at a time - wait for completion before next (Confluence only):

```typescript
for (const item of confluenceItems) {
  Task({ prompt: `...sourceType: confluence, sourceUrl: ${item.url}...` })
  // Wait for completion
}
```

## Batch Size Recommendations

| Context | Batch Size | Rationale |
|---------|------------|-----------|
| Subagent spawning | 5 | Balance parallelism vs context pollution |
| Firecrawl batch | 10 | API rate limit headroom |
| YouTube batch | 5-10 | API typically reliable |
| Batch delay | 2s | Prevent rate limiting |

## Error Isolation

Parallel execution means independent failure:
- One failed enrichment doesn't block others
- Each subagent handles its own errors
- Coordinator collects results/failures at end

```typescript
// Coordinator receives results
const results = await Promise.allSettled(parallelPromises);

const succeeded = results.filter(r => r.status === 'fulfilled');
const failed = results.filter(r => r.status === 'rejected');

// Report failures but continue
if (failed.length > 0) {
  console.log(`${failed.length} enrichments failed`);
}
```

## Why Subagent Enrichment?

Each subagent enriches its OWN item. The coordinator does NOT fetch content.

| Approach | Coordinator Context | Problem |
|----------|---------------------|---------|
| Coordinator enriches | 50 transcripts × 10k = 500k tokens | Context pollution |
| Subagent enriches | Only small task metadata | Clean context |

The enriched content stays in the subagent's context - never flows back to coordinator.

## Parallel Execution Examples

### YouTube (all at once)

```typescript
// Launch simultaneously in single message
mcp__youtube-transcript__get_transcript({ url: "https://youtube.com/watch?v=abc" })
mcp__youtube-transcript__get_transcript({ url: "https://youtube.com/watch?v=def" })
mcp__youtube-transcript__get_transcript({ url: "https://youtube.com/watch?v=ghi" })
```

### Public Articles (all at once)

```typescript
// Launch simultaneously in single message
mcp__firecrawl__firecrawl_scrape({ url: "https://blog.example.com/post1", formats: ["markdown"] })
mcp__firecrawl__firecrawl_scrape({ url: "https://docs.example.com/guide", formats: ["markdown"] })
mcp__firecrawl__firecrawl_scrape({ url: "https://github.com/user/repo", formats: ["markdown"] })
```

### X/Twitter (parallel — stateless API)

```typescript
// Launch simultaneously in single message — X-API tools are stateless
mcp__plugin_x-api_x-api__x_get_tweet({ tweet_id: "123" })
mcp__plugin_x-api_x-api__x_get_tweet({ tweet_id: "456" })
mcp__plugin_x-api_x-api__x_get_tweet({ tweet_id: "789" })
```

## Recovery in Table Review

Items with enrichment failures appear in review table with warning:

```markdown
| #  | Title                    | Area | Project | Type  | Status |
|----|--------------------------|------|---------|-------|--------|
| 5  | ⚠️ Twitter Thread        | ?    | ?       | thread| FAILED |
```

User options:
- `R 5` - Retry enrichment for item 5
- `D 5` - Delete item 5
- `S 5` - Skip (keep in inbox for later)
