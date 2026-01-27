# Enrichment Strategies

## Overview

Clippings are **stubs** - they contain URLs but not full content. Enrichment fetches the actual content before analysis.

**Key insight:** Each subagent enriches its own item. This keeps enriched content out of the coordinator's context.

**Parallelization:** Different sources have different parallelization capabilities. YouTube and articles can be parallel. X/Twitter must be sequential (single Chrome browser).

---

## MANDATORY: X/Twitter Requires Chrome DevTools

**X/Twitter clippings from Web Clipper contain ONLY a stub.** The visible content is NOT the full thread.

You MUST:
1. Use Chrome DevTools to navigate to the source URL
2. Take a snapshot to capture the full thread
3. Extract the actual content from the snapshot

**Never skip this step. Never analyze X/Twitter based solely on clipping file content.**

---

## Enrichment by Source Type

| Source | Detection | Tool | Parallel? | Reason |
|--------|-----------|------|-----------|--------|
| YouTube | `youtube.com` domain | youtube-transcript MCP | ✅ Yes | Stateless API |
| Public Articles | Default for clippings | Firecrawl | ✅ Yes | Batch API |
| GitHub | `github.com` domain | Firecrawl | ✅ Yes | Public, no auth |
| X/Twitter | `x.com` or `twitter.com` | Chrome DevTools | ❌ No | Single browser |
| Confluence | `atlassian.net` domain | Chrome DevTools | ❌ No | Needs auth |
| Voice Memo | `type === "transcription"` | None | N/A | Already has content |
| Attachment | PDF/DOCX | None | N/A | Use para scan CLI |

---

## Why Chrome DevTools Cannot Parallelize

Chrome DevTools MCP runs a **single browser instance**:
- One browser = one active page at a time
- `select_page` switches context, but tools operate on selected page only
- Authenticated sessions (Twitter, Confluence) share cookies

---

## Parallel Enrichment Examples

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

---

## Subagent Enrichment (New Architecture)

Each subagent enriches its OWN item. The coordinator does NOT fetch content.

### Why Subagent Enrichment?

| Approach | Coordinator Context | Problem |
|----------|---------------------|---------|
| Coordinator enriches | 50 transcripts × 10k = 500k tokens | Context pollution |
| Subagent enriches | Only small task metadata | Clean context |

### Coordinator Groups Items

```typescript
const parallelItems = [];     // YouTube, Firecrawl - spawn in batches of 5
const sequentialItems = [];   // Chrome DevTools - spawn one at a time

for (const item of inboxItems) {
  if (item.sourceType === 'youtube' || item.sourceType === 'article') {
    parallelItems.push(item);
  } else if (item.sourceType === 'twitter' || item.sourceType === 'confluence') {
    sequentialItems.push(item);
  } else {
    parallelItems.push(item);  // Voice/attachment - no enrichment needed
  }
}
```

### Spawn Parallel Subagents

```typescript
// Batch of 5 subagents in single message
Task({ prompt: `...sourceType: youtube, sourceUrl: ${url1}...` })
Task({ prompt: `...sourceType: article, sourceUrl: ${url2}...` })
Task({ prompt: `...sourceType: youtube, sourceUrl: ${url3}...` })
Task({ prompt: `...sourceType: article, sourceUrl: ${url4}...` })
Task({ prompt: `...sourceType: voice, file: ${file5}...` })
```

Each subagent fetches its own content internally.

### Spawn Sequential Subagents (X/Twitter)

```typescript
// One at a time - wait for completion before next
for (const item of twitterItems) {
  Task({ prompt: `...sourceType: twitter, sourceUrl: ${item.url}...` })
  // Wait for completion
}
```

### Subagent Fetches Content

Inside the subagent prompt:

```
Based on source type, fetch content:

**YouTube:**
mcp__youtube-transcript__get_transcript({ url: "${sourceUrl}" })

**Article:**
mcp__firecrawl__firecrawl_scrape({ url: "${sourceUrl}", formats: ["markdown"] })

**X/Twitter:**
mcp__chrome-devtools__navigate_page({ url: "${sourceUrl}", timeout: 30000 })
mcp__chrome-devtools__take_snapshot({})

**Voice/Attachment:**
para_read({ file: "${file}" })
```

The enriched content stays in the subagent's context - never flows back to coordinator.

---

## Source Detection

Detect source type from clipping frontmatter or URL:

```typescript
function detectSourceType(item: InboxItem): string {
  const url = item.source || '';

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube';
  }
  if (url.includes('x.com') || url.includes('twitter.com')) {
    return 'twitter';
  }
  if (url.includes('github.com')) {
    return 'github';
  }
  if (url.includes('atlassian.net') || url.includes('confluence')) {
    return 'confluence';
  }
  if (item.type === 'transcription') {
    return 'voice';
  }
  if (item.type === 'attachment') {
    return 'attachment';
  }

  // Default: treat as public article
  return 'article';
}
```

