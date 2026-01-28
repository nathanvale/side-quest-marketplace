# Classification Decision Tree

Flowchart for inbox → PARA routing decisions.

---

## High-Level Flow

```
Inbox Item
    ↓
Has date/transaction? ───YES──→ Record Type
    ↓ NO                          (meeting, booking, invoice)
    ↓
Knowledge to distill? ───YES──→ Resource
    ↓ NO                          (article, video, podcast)
    ↓
Still relevant? ──────YES──→ Area-specific note
    ↓ NO                          (health log, finance note)
    ↓
Archive or Delete
```

---

## Step 1: Has Date/Transaction?

**Look for:**
- Specific dates (appointment, deadline, event)
- Transaction details (amount, confirmation number, vendor)
- People involved (attendees, participants)
- Time-bound information

**If YES → Record Type**

Route to appropriate record template:

| Indicators | Template | Note Type |
|------------|----------|-----------|
| Attendees, agenda, action items | `meeting` | Meeting notes |
| Confirmation number, dates, prices | `booking` | Travel/event booking |
| Amount, vendor, invoice number | `invoice` | Invoice/receipt |
| Test results, provider, dates | `medical-statement` | Medical record |
| Employment terms, salary, start date | `employment-contract` | Employment record |
| Formal letterhead, recipient | `letter` | Correspondence |

**If NO → Continue to Step 2**

---

## Step 2: Knowledge to Distill?

**Ask:** "Do I need to **learn** from this content?"

**Look for:**
- Articles, blog posts, tutorials
- Videos, courses, talks
- Podcasts, audio content
- Books, research papers
- Thread summaries, documentation

**If YES → Resource**

Determine `source_format`:

| Content Type | source_format | Emoji |
|--------------|---------------|-------|
| Web article, blog | `article` | 📰 |
| YouTube, Vimeo | `video` | 🎬 |
| Podcast episode | `podcast` | 🎙️ |
| Twitter/X thread | `thread` | 🧵 |
| Book notes | `book` | 📖 |
| Online course | `course` | 🎓 |
| Generic audio | `audio` | 🎧 |
| Research paper | `paper` | 📑 |
| PDF/DOCX document | `document` | 📄 |
| Screenshot, diagram | `image` | 🖼️ |

**Resource flow:**
```
Create → Enrich (fetch content) → Distill (extract insights)
```

**If NO → Continue to Step 3**

---

## Step 3: Still Relevant?

**Ask:** "Does this serve an ongoing area of responsibility?"

**Examples:**
- Health logs (symptom tracking, fitness data)
- Financial records (budget tracking, expenses)
- Career notes (performance reviews, goals)
- Relationship notes (gift ideas, important dates)

**If YES → Area-specific note**

Create in appropriate area folder with relevant template.

**If NO → Continue to Step 4**

---

## Step 4: Archive or Delete

**Archive if:**
- Historical value (might need later)
- Completed project documentation
- Past records worth keeping

**Delete if:**
- Duplicate content
- Spam/junk
- Irrelevant capture
- Outdated information with no value

---

## Special Cases

### Bookmarks

**Web clipper bookmarks** are a special case:

```
Bookmark (from Web Clipper)
    ↓
Has substantial content? ───YES──→ Resource
    ↓ NO                            (distillable article)
    ↓
Just a link/placeholder? ───YES──→ Archive or Delete
```

**Indicators of substantial content:**
- Article text included
- Video transcript available
- Thread content captured
- PDF/document attached

**Indicators of placeholder:**
- URL only, no content
- "Read later" with no context
- Broken link
- Duplicate of existing resource

### Voice Memos

**Voice memo transcriptions:**

```
Voice Memo
    ↓
Meeting/discussion? ────YES──→ Meeting note
    ↓ NO                         (attendees, topics, action items)
    ↓
Quick capture? ─────────YES──→ Capture note
                                 (idea, thought, reminder)
```

**Length heuristic:**
- \>200 words → Likely meeting/discussion
- <200 words → Likely quick capture

### Documents (PDF/DOCX)

**Document attachments:**

```
Document
    ↓
Type identifiable? ────YES──→ Use specific classifier
    ↓ NO                        (invoice, CV, contract, letter)
    ↓
Generic content ───────YES──→ Generic document classifier
```

**Classifier cascade:**
1. Try specific classifiers (invoice, booking, medical)
2. Fall back to generic document classifier
3. Extract text and use LLM classification

---

## Classification Confidence

**High confidence (use classifier):**
- Clear template match (invoice, booking, CV)
- Filename patterns match
- Content patterns match

**Medium confidence (review required):**
- Partial matches
- Ambiguous content type
- Multiple possible classifications

**Low confidence (LLM fallback):**
- No classifier match
- Unclear content type
- Generic/complex document

**Always show confidence and reasoning to user for review.**

---

## Decision Matrix

| Has Date? | Distillable? | Template | Note Type |
|-----------|--------------|----------|-----------|
| ✅ | ❌ | meeting, booking, invoice | Record |
| ❌ | ✅ | resource | Resource |
| ❌ | ❌ | area-specific or archive | Other |
| ✅ | ✅ | (Rare) Choose based on primary purpose | Depends |

**Edge case (both yes):** Ask user - "Is this primarily a record of an event, or knowledge to learn from?"

---

## Quick Reference

**→ Meeting:** Attendees, agenda, action items, date
**→ Booking:** Confirmation, dates, prices, vendor
**→ Invoice:** Amount, invoice number, due date, vendor
**→ Resource:** Article, video, podcast, book (distillable)
**→ Capture:** Quick thought, idea, reminder (from voice)
**→ Archive:** No longer active, historical value only
**→ Delete:** No value, duplicate, spam

**When uncertain:** Default to Resource with generic `document` source_format, let user refine during review.
