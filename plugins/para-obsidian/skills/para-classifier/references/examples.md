# Classification Examples

Real-world inbox classification scenarios with reasoning.

---

## Example 1: Medium Article

**Inbox item:**
- Filename: `How to Build a Second Brain.pdf`
- Content: Article about note-taking methodology
- URL: https://medium.com/@tiagoforte/...

**Classification:**
```yaml
type: resource
source_format: article
```

**Reasoning:**
- Distillable content (insights to extract)
- No date/transaction
- Purpose: Learn methodology
- Emoji: 📰

**Filename:** `📰 How to Build a Second Brain.md`

---

## Example 2: YouTube Tutorial

**Inbox item:**
- Filename: `TypeScript Advanced Types.pdf`
- Content: Link to youtube.com/watch?v=abc123
- Transcript available

**Classification:**
```yaml
type: resource
source_format: video
```

**Reasoning:**
- Primary format is video
- Distillable content (tutorial)
- Transcript is supplementary
- Emoji: 🎬

**Filename:** `🎬 TypeScript Advanced Types.md`

---

## Example 3: Flight Booking Confirmation

**Inbox item:**
- Filename: `Qantas Booking ABC123.pdf`
- Content: Flight details, confirmation number, dates, price

**Classification:**
```yaml
type: booking
booking_type: flight
```

**Reasoning:**
- Has confirmation number
- Has dates and price
- Transaction record
- Not distillable

**Filename:** `🎫 Flight to Sydney - Feb 15.md`

---

## Example 4: Team Meeting Notes

**Inbox item:**
- Filename: `Sprint Planning Jan 28.pdf`
- Content: Attendees, agenda, action items, date

**Classification:**
```yaml
type: meeting
```

**Reasoning:**
- Has attendees
- Has specific date
- Has agenda and outcomes
- Event record, not distillable content

**Filename:** `🗓️ Sprint Planning - Jan 28.md`

---

## Example 5: Twitter Thread Screenshot

**Inbox item:**
- Filename: `Dan Abramov React Thread.png`
- Content: Screenshot of Twitter thread about React internals

**Classification:**
```yaml
type: resource
source_format: thread
```

**Reasoning:**
- Distillable insights about React
- Content type is thread
- No date/transaction
- Emoji: 🧵

**Filename:** `🧵 Dan Abramov - React Reconciliation.md`

---

## Example 6: Podcast Episode

**Inbox item:**
- Filename: `Changelog Episode 512.pdf`
- Content: Link to podcast, show notes included

**Classification:**
```yaml
type: resource
source_format: podcast
```

**Reasoning:**
- Primary format is audio
- Distillable content
- Show notes are metadata
- Emoji: 🎙️

**Filename:** `🎙️ Changelog - TypeScript 5.0.md`

---

## Example 7: Medical Test Results

**Inbox item:**
- Filename: `Blood Test Results Jan 2025.pdf`
- Content: Lab results, provider, date, patient info

**Classification:**
```yaml
type: medical-statement
```

**Reasoning:**
- Has date and provider
- Medical transaction
- Reference document (not distillable)
- Goes in Health area

**Filename:** `🏥 Blood Test - Jan 28 2025.md`

---

## Example 8: Invoice from Vendor

**Inbox item:**
- Filename: `Netlify Invoice INV-001.pdf`
- Content: Invoice number, amount, due date, vendor

**Classification:**
```yaml
type: invoice
```

**Reasoning:**
- Has invoice number
- Has financial transaction
- Has due date
- Reference document

**Filename:** `💰 Netlify - January 2025.md`

---

## Example 9: Book Highlights

**Inbox item:**
- Filename: `Atomic Habits Highlights.pdf`
- Content: Kindle highlights from book

**Classification:**
```yaml
type: resource
source_format: book
```

**Reasoning:**
- Source is book
- Distillable insights
- No date/transaction
- Emoji: 📖

**Filename:** `📖 Atomic Habits - James Clear.md`

---

## Example 10: Conference Talk (Attended Live)

**Inbox item:**
- Filename: `Emily Freeman DevOps Talk.pdf`
- Content: Notes from conference talk you attended

**Classification:**
```yaml
type: meeting
```

**Reasoning:**
- Attended live (interactive)
- Has date and location
- Has your notes/action items
- Event record

**Filename:** `🗓️ AWS re:Invent - DevOps Culture.md`

**Alternative:** If you watched recording later → `resource` with `source_format: video`

---

## Example 11: Conference Talk (Recording)

**Inbox item:**
- Filename: `Emily Freeman DevOps Culture.mp4`
- Content: YouTube link to talk recording

**Classification:**
```yaml
type: resource
source_format: video
```

**Reasoning:**
- Watched alone (not interactive)
- No attendees/agenda
- Distillable content
- Emoji: 🎬

**Filename:** `🎬 Emily Freeman - DevOps Culture.md`

**Key difference from Example 10:** Attendance mode (live vs recording)

---

## Example 12: Voice Memo (Long)

**Inbox item:**
- Filename: `Voice Memo Jan 28 9:26am.txt`
- Content: 2000-word transcription, discussion of project ideas with yourself

**Classification:**
```yaml
type: meeting
```

**Reasoning:**
- Length suggests meeting/discussion
- Multiple topics covered
- Has date/time
- Event record

**Filename:** `🗓️ Product Ideas Brainstorm - Jan 28.md`

---

## Example 13: Voice Memo (Short)

