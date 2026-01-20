# Enrichment Strategies

Domain-specific content fetching for clipping distillation.

## Strategy Selection

Always determine strategy from the `source` URL domain:

```javascript
const url = new URL(source);
const domain = url.hostname.replace('www.', '');
```

| Domain Pattern | Strategy | Why |
|----------------|----------|-----|
| `x.com`, `twitter.com` | Chrome DevTools | Requires JavaScript, authentication |
| `youtube.com`, `youtu.be` | YouTube Transcript MCP | Specialized API for video data |
| Everything else | Firecrawl | General web scraping |

---

## Twitter/X.com Strategy

X.com requires JavaScript rendering and often authentication for full content.

### Primary: Chrome DevTools MCP

```
mcp__chrome-devtools__navigate_page({ url: source })
```

Wait for page load, then:

```
mcp__chrome-devtools__take_snapshot()
```

Returns page HTML. Parse for:
- Tweet text content
- Author display name
- Handle (@username)
- Post date
- Thread replies (if thread)

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

### Fallback: URL Parsing

If Chrome DevTools unavailable, parse URL for basic info:

```
URL: https://x.com/mattpocockuk/status/1876540660609491024

Parsed:
- username: mattpocockuk
- tweet_id: 1876540660609491024
```

Then ask user:

```
I couldn't fetch the tweet content directly. Could you paste the text here?
```

---

## YouTube Strategy

Use dedicated YouTube Transcript MCP tools.

### Step 1: Get Video Info

```
mcp__youtube-transcript__get_video_info({ url: source })
```

Returns:
- `title` - Video title
- `uploader` - Channel name
- `description` - Video description
- `upload_date` - Publication date (YYYYMMDD format)
- `duration` - Video length

### Step 2: Get Transcript

```
mcp__youtube-transcript__get_transcript({ url: source })
```

Returns full transcript text.

**Pagination:** Check for `next_cursor` in response. If present:

```
mcp__youtube-transcript__get_transcript({
  url: source,
  next_cursor: "[cursor from previous response]"
})
```

Continue until no `next_cursor` returned.

### Fallback: Video Info Only

If transcript unavailable (no captions, private video):

```
Transcript not available for this video. Using description and metadata only.
```

Proceed with video description as content.

---

## Firecrawl Strategy (Default)

For all other URLs, use Firecrawl for intelligent web scraping.

### Standard Fetch

```
mcp__firecrawl__firecrawl_scrape({
  url: source,
  formats: ["markdown"],
  onlyMainContent: true
})
```

Returns:
- `markdown` - Main content as markdown
- `metadata` - Title, description, author if detected

### For Longer Content

If content appears truncated, add options:

```
mcp__firecrawl__firecrawl_scrape({
  url: source,
  formats: ["markdown"],
  onlyMainContent: true,
  waitFor: 3000  // Wait for dynamic content
})
```

### Fallback: Basic Fetch

If Firecrawl fails:

```
WebFetch({
  url: source,
  prompt: "Extract the main article content, title, and author"
})
```

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
