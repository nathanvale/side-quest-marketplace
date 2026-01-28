# Type Disambiguation

Clarifying Resources vs Records vs Other note types.

---

## Core Distinction

### Resources
**Purpose:** Knowledge to learn from
**Flow:** Capture → Enrich → Distill → Express
**Fields:** `source_format`, `url`, `distilled`, `summary`
**Lifecycle:** Created → Enriched → Distilled → Referenced in projects

**Key question:** "Do I need to extract insights from this?"

### Records
**Purpose:** Reference information about events/transactions
**Flow:** Capture → File → Retrieve when needed
**Fields:** Date-specific, transaction-specific, people-specific
**Lifecycle:** Created → Filed → Retrieved as needed

**Key question:** "Do I need to find the details of this event/transaction later?"

### Other
**Purpose:** Everything else (captures, logs, project notes)
**Flow:** Varies by type
**Fields:** Varies by type
**Lifecycle:** Varies by type

---

## Frontmatter Comparison

### Resource

```yaml
---
type: resource
source_format: article      # HOW it was captured (article/video/podcast)
title: "Progressive Summarization"
url: https://...
author: Tiago Forte
created: 2025-01-28
distilled: false           # Has it been distilled?
summary: ""                # Layer 4 summary
areas:
  - Productivity
  - Knowledge Management
---
```

**Characteristic fields:**
- `source_format` - Content delivery format
- `distilled` - Progressive summarization status
- `summary` - Executive summary in your words
- `url` - Source link for re-fetching

### Meeting

```yaml
---
type: meeting
title: "Sprint Planning Q1"
date: 2025-01-28
attendees:
  - Alice
  - Bob
agenda:
  - Review backlog
  - Set priorities
outcome: "Committed to 12 story points"
projects:
  - Launch Product
---
```

**Characteristic fields:**
- `date` - When it happened
- `attendees` - Who was there
- `agenda` - What was discussed
- `outcome` - What was decided

### Booking

```yaml
---
type: booking
title: "Flight to Sydney"
booking_type: flight
confirmation_number: ABC123
date_from: 2025-02-15
date_to: 2025-02-20
vendor: Qantas
total_cost: 450.00
currency: AUD
projects:
  - Family Visit
---
```

**Characteristic fields:**
- `booking_type` - What kind of booking
- `confirmation_number` - Reference ID
- `date_from`/`date_to` - When it happens
- `vendor` - Who provided service
- `total_cost` - Financial transaction

### Invoice

```yaml
---
type: invoice
title: "Web Hosting - January"
invoice_number: INV-2025-001
vendor: Netlify
date_issued: 2025-01-15
date_due: 2025-01-30
total_amount: 19.00
currency: USD
payment_status: paid
areas:
  - Finances
---
```

**Characteristic fields:**
- `invoice_number` - Unique invoice ID
- `vendor` - Who sent invoice
- `date_issued`/`date_due` - Timeline
- `total_amount` - Amount owed/paid
- `payment_status` - Paid/unpaid

---

## Decision Matrix

| Type | Has Date? | Has Transaction? | Has Distillable Content? | Template |
|------|-----------|------------------|--------------------------|----------|
| **Resource** | No | No | ✅ Yes | `resource` |
| **Meeting** | ✅ Yes | No | Maybe (notes) | `meeting` |
| **Booking** | ✅ Yes | ✅ Yes | No | `booking` |
| **Invoice** | ✅ Yes | ✅ Yes | No | `invoice` |
| **Medical Statement** | ✅ Yes | ✅ Yes | No | `medical-statement` |
| **CV** | No | No | No (reference) | `cv` |
| **Letter** | ✅ Yes | No | No (reference) | `letter` |
| **Employment Contract** | ✅ Yes | ✅ Yes | No | `employment-contract` |
| **Capture** | No | No | Maybe (idea) | `capture` |

---

## Common Confusions

### "Meeting notes with insights" - Resource or Meeting?

