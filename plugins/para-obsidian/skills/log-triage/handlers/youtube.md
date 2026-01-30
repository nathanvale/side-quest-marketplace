# YouTube Handler

Process `youtube.com` or `youtu.be` URLs into clipping notes.

## Step 0 — Discover Template Metadata

Before creating notes, query the youtube-video template for its current structure:

```
para_template_fields({ template: "youtube-video", response_format: "json" })
```

Extract from response:
- `validArgs` → which args to pass (e.g., `source`, `video_id`, `channel`, `duration`, `published`, `clipped`)
- `creation_meta.dest` → destination folder
- `creation_meta.contentTargets` → section headings for content injection
- `creation_meta.sections` → all body section headings (e.g., `"Description"`, `"Transcript"`, `"AI Summary"`)

Use these discovered values instead of hardcoding them.

## Extraction Tools

Use YouTube MCP tools (from `youtube-transcript` server):

```
mcp__youtube-transcript__get_video_info({ url: "https://www.youtube.com/watch?v=..." })
```
Returns: `title`, `uploader` (channel), `description`, `upload_date`, `duration`

```
mcp__youtube-transcript__get_transcript({ url: "https://www.youtube.com/watch?v=..." })
```
Returns: Full transcript text (may be paginated - check for `next_cursor`)

## Fields to Extract

| Field | Source | Example |
|-------|--------|---------|
| `title` | get_video_info | "Never Gonna Give You Up" |
| `channel` | uploader field | "Rick Astley" |
| `description` | description field | Video description |
| `published` | upload_date | "2009-10-25" |
| `duration` | duration field | "4 minutes" |
| `video_id` | URL parsing | "dQw4w9WgXcQ" |

## Note Creation (Single Call)

Use the section headings discovered from Step 0 (`creation_meta.sections`) for content injection. Typical sections include Description, Transcript, and AI Summary.

```
para_create({
  template: "youtube-video",
  title: "{Channel} - {Video Title}",
  dest: "<discovered-dest>",
  args: {},
  content: {
    "<discovered-description-section>": "[Video description from API]",
    "<discovered-transcript-section>": "[Full transcript from get_transcript]",
    "<discovered-ai-summary-section>": "> - Key insight 1\n> - Key insight 2\n> - Key insight 3"
  },
  response_format: "json"
})
```

**CRITICAL:** Use the exact heading names from `creation_meta.sections` discovered in Step 0. Do not hardcode section names.

## Set Frontmatter

Use the fields from `validArgs` discovered in Step 0:

```
para_fm_set({
  file: "<discovered-dest>/✂️🎬 {Channel} - {Video Title}.md",
  set: {
    source: "https://www.youtube.com/watch?v=...",
    video_id: "dQw4w9WgXcQ",
    channel: "Rick Astley",
    duration: "4 minutes",
    published: "2009-10-25",
    transcript_status: "complete"
  }
})
```

## Note Naming

`{Channel} - {Video Title}` (truncate to 80 chars total)

## Template Output

```markdown
---
type: clipping
resource_type: youtube-video
source: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
video_id: dQw4w9WgXcQ
channel: Rick Astley
duration: 4 minutes
published: 2009-10-25
clipped: 2026-01-09
consumption_status: to-watch
transcript_status: complete
---

# Rick Astley - Never Gonna Give You Up

## AI Summary

> - Classic 1987 hit that topped charts in 25 countries
> - Directed by Simon West
> - Passed 1 billion YouTube views in July 2021

---

![](https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg)

**Channel:** Rick Astley
**Duration:** 4 minutes
**Published:** 2009-10-25

## Description

The official video for "Never Gonna Give You Up"...

## Notes



## Transcript

♪ We're no strangers to love ♪
...
```
