# YouTube Content Sourcing

Fetch YouTube video transcripts and metadata using the YouTube Transcript MCP.

## Tools

| Tool | Purpose |
|------|---------|
| `mcp__youtube-transcript__get_video_info` | Metadata (title, channel, description, duration) |
| `mcp__youtube-transcript__get_transcript` | Full transcript text |

## Standard Pattern

### Step 1: Get Video Metadata

```
mcp__youtube-transcript__get_video_info({ url: "[youtube-url]" })
```

Returns:
- `title` - Video title
- `uploader` - Channel name
- `description` - Video description
- `upload_date` - Publication date (YYYYMMDD format)
- `duration` - Video length

### Step 2: Get Transcript

```
mcp__youtube-transcript__get_transcript({ url: "[youtube-url]" })
```

Returns full transcript text.

### Pagination

Check for `next_cursor` in response. If present, fetch more:

```
mcp__youtube-transcript__get_transcript({
  url: "[youtube-url]",
  next_cursor: "[cursor from previous response]"
})
```

Continue until no `next_cursor` returned.

## Error Handling

| Scenario | Behavior | Fallback |
|----------|----------|----------|
| No transcript available | Returns error | Use `get_video_info` for title + description |
| Private video | Returns error | Mark as `enrichment_failed` |
| Age-restricted | Returns error | Mark as `enrichment_failed` |
| Rate limited | Temporary failure | Retry after delay |

### Fallback Implementation

```typescript
async function enrichYouTube(url: string): Promise<string> {
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

## Parallel Execution

YouTube API is stateless - multiple transcripts can be fetched simultaneously:

```typescript
// Launch all in single message
mcp__youtube-transcript__get_transcript({ url: "https://youtube.com/watch?v=abc" })
mcp__youtube-transcript__get_transcript({ url: "https://youtube.com/watch?v=def" })
mcp__youtube-transcript__get_transcript({ url: "https://youtube.com/watch?v=ghi" })
```

See `parallelization.md` for batch sizing recommendations.

## Example Output

For a typical video:

```json
{
  "title": "TypeScript 5.5 - New Features",
  "uploader": "Matt Pocock",
  "description": "Exploring the latest TypeScript features...",
  "upload_date": "20240115",
  "duration": "15:42"
}
```

Transcript returns plain text with speaker turns and timestamps stripped.