**Answer:** Meeting

**Reasoning:**
- Primary purpose: Record the meeting
- Has attendees, date, agenda
- Insights are secondary

**However:** Extract key insights into separate Resource notes for distillation.

**Example:**
- Meeting note: `🗓️ Architecture Review - Jan 28.md`
- Extracted resource: `📄 Microservices Best Practices.md`

### "Conference talk recording" - Resource or Meeting?

**Answer:** Resource

**Reasoning:**
- No attendees (you watched alone)
- No agenda (structured presentation)
- Primary purpose: Learn from content

**Template:** `resource` with `source_format: video`

**Example:** `🎬 Emily Freeman - DevOps Culture.md`

### "Book with meeting notes" - Resource or Meeting?

**Answer:** Both (separate notes)

**Reasoning:**
- Book itself: Resource (distillable content)
- Book club discussion: Meeting (people, date, agenda)

**Example:**
- Resource: `📖 Building a Second Brain.md`
- Meeting: `🗓️ Book Club - BASB Chapter 3.md`

### "PDF invoice with payment guide" - Resource or Invoice?

**Answer:** Invoice (primary), optionally extract guide as Resource

**Reasoning:**
- Primary purpose: Record transaction
- Guide is secondary/supplementary

**Action:**
1. Create invoice note with transaction details
2. If guide is valuable, extract to separate Resource

### "Voice memo brainstorming session" - Resource or Capture?

**Answer:** Depends on length and content

**If meeting-like (>200 words, multiple topics):**
- Template: `meeting`
- Example: `🗓️ Product Ideas Brainstorm.md`

**If quick idea (<200 words, single topic):**
- Template: `capture`
- Example: `💡 App feature for notifications.md`

---

## Field Overlap Analysis

### Both Have `title`
- Resource: Content title ("Progressive Summarization")
- Meeting: Event description ("Sprint Planning Q1")
- Booking: What was booked ("Flight to Sydney")

**Different semantic meaning, same field name.**

### Both Have `date`/`created`
- Resource: When captured (metadata)
- Meeting: When it occurred (primary field)
- Booking: When it happens (primary field)

**Resources use `created`, Records use `date` or date-specific fields.**

### Both Have `areas`/`projects`
- Resource: What topics it relates to
- Meeting: What project it supports
- Booking: What project it's for

**Same field, different usage pattern.**

---

## Migration Path

### Old "Resource" (Actually a Meeting)

**Before:**
```yaml
---
type: resource
source_format: audio
title: "Team Standup Notes"
---
```

**After:**
```yaml
---
type: meeting
title: "Team Standup"
date: 2025-01-28
attendees: [Alice, Bob, Carol]
---
```

**How to detect:**
- Has attendees mentioned
- Has date in content
- Has action items
- Content is "notes" not "insights"

### Old "Meeting" (Actually a Resource)

**Before:**
```yaml
---
type: meeting
title: "AWS re:Invent Keynote"
---
```

**After:**
```yaml
---
type: resource
source_format: video
title: "AWS re:Invent 2024 Keynote"
url: https://youtube.com/...
---
```

**How to detect:**
- No attendees (watched alone)
- Not interactive (one-way presentation)
- Distillable content (insights to extract)
- Source URL available

---

## Quick Reference

**Use Resource when:**
- Content is distillable (article, video, podcast, book)
- Purpose is to extract insights
- No specific date/transaction
- Will apply progressive summarization

**Use Meeting when:**
- Event happened at specific time
- People were involved
- Has agenda/action items
- Purpose is to record what happened

**Use Booking/Invoice when:**
- Financial transaction occurred
- Has confirmation/invoice number
- Dates and amounts are primary
- Purpose is future reference

**Use Capture when:**
- Quick thought/idea
- No formal structure needed
- Might be temporary
- Purpose is fast capture

**When uncertain:** Default to Resource with `source_format: document`, refine during review.
