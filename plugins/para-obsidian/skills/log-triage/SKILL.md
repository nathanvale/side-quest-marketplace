---
name: log-triage
description: Processes voice memos and links from daily notes into structured inbox notes. Extracts 🎤 voice memos into meeting notes with full transcriptions preserved, URLs into clipping notes by type, and reminder text into capture notes. Use when triaging daily logs, converting voice memos, or processing saved URLs and reminders.
allowed-tools: Read, mcp__para-obsidian_para-obsidian__para_read, mcp__para-obsidian_para-obsidian__para_list, mcp__para-obsidian_para-obsidian__para_create, mcp__para-obsidian_para-obsidian__para_insert, mcp__para-obsidian_para-obsidian__para_list_areas, mcp__para-obsidian_para-obsidian__para_list_projects, mcp__firecrawl__firecrawl_scrape, mcp__youtube-transcript__get_transcript, WebFetch, Edit, Write, Bash
---

# Log Triage - Daily Note Processing

Process daily note log entries into structured notes. Extract voice memos into meeting notes, URLs into clipping notes, and reminders into capture tasks.

## Templates

Use `para_config` to get the vault and templates path. Use `para_template_fields` to inspect required fields for any template.

**Primary templates:** `meeting`, `capture`
**Clipping templates:** In `Templates/Clippings/` - matched by URL domain (see URL mapping below)

## The Flow

```
Log entry → LLM extraction → Suggest note type → User confirms → Create note → Delete log entry
```

## Log Entry Types

### 1. Voice Memos (🎤)
**Pattern:** `- [time] - 🎤 [transcription]`

→ Extract into **meeting note** format, create with `type: meeting`

### 2. URLs
**Pattern:** `- [time] - https://...`

→ **Always try Firecrawl first** → Detect clipping type → Create **clipping note**

**If Firecrawl fails** (auth, blocked, timeout) → Still create clipping note by parsing the URL.

**URL → Clipping Type Mapping:**

| Domain/Path Pattern | Clipping Template | Extract From URL |
|---------------------|-------------------|------------------|
| `youtube.com/watch?v=` | `youtube-video.md` | Video ID, title from path |
| `github.com/{owner}/{repo}` | `github-repo.md` | Owner, repo name |
| `*.atlassian.net/wiki/` | `documentation.md` | Space, page title |
| `docs.*`, `developer.*` | `documentation.md` | Path segments |
| `medium.com`, `substack.com`, news sites | `article.md` | Title from path |
| `twitter.com`, `x.com` | `tweet---x-post.md` | Tweet ID |
| `reddit.com/r/{sub}/comments/` | `reddit-post.md` | Subreddit, post title |
| `stackoverflow.com/questions/` | `stack-overflow.md` | Question ID, title |
| `en.wikipedia.org/wiki/` | `wikipedia.md` | Article title |
| `goodreads.com/book/` | `book.md` | Book title |
| `imdb.com/title/` | `movie.md` | Movie title |
| `spotify.com/episode/`, podcast sites | `podcast-episode.md` | Episode title |
| `udemy.com`, `coursera.org` | `course---tutorial.md` | Course title |
| `amazon.com`, shopping sites | `product---gift-idea.md` | Product title |
| `airbnb.com`, `booking.com` | `accommodation.md` | Listing title |
| `yelp.com`, restaurant sites | `restaurant.md` | Restaurant name |
| `eventbrite.com`, `meetup.com` | `event.md` | Event title |
| `maps.google.com`, `goo.gl/maps` | `place.md` | Place name |
| `chatgpt.com/share/` | `chatgpt-conversation.md` | Conversation ID |
| `claude.ai/share/` | `claude-conversation.md` | Conversation ID |
| `apps.apple.com`, `play.google.com` | `app---software.md` | App name |
| *Default* | `article.md` | Best guess from path |

### 3. Text Entries / Short Voice Memos
**Pattern:** `- [time] - [text]` or `- [time] - 🎤 [short text]`

**Reminder/task signals** → Create **capture note** with Obsidian Tasks checkbox inside:
- "remind me to..."
- "don't forget..."
- "remember to..."
- "I need to..."
- "tomorrow I should..."