---

## Error Handling

### YouTube Transcript Unavailable

Some videos don't have transcripts. Fallback:
1. Use video title and description from `get_video_info`
2. Mark as low confidence in proposal

### Chrome DevTools Timeout

Twitter threads can be slow to load:
1. Increase timeout to 60s for retries
2. If still fails, mark as "enrichment_failed" in task metadata
3. Continue with other items

### Firecrawl Rate Limit

If rate limited:
1. Add delay between batches
2. Retry failed items at end

---

## Timeout & Retry Strategies

### Chrome DevTools (X/Twitter, Confluence)

Chrome DevTools is the most failure-prone enrichment source due to:
- Dynamic page loading (infinite scroll, lazy load)
- Authentication redirects
- Rate limiting / captchas
- Network latency

**Timeout Configuration:**

| Attempt | Timeout | Action on Failure |
|---------|---------|-------------------|
| 1st | 30s | Retry with longer timeout |
| 2nd | 60s | Retry with page refresh |
| 3rd | 90s | Mark as `enrichment_failed` |

**Implementation:**

```typescript
async function enrichTwitterWithRetry(url: string, taskId: string): Promise<string | null> {
  const attempts = [
    { timeout: 30000, action: 'initial' },
    { timeout: 60000, action: 'retry' },
    { timeout: 90000, action: 'final' },
  ];

  for (const { timeout, action } of attempts) {
    try {
      // Navigate with timeout
      await mcp__chrome-devtools__navigate_page({ url, timeout });

      // Wait for content to load
      await mcp__chrome-devtools__wait_for({
        selector: '[data-testid="tweetText"]',
        timeout: 10000
      });

      // Take snapshot
      const snapshot = await mcp__chrome-devtools__take_snapshot({});
      return extractTwitterContent(snapshot);

    } catch (error) {
      console.log(`Attempt ${action} failed: ${error.message}`);

      if (action === 'final') {
        // Mark task as enrichment failed
        await TaskUpdate({
          taskId,
          metadata: { enrichmentFailed: true, enrichmentError: error.message }
        });
        return null;
      }

      // Brief pause before retry
      await sleep(2000);
    }
  }
  return null;
}
```

**Recovery in Table Review:**

Items with `enrichmentFailed: true` appear in table with warning:

```markdown
| #  | Title                    | Area | Project | Type  | Status |
|----|--------------------------|------|---------|-------|--------|
| 5  | ⚠️ Twitter Thread        | ?    | ?       | thread| FAILED |
```

User options:
- `R 5` - Retry enrichment for item 5
- `D 5` - Delete item 5
- `S 5` - Skip (keep in inbox for later)

### YouTube Transcript

Less failure-prone, but some videos lack transcripts.

| Scenario | Fallback |
|----------|----------|
| No transcript | Use `get_video_info` for title + description |
| Private video | Mark as `enrichment_failed` |
| Age-restricted | Mark as `enrichment_failed` |

```typescript
async function enrichYouTube(url: string, taskId: string): Promise<string> {
  try {
    const transcript = await mcp__youtube-transcript__get_transcript({ url });
    return transcript;
  } catch (error) {
    // Fallback to video info
    const info = await mcp__youtube-transcript__get_video_info({ url });
    return `Title: ${info.title}\n\nDescription: ${info.description}\n\n(No transcript available)`;
  }
}
```

### Firecrawl (Articles)

Generally reliable, but rate limits apply.

| Error | Strategy |
|-------|----------|
| 429 Rate Limit | Wait 5s, retry up to 3 times |
| 403 Forbidden | Mark as `enrichment_failed` (paywall/auth) |
| 5xx Server Error | Wait 10s, retry once |
| Timeout | Retry with longer timeout (60s) |

**Batch Strategy:**

```typescript
// Process articles in batches of 10 with delay between batches
const BATCH_SIZE = 10;
const BATCH_DELAY = 2000; // 2s between batches

for (let i = 0; i < articleItems.length; i += BATCH_SIZE) {
  const batch = articleItems.slice(i, i + BATCH_SIZE);

  // Parallel scrape within batch
  await Promise.all(batch.map(item =>
    mcp__firecrawl__firecrawl_scrape({ url: item.sourceUrl, formats: ["markdown"] })
  ));

  // Delay before next batch (unless last batch)
  if (i + BATCH_SIZE < articleItems.length) {
    await sleep(BATCH_DELAY);
  }
}
```

---

## Enrichment Failed: Next Steps

When enrichment fails for an item:

1. **Task metadata updated** with `enrichmentFailed: true`
2. **Item remains in pending** (not marked in_progress)
3. **Table shows warning** for failed items
4. **User decides**: retry, delete, or skip

This ensures no item is silently dropped - user always has visibility into failures.
