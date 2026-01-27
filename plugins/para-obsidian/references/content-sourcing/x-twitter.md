# X/Twitter Content Sourcing

Fetch X/Twitter threads using Chrome DevTools MCP with user-assisted fallback.

## CRITICAL: Firecrawl Does NOT Work

**NEVER use Firecrawl for x.com or twitter.com URLs.** It returns "website not supported" error. You MUST use Chrome DevTools or user-assisted fallback.

## Tools

| Tool | Purpose |
|------|---------|
| `mcp__chrome-devtools__navigate_page` | Load tweet URL |
| `mcp__chrome-devtools__wait_for` | Wait for content selector |
| `mcp__chrome-devtools__take_snapshot` | Capture page content |
| `mcp__chrome-devtools__evaluate_script` | Extract specific elements |

## Tool Availability Check

**CRITICAL:** Before attempting Chrome DevTools, check if tools are available. The `mcp__chrome-devtools__*` tools may not be configured in every session.

**Detection:** If `mcp__chrome-devtools__navigate_page` returns "tool not found" error or isn't in available tools, proceed directly to user-assisted fallback.

## Primary Pattern: Chrome DevTools

### Step 1: Navigate to Tweet

```
mcp__chrome-devtools__navigate_page({ url: "[tweet-url]", timeout: 30000 })
```

### Step 2: Wait for Content

```
mcp__chrome-devtools__wait_for({
  selector: '[data-testid="tweetText"]',
  timeout: 10000
})
```

### Step 3: Take Snapshot

```
mcp__chrome-devtools__take_snapshot({})
```

Returns page HTML. Parse for:
- Tweet text content
- Author display name
- Handle (@username)
- Post date
- Thread replies (if thread)

### Advanced: JavaScript Extraction

For complex extraction:

```
mcp__chrome-devtools__evaluate_script({
  script: `
    const article = document.querySelector('article');
    const text = article?.querySelector('[data-testid="tweetText"]')?.textContent;
    const author = article?.querySelector('[data-testid="User-Name"]')?.textContent;
    return { text, author };
  `
})
```

## Timeout & Retry Strategy

Twitter threads can be slow to load due to dynamic rendering.

| Attempt | Timeout | Action on Failure |
|---------|---------|-------------------|
| 1st | 30s | Retry with longer timeout |
| 2nd | 60s | Retry with page refresh |
| 3rd | 90s | Mark as `enrichment_failed` |

### Implementation

```typescript
async function enrichTwitterWithRetry(url: string): Promise<string | null> {
  const attempts = [
    { timeout: 30000, action: 'initial' },
    { timeout: 60000, action: 'retry' },
    { timeout: 90000, action: 'final' },
  ];

  for (const { timeout, action } of attempts) {
    try {
      await mcp__chrome-devtools__navigate_page({ url, timeout });

      await mcp__chrome-devtools__wait_for({
        selector: '[data-testid="tweetText"]',
        timeout: 10000
      });

      const snapshot = await mcp__chrome-devtools__take_snapshot({});
      return extractTwitterContent(snapshot);

    } catch (error) {
      console.log(`Attempt ${action} failed: ${error.message}`);

      if (action === 'final') {
        return null; // Mark as enrichment_failed
      }

      // Brief pause before retry
      await sleep(2000);
    }
  }
  return null;
}
```

## Fallback: User-Assisted Content

When Chrome DevTools is unavailable or fails.

### When to Use

1. Chrome DevTools MCP tools are not available in session
2. Chrome DevTools call fails (timeout, connection error)
3. Page returns empty/blocked content

### Step 1: Parse URL for Context

```
URL: https://x.com/mattpocockuk/status/1876540660609491024

Parsed:
- username: mattpocockuk
- tweet_id: 1876540660609491024
```

### Step 2: Check Existing Clipping Content

The clipping may already have partial content captured by Web Clipper. Check if the note body contains any tweet text beyond just the URL.

### Step 3: Ask User for Content

Present a helpful prompt:

```
I can't fetch X/Twitter content directly (Chrome DevTools MCP isn't available).

**Tweet by @[username]:** [source URL]

Could you help me out? Either:
1. **Paste the tweet text** here
2. **Summarize what it's about** from memory
3. **Skip this clipping** and move to the next one

What would you prefer?
```

### Step 4: Continue with User Content

Once user provides content, continue the workflow as normal. Learning and distillation work equally well with user-provided context.

## Sequential Execution REQUIRED

Chrome DevTools runs a **single browser instance**:
- One browser = one active page at a time
- `select_page` switches context, but tools operate on selected page only
- Authenticated sessions share cookies

**NEVER parallelize Twitter enrichment.** Process one tweet at a time:

```typescript
// MUST be sequential - wait for each before starting next
for (const item of twitterItems) {
  await enrichTwitter(item.url);
  // Wait for completion before next
}
```

See `parallelization.md` for why this constraint exists.
