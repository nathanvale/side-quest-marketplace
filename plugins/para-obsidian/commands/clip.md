---
description: Create a clipping from a URL (for links you can't use Web Clipper on)
argument-hint: <url>
---

# Clip URL

Fetch content from a URL and create a clipping note in the inbox. Use this when someone emails you a link or you have a URL but can't use Web Clipper.

## Usage

```
/para-obsidian:clip https://example.com/article
/para-obsidian:clip https://x.com/user/status/123456
/para-obsidian:clip https://youtube.com/watch?v=abc123
```

## What This Does

1. **Detect domain** - Determines content type from URL
2. **Fetch content** - Uses appropriate strategy (Firecrawl, YouTube MCP, Chrome DevTools)
3. **Create clipping** - Creates a clipping note in inbox with standard frontmatter
4. **Offer distillation** - Asks if you want to distill now or save for later

## Instructions

When invoked with a URL:

### 1. Parse URL and Detect Domain

```javascript
const url = new URL(userInput);
const domain = url.hostname.replace('www.', '');
```

### 2. Fetch Content Based on Domain

| Domain Pattern | Strategy | Tool |
|----------------|----------|------|
| `x.com`, `twitter.com` | Chrome DevTools | `mcp__chrome-devtools__navigate_page`, `take_snapshot` |
| `youtube.com`, `youtu.be` | YouTube MCP | `mcp__youtube-transcript__get_video_info`, `get_transcript` |
| Everything else | Firecrawl | `mcp__firecrawl__firecrawl_scrape` |

### 3. Create Clipping Note

Use the appropriate clipping template based on domain:

```
para_create({
  template: "[matched-template]",  // youtube-video, tweet---x-post, article, etc.
  title: "[Extracted Title]",
  dest: "00 Inbox",
  content: {
    // Content sections based on template
  },
  response_format: "json"
})
```

### 4. Set Minimal Frontmatter

```
para_frontmatter_set({
  file: "00 Inbox/[filename].md",
  set: {
    type: "clipping",
    source: "[original URL]",
    clipped: "[today's date YYYY-MM-DD]",
    domain: "[extracted domain]"
  },
  response_format: "json"
})
```

### 5. Offer Distillation

After creating the clipping, ask:

```
Clipping created: ✂️📰 [Title].md

Would you like to:
1. Distill now - Transform this into a resource note with learning dialogue
2. Save for later - Leave in inbox for batch processing with /para-obsidian:distill
```

If user chooses to distill now, invoke the distill-resource skill.

## Example Session

```
User: /para-obsidian:clip https://fortelabs.com/blog/basboverview/

AI: [Fetches content via Firecrawl]

    Created clipping: ✂️📰 Building a Second Brain Overview.md

    Content: 3500 words about the BASB methodology...

    Would you like to:
    1. Distill now
    2. Save for later

User: Save for later

AI: Saved to inbox. Run /para-obsidian:distill when ready to process.
```

## Notes

- This command creates a clipping in the SAME format as Obsidian Web Clipper
- The clipping can then be processed with `/para-obsidian:distill`
- For Twitter/X, Chrome DevTools MCP is required for authenticated access
- If content fetching fails, creates a minimal clipping with just the URL
