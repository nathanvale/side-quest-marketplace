# PARA Philosophy

Tiago Forte's core principles for organizing knowledge.

---

## The PARA Method

**P.A.R.A.** = Projects · Areas · Resources · Archives

### Projects
**Definition:** Short-term efforts with a goal and deadline
**Examples:** "Launch product," "Plan wedding," "Write article"
**Test:** Has a specific outcome? Has a deadline? → Project

### Areas
**Definition:** Ongoing responsibilities with a standard to maintain
**Examples:** "Health," "Finances," "Relationships," "Career"
**Test:** Never "done" but requires attention over time? → Area

### Resources
**Definition:** Topics or interests that may be useful in the future
**Examples:** "Web design," "Psychology," "Cooking recipes"
**Test:** Knowledge you want to learn from? → Resource

### Archives
**Definition:** Inactive items from the other three categories
**Examples:** Completed projects, inactive areas, outdated resources
**Test:** No longer active but worth keeping? → Archive

---

## The CODE Method

Resources flow through four stages:

1. **Capture** - Save interesting content to inbox
2. **Organize** - Move to appropriate PARA category
3. **Distill** - Extract key insights through progressive summarization
4. **Express** - Use knowledge in projects and creative work

**Key insight:** Resources are raw material for your projects and areas.

---

## The "Future You" Test

When classifying inbox items, ask:

> "Will Future Me need to **learn** from this, or just **reference** it?"

### Learning → Resource
- Articles about web performance
- Video tutorials on TypeScript
- Book summaries on productivity
- Podcast episodes with insights

**Needs distillation** - Extract and highlight key insights

### Reference → Record/Meeting/Booking
- Meeting notes with action items
- Flight booking confirmations
- Medical test results
- Invoice receipts

**Needs retrieval** - Find it when you need the details

---

## Resources: Designing for Future You

> "Future You is a demanding customer who needs proof upfront that reviewing a note will be worthwhile."
> — Tiago Forte

**Your job:** Make resources **discoverable** and **understandable** at a glance.

### Discoverability (Compression)
- Emojis for visual scanning
- Bold passages for quick skimming
- Highlights of the highlights
- Executive summary in your own words

### Understanding (Context)
- Enough detail to be useful
- Links to original source
- Your personal takeaways
- Connections to projects/areas

---

## Classification Heuristics

### Has a Date/Transaction? → Record
- **Meeting** - Has attendees, agenda, action items
- **Booking** - Confirmation number, dates, prices
- **Invoice** - Amount, vendor, payment details
- **Medical Statement** - Test results, dates, providers

### Knowledge to Distill? → Resource
- Articles, videos, podcasts, books
- Tutorials, courses, talks
- Research papers, documentation
- Thread summaries, blog posts

**Key question:** "Do I need to extract insights from this?"

### Neither? → Archive or Delete
- Outdated information
- Completed one-off tasks
- Reference material no longer relevant
- Duplicates

---

## Source Format = Content Type

Resources have a `source_format` field that indicates how the content was originally captured:

| source_format | Meaning | Emoji |
|---------------|---------|-------|
| `article` | Web article, blog post | 📰 |
| `video` | YouTube, Vimeo, etc. | 🎬 |
| `podcast` | Audio podcast episode | 🎙️ |
| `thread` | Twitter/X thread | 🧵 |
| `book` | Book summary/notes | 📖 |
| `course` | Online course | 🎓 |
| `audio` | Generic audio | 🎧 |
| `paper` | Research paper | 📑 |
| `document` | PDF, DOCX | 📄 |
| `image` | Screenshot, diagram | 🖼️ |

**Why it matters:** Emojis make resources **visually scannable** in file lists.

---

## Progressive Summarization

Resources are distilled through four layers:

1. **Layer 1: Original Content** - Full text from source
2. **Layer 2: Bold Passages** - 10-20% most valuable content
3. **Layer 3: Highlighted Core** - 10-20% of bold (1-4% of total)
4. **Layer 4: Executive Summary** - Your own words

**Goal:** Make each layer scannable in 30 seconds or less.

**See:** [Progressive Summarization](https://fortelabs.com/blog/progressive-summarization-a-practical-technique-for-designing-discoverable-notes/) for full methodology.

---

## When in Doubt

**Ask yourself:**

1. Does this have a date/transaction? → **Record type** (meeting, booking, invoice)
2. Do I need to learn from this? → **Resource** (with source_format)
3. Is this for future reference only? → **Archive** or **Record**
4. Is this no longer relevant? → **Archive** or **Delete**

**Remember:** Resources are for **learning**, records are for **reference**.