**Inbox item:**
- Filename: `Voice Memo Jan 28 2:15pm.txt`
- Content: 45-word quick idea about app feature

**Classification:**
```yaml
type: clipping
source: thought
```

**Reasoning:**
- Short length (quick thought)
- Single idea
- Temporary note
- Not formal meeting

**Filename:** `💡 Notification feature idea.md`

---

## Example 14: Research Paper PDF

**Inbox item:**
- Filename: `Attention Is All You Need.pdf`
- Content: Transformer architecture paper from arXiv

**Classification:**
```yaml
type: resource
source_format: paper
```

**Reasoning:**
- Academic paper
- Distillable insights
- Technical content
- Emoji: 📑

**Filename:** `📑 Attention Is All You Need - Vaswani et al.md`

---

## Example 15: Generic PDF Document

**Inbox item:**
- Filename: `Project Requirements.pdf`
- Content: Work document with project specs

**Classification:**
```yaml
type: resource
source_format: document
```

**Reasoning:**
- Generic document
- Distillable content (requirements)
- No specific classifier match
- Emoji: 📄

**Filename:** `📄 Project Requirements - Q1 2025.md`

---

## Example 16: Web Bookmark (Article)

**Inbox item:**
- Source: Obsidian Web Clipper
- URL: https://css-tricks.com/...
- Content: Full article text captured

**Classification:**
```yaml
type: resource
source_format: article
```

**Reasoning:**
- Substantial content captured
- Distillable article
- Web clipper source
- Emoji: 📰 with ✂️ prefix

**Filename:** `✂️📰 Modern CSS Grid Techniques.md`

**Note:** `✂️` indicates web clipper source

---

## Example 17: Web Bookmark (Placeholder)

**Inbox item:**
- Source: Obsidian Web Clipper
- URL only, no content
- "Read later" note

**Classification:**
Archive or Delete

**Reasoning:**
- No substantial content
- Just a placeholder
- No value to process

**Action:** Archive if historical value, otherwise delete

---

## Example 18: Employment Contract

**Inbox item:**
- Filename: `Employment Agreement - ACME Corp.pdf`
- Content: Contract terms, salary, start date, benefits

**Classification:**
```yaml
type: employment-contract
```

**Reasoning:**
- Employment terms
- Has financial transaction (salary)
- Has start date
- Legal document (reference)

**Filename:** `📝 ACME Corp Employment Contract.md`

---

## Example 19: Cover Letter

**Inbox item:**
- Filename: `Cover Letter - Google.pdf`
- Content: Formal letter for job application

**Classification:**
```yaml
type: letter
```

**Reasoning:**
- Formal correspondence
- Has recipient
- Has date
- Reference document

**Filename:** `✉️ Cover Letter - Google.md`

---

## Example 20: CV/Resume

**Inbox item:**
- Filename: `Nathan Vale Resume 2025.pdf`
- Content: Work history, skills, education

**Classification:**
```yaml
type: cv
```

**Reasoning:**
- Personal career document
- Reference material
- Updated periodically
- Not distillable content

**Filename:** `📋 Nathan Vale - CV 2025.md`

---

## Edge Cases

### Case A: Article with Embedded Video

**Decision:** 📰 `article` (primary format)

**Reasoning:** Content is article, video is supplementary.

### Case B: YouTube Video with Rich Transcript

**Decision:** 🎬 `video` (primary format)

**Reasoning:** You saved it as video, transcript is supplementary.

### Case C: Podcast with Full Show Notes Article

**Decision:** 🎙️ `podcast` (primary format)

**Reasoning:** Primary consumption is audio, show notes are metadata.

### Case D: Twitter Thread + Article Expansion

**Decision:** Create both

- Thread: 🧵 `thread` (original)
- Article: 📰 `article` (expansion)

**Reasoning:** Different content, different sources.

### Case E: Meeting Recording + Transcript

**Decision:** 🗓️ `meeting`

**Reasoning:** Event record, not distillable resource. Transcript is meeting notes.

### Case F: Conference Talk You Spoke At

**Decision:** Neither Meeting nor Resource

**Reasoning:** Your own presentation. Consider `project` note or `archive`.

---

## Decision Shortcuts

**Has confirmation number?** → Booking
**Has invoice number?** → Invoice
**Has attendees + agenda?** → Meeting
**Has test results + provider?** → Medical Statement
**YouTube/Vimeo URL?** → Resource (video)
**Article URL + text?** → Resource (article)
**Twitter thread?** → Resource (thread)
**Book highlights?** → Resource (book)
**Voice memo >200 words?** → Meeting
**Voice memo <200 words?** → Capture
**Academic paper?** → Resource (paper)
**Generic PDF?** → Resource (document)
**Employment terms?** → Employment Contract
**Formal letter?** → Letter
**Resume/CV?** → CV

---

## Confidence Levels

### High Confidence (Auto-classify)
- Clear template match (invoice, booking, CV)
- Filename + content patterns align
- No ambiguity

**Examples:** Invoice with invoice number, booking with confirmation

### Medium Confidence (Review Required)
- Partial matches
- Could fit multiple categories
- User context needed

**Examples:** Long voice memo (meeting vs clipping?), article with video

### Low Confidence (Ask User)
- No clear classifier
- Ambiguous content
- Complex document

**Examples:** Generic document, mixed-format content, unusual structure

**Always show reasoning and confidence to user for review.**
