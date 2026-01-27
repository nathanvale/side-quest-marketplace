# Parallelization Patterns

Rules for batch execution when orchestrating content enrichment across multiple items.

## Capability Matrix

| Source Type | Can Parallelize? | Reason |
|-------------|------------------|--------|
| YouTube | ✅ Yes | Stateless API |
| Firecrawl (articles, GitHub, docs) | ✅ Yes | Batch API |
| Chrome DevTools (X/Twitter, Confluence) | ❌ No | Single browser instance |

## Why Chrome DevTools Cannot Parallelize

Chrome DevTools MCP runs a **single browser instance**:
- One browser = one active page at a time
- `select_page` switches context, but tools operate on selected page only
- Authenticated sessions (Twitter, Confluence) share cookies
- Concurrent navigation would corrupt state

## Orchestration Pattern

### Step 1: Group by Capability

```typescript
const parallelItems = [];     // YouTube, Firecrawl
const sequentialItems = [];   // Chrome DevTools

for (const item of inboxItems) {
  const sourceType = detectSourceType(item.sourceUrl);

  if (sourceType === 'youtube' || sourceType === 'article' || sourceType === 'github') {
    parallelItems.push(item);
  } else if (sourceType === 'twitter' || sourceType === 'confluence') {
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

One at a time - wait for completion before next:

```typescript
for (const item of twitterItems) {
  Task({ prompt: `...sourceType: twitter, sourceUrl: ${item.url}...` })
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

### X/Twitter (one at a time)

```typescript
// MUST be sequential - wait for each before starting next

// Thread 1
mcp__chrome-devtools__navigate_page({ url: "https://x.com/user/status/123", timeout: 30000 })
mcp__chrome-devtools__take_snapshot({})
// Extract content...

// Thread 2 (after thread 1 completes)
mcp__chrome-devtools__navigate_page({ url: "https://x.com/user/status/456", timeout: 30000 })
mcp__chrome-devtools__take_snapshot({})
// Extract content...
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