**Thought/idea** → Create **capture note** with `source: thought`

**Noise** → Just delete

## Session Flow

1. **Read daily note** - Load `000 Timestamps/Daily Notes/YYYY-MM-DD.md`
2. **Parse log section** - Find entries under `## Log`
3. **Suggest note types first** - Show user what each entry looks like:
   ```
   Found 3 log entries:

   1. 🎤 9:26am (~2000 words) → Suggest: Meeting note
   2. 🎤 12:04pm (~3000 words) → Suggest: Meeting note
   3. URL 1:33pm (atlassian.net) → Suggest: Clipping (documentation, auth required)

   Proceed with these? [y/n/change]
   ```
4. **For each confirmed entry:**
   - Extract structure into note format
   - Show extraction preview
   - **Ask user to confirm**
   - Create note in `00 Inbox`
   - Delete entry from daily note
5. **Summary** - What was created, what was skipped

## Voice Memo → Meeting Note

Extract the transcription into meeting note format:

```markdown
---
type: meeting
meeting_type: general
meeting_date: 2026-01-06
area: "[[Career & Contracting]]"
company: Bunnings
template_version: 1
---

# GMS Project Kickoff - Jackie

## Attendees

- Jackie (Team Lead, on leave until 27th)
- Josh Green (Tech Lead, Perth)
- June (Frontend/Backend dev, my buddy)

## Notes

- GMS = Gift Card Management System
- Reseller integration with Black Hawk
- Deadline: July (likely to extend)

## Decisions Made

- Estimates in days, not story points
- All-in day: Thursday

## Action Items

- [ ] Get MacBook bun number to Jackie
- [ ] Test VPN from home tonight
- [ ] Look at Miro board for resellers

```

**Key sections to extract:**
- **Attendees** - Names and roles mentioned
- **Notes** - Key information, context, project details
- **Decisions Made** - Any conclusions or agreements
- **Action Items** - Tasks as checkboxes (these show up in Dataview!)

### Raw Transcription Section (CRITICAL)

**The meeting template does NOT have a Raw Transcription section.** You MUST add it after creating the note.

Use `para_insert` with `mode: "after"` on the `## Follow-up` heading to append:

```markdown
---

## Raw Transcription

> [Full cleaned transcription in blockquote format, broken into paragraphs]
```

### Transcription Cleanup Rules

Before inserting, apply basic cleanup to the raw transcription:
- **Remove filler words:** "um", "uh", "like" (when filler), "you know", "sort of"
- **Fix grammar:** Correct obvious errors, add missing words
- **Add punctuation:** Proper periods, commas, question marks
- **Break into paragraphs:** At natural topic changes or speaker switches
- **Preserve tone:** Keep conversational style and ALL content

**DO NOT summarize or truncate.** The entire transcription must be preserved.

**Reference example:** `02 Areas/🤝🏻 Contract - Bunnings/🗣️ IT Onboarding - Bunnings.md`

## URL → Clipping Note

For URLs, fetch content and create appropriate clipping:

1. **Fetch URL** with `firecrawl_scrape`
2. **Detect clipping type** from domain/content:
   - `youtube.com` → `youtube-video`
   - `github.com` → `github-repo`
   - `*.atlassian.net` → `documentation` (may need auth)
   - News/blog sites → `article`
   - etc.
3. **Extract fields** from page content:
   - Title, author, published date, domain
   - Summary (first paragraph or meta description)
4. **Create clipping note** using template structure

```markdown
---
type: article
clipping_type: article
source: "https://example.com/article"
clipped: 2026-01-06
author: "John Smith"
published: "2026-01-05"
domain: "example.com"
distill_status: raw
related: []
project: []
area: []
template_version: 1
---

# Article Title

## AI Summary

- Key point 1
- Key point 2
- Key point 3

---

**Author:** John Smith
**Published:** 2026-01-05
**Source:** [example.com](https://example.com/article)

---

## Summary

Brief description of the article...

## Highlights



## Full Content

[First 15000 chars of content]
```

**For YouTube videos:** Also fetch transcript with `mcp__youtube-transcript__get_transcript`

**If Firecrawl fails:** Parse URL and create clipping anyway:

URL: `https://bunnings.atlassian.net/wiki/spaces/POS/pages/15205007376/Onboarding+Plan+for+Nathan+Vale`
- Domain: `bunnings.atlassian.net` → type: documentation
- Path contains `/wiki/spaces/POS/` → Confluence, space: POS
- Last segment: `Onboarding+Plan+for+Nathan+Vale` → title: "Onboarding Plan for Nathan Vale"

```markdown
---
type: documentation
clipping_type: docs
source: "https://bunnings.atlassian.net/wiki/spaces/POS/pages/15205007376/Onboarding+Plan+for+Nathan+Vale"
clipped: 2026-01-06
domain: "bunnings.atlassian.net"
distill_status: raw
related: []
project: []
area: "[[Career & Contracting]]"
template_version: 1
---

# Onboarding Plan for Nathan Vale

## AI Summary

Confluence documentation page (POS space). Content requires authentication.

---

**Source:** [bunnings.atlassian.net](https://bunnings.atlassian.net/wiki/spaces/POS/pages/15205007376/Onboarding+Plan+for+Nathan+Vale)

---

## Why I Saved This


```

## Text Entry / Short Voice Memo → Capture Note

For text entries or short voice memos (reminders, thoughts, ideas):

**Reminder example** ("remind me to...", "don't forget..."):
```markdown
---
type: capture
status: inbox
source: reminder
resonance: useful
urgency: high
template_version: 1
---

# Take out the trash

## Capture

- [ ] Take out the trash 🔔 2026-01-06 22:00

## Why I Saved This

From daily log on [[2026-01-06]]
```

**Task emoji format** (Obsidian Tasks plugin):
- `📅` = due date
- `🔔` = reminder/scheduled
- `⏳` = scheduled date
- `🔁` = recurring

**Thought example:**
```markdown
---
type: capture
status: inbox
source: thought
resonance: inspiring
urgency: low
template_version: 1
---

# Tomorrow is a new day

## Capture

Don't forget tomorrow is a new day.

## Why I Saved This

From daily log on [[2026-01-06]]
```

## Example Triage Session

```
Found 3 log entries in 2026-01-06:

1. 🎤 9:26am (~2000 words)
   Looks like: IT onboarding meeting
   → Create: Meeting note "IT Onboarding - Bunnings"
   → Tasks: 4 action items extracted

   Create this? [y/n]

2. 🎤 12:04pm (~3000 words)
   Looks like: Project kickoff with Jackie
   → Create: Meeting note "GMS Project Kickoff - Jackie"
   → Tasks: 5 action items extracted

   Create this? [y/n]

3. URL 1:33pm - Confluence link (bunnings.atlassian.net)
   → Create: Clipping "Onboarding Plan for Nathan Vale" (documentation)
   → Note: Auth required, no content extracted

---
Created: 2 meeting notes, 1 clipping
Deleted: 3 log entries
```

## Deleting Log Entries

After creating the note, **delete the log entry** from the daily note using Edit tool.

The raw transcription is preserved in the meeting note, so nothing is lost.

## Creating Notes Efficiently

**Step 1: Create note with content injection (single call)**
```
para_create({
  template: "meeting",
  title: "GMS Project Kickoff - Jackie",
  dest: "00 Inbox",
  args: { ... },
  content: {
    "Attendees": "- Jackie (Team Lead)\n- Nathan",
    "Notes": "### Key Points\n- Point 1\n- Point 2",
    "Action Items": "- [ ] Task 1\n- [ ] Task 2"
  },
  response_format: "json"
})
```

**Step 2: Set frontmatter (args may not populate correctly)**
```
para_frontmatter_set({
  file: "00 Inbox/🗣️ Note Title.md",
  set: { meeting_type: "general", meeting_date: "2026-01-06", ... }
})
```

**Step 3: Append Raw Transcription after Follow-up section**

The Follow-up section has a `-` placeholder. Insert AFTER it:
```
para_insert({
  file: "...",
  heading: "Follow-up",
  content: "\n---\n\n## Raw Transcription\n\n> [transcription]",
  mode: "after"
})
```

**Step 4: Update daily note** - Use Edit tool directly (don't re-read via MCP).
