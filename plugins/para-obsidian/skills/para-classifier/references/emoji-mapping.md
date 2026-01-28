# Emoji Mapping

`source_format` → emoji conversion for visual discoverability.

---

## Core Mapping Table

| source_format | Emoji | Content Type | Examples |
|---------------|-------|--------------|----------|
| `article` | 📰 | Web article, blog post | Medium, Dev.to, personal blogs |
| `video` | 🎬 | Video content | YouTube, Vimeo, conference talks |
| `podcast` | 🎙️ | Podcast episode | Spotify, Apple Podcasts |
| `thread` | 🧵 | Twitter/X thread | Multi-tweet threads |
| `book` | 📖 | Book notes/summary | Physical or digital books |
| `course` | 🎓 | Online course/tutorial | Udemy, Coursera, egghead.io |
| `audio` | 🎧 | Generic audio | Audio files, voice notes |
| `paper` | 📑 | Research paper | Academic papers, whitepapers |
| `document` | 📄 | Generic document | PDF, DOCX, TXT |
| `image` | 🖼️ | Visual content | Screenshots, diagrams, photos |

---

## Usage in Frontmatter

Resources use the `source_format` field:

```yaml
---
type: resource
source_format: article  # 📰
title: "Progressive Summarization Guide"
url: https://fortelabs.com/blog/...
---
```

**Filename convention:** `[emoji][title].md`

Example: `📰 Progressive Summarization Guide.md`

---

## Emoji Selection Guidelines

### When in Doubt

**Has video component?** → 🎬 `video`
**Has audio component?** → 🎧 `audio` or 🎙️ `podcast`
**Has text component?** → 📰 `article` or 📄 `document`

**Priority order:**
1. Most specific format (video > podcast > article)
2. Primary content type (if mixed media)
3. How you'll consume it (watch, listen, read)

### Common Ambiguities

| Scenario | Decision | Rationale |
|----------|----------|-----------|
| YouTube with transcript | 🎬 `video` | Primary format is video |
| Podcast with show notes | 🎙️ `podcast` | Primary format is audio |
| Article with video embed | 📰 `article` | Primary format is text |
| Twitter thread screenshot | 🧵 `thread` | Content type is thread |
| Kindle book highlights | 📖 `book` | Source is book |
| Course with video lessons | 🎓 `course` | Structured learning |
| Research PDF | 📑 `paper` | Academic content |
| Generic PDF | 📄 `document` | Generic document |
| Infographic | 🖼️ `image` | Visual primary |
| Voice memo transcription | 🎧 `audio` | Audio source |

---

## Content Type Detection

### Article (📰)

**Indicators:**
- Primarily text-based
- Blog post, news article, essay
- Web URL with article structure
- Reading time estimate

**Examples:**
- Medium posts
- Dev.to articles
- Personal blog posts
- News articles

### Video (🎬)

**Indicators:**
- YouTube, Vimeo, or video platform URL
- Conference talk recording
- Screen recording, tutorial
- Webinar replay

**Examples:**
- youtube.com/watch?v=...
- vimeo.com/...
- Conference talk recordings
- Tutorial videos

### Podcast (🎙️)

**Indicators:**
- Podcast platform URL
- Episode number/title
- Show notes included
- Audio-first format

**Examples:**
- Spotify episode links
- Apple Podcasts
- RSS feed items
- Audio interviews

### Thread (🧵)

**Indicators:**
- Twitter/X URL
- Multiple connected posts
- Thread unroll/reader
- Social media chain

**Examples:**
- x.com/user/status/...
- Thread reader apps
- Numbered tweet series
- Twitter Moments

### Book (📖)

**Indicators:**
- Book title and author
- Chapter notes
- Kindle highlights
- Summary/review

**Examples:**
- Building a Second Brain (Forte)
- Atomic Habits (Clear)
- Book club notes
- Reading summaries

### Course (🎓)

**Indicators:**
- Structured curriculum
- Multiple lessons/modules
- Learning platform
- Course completion

**Examples:**
- Udemy courses
- Coursera classes
- egghead.io tutorials
- Frontend Masters

### Audio (🎧)

**Indicators:**
- Generic audio file
- Voice memo
- Audio-only content
- Not podcast format

**Examples:**
- .mp3/.m4a files
- Voice recordings
- Audio notes
- Meeting recordings

### Paper (📑)

**Indicators:**
- Academic paper
- Research publication
- Whitepaper
- Technical report

**Examples:**
- arXiv papers
- IEEE publications
- Company whitepapers
- Research reports

### Document (📄)

**Indicators:**
- Generic PDF/DOCX
- Not academic paper
- Mixed content
- Fallback category

**Examples:**
- Work documents
- Reports
- Manuals
- Generic PDFs

### Image (🖼️)

**Indicators:**
- Screenshot
- Diagram/chart
- Infographic
- Visual reference

**Examples:**
- Architecture diagrams
- UI screenshots
- Infographics
- Reference images

---

## Filename Conventions

**Pattern:** `[emoji][clip-prefix][title].md`

### Resource Files

```
📰 Progressive Summarization Guide.md
🎬 Kent C Dodds - Testing JavaScript.md
🎙️ Changelog - TypeScript 5.0.md
🧵 Dan Abramov - React Reconciliation.md
📖 Building a Second Brain - Chapter 3.md
🎓 Frontend Masters - TypeScript Fundamentals.md
```

### Clipping Files (web clipper)

Add `✂️` prefix for web clipper captures:

```
✂️📰 How to Build a Second Brain.md
✂️🎬 Introduction to Progressive Summarization.md
✂️🧵 Thread on Note-Taking Systems.md
```

**Clip emoji indicates:** "Captured via web clipper, may need cleanup"

---

## Multi-Format Resources

**When content has multiple formats:**

1. Choose **primary consumption format**
2. Note alternative formats in frontmatter

**Example:**
```yaml
---
type: resource
source_format: video       # 🎬 Primary
title: "TypeScript Deep Dive"
url: https://youtube.com/...
has_transcript: true       # Also available as text
---
```

**Filename:** `🎬 TypeScript Deep Dive.md`

**Note in body:**
> Also available as [article](link) and [transcript](link)

---

## Special Cases

### YouTube Videos with Transcripts

**Use:** 🎬 `video` (primary format)

**Rationale:** You saved it as a video, consume it as video. Transcript is supplementary.

### Twitter Threads as Screenshots

**Use:** 🧵 `thread` (content type)

**Rationale:** Format is thread, delivery mechanism (screenshot) is secondary.

### Podcast Show Notes

**Use:** 🎙️ `podcast` (primary format)

**Rationale:** Show notes are metadata, podcast is main content.

### Ebooks vs Physical Books

**Use:** 📖 `book` (both)

**Rationale:** Format doesn't matter, source type is book.

### Conference Talks

**Use:** 🎬 `video` if recorded, 📄 `document` if slides only

**Rationale:** Reflects actual consumption format.

---

## Quick Lookup

**Need emoji for:**
- Blog post? → 📰 `article`
- YouTube? → 🎬 `video`
- Twitter thread? → 🧵 `thread`
- PDF guide? → 📄 `document`
- Academic paper? → 📑 `paper`
- Podcast? → 🎙️ `podcast`
- Course? → 🎓 `course`
- Voice memo? → 🎧 `audio`
- Book notes? → 📖 `book`
- Screenshot? → 🖼️ `image`

**When completely unsure:** Use 📄 `document` as safe fallback.
