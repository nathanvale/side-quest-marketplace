# Document Notes in Your Second Brain

A complete guide for handling documents (letters, CVs, invoices, contracts, etc.) in your Obsidian-based Second Brain system.

---

## Core Principle: Markdown > Binary Files

**Convert DOCX/PDF to markdown whenever possible** for:
- Full-text searchability (Obsidian + semantic search)
- Block-level linking capability
- In-app editing without context switching
- Future-proof plain text format
- Dataview query integration

---

## Property Reference

### Required Properties

| Property | Purpose | Example |
|----------|---------|---------|
| `type` | Always "document" | `document` |
| `doc_type` | Specific document kind | `letter`, `cv`, `invoice`, `contract` |
| `created` | Creation date | `2025-12-22` |

### Contextual Properties

| Property | When to Use | Example |
|----------|-------------|---------|
| `area` | Relates to ongoing responsibility | `[[Career]]`, `[[Finances]]` |
| `project` | Relates to time-bound goal | `[[Job Search 2025]]` |
| `status` | Document lifecycle stage | `draft`, `final`, `sent`, `signed` |
| `recipient` | Who it's addressed to | `Bunnings HR`, `ACME Corp` |
| `sender` | Who sent it (if not you) | `Nathan Vale`, `Tax Office` |
| `date_sent` | When sent/received | `2024-12-16` |
| `regarding` | Quick subject | `Follow-up application`, `Q4 Invoice` |
| `version` | Version tracking | `2025-v1`, `draft-2` |

### Document-Specific Properties

| Property | Doc Types | Purpose |
|----------|-----------|---------|
| `amount` | invoices | Invoice total |
| `due` | invoices | Payment due date |
| `invoice_number` | invoices | Invoice identifier |
| `original_file` | all | Attachment filename |
| `source_format` | all | Origin format (docx/pdf/original) |

---

## Document Type Guide

### Letters (`doc_type: letter`)

**Convert to markdown:** ✅ Yes  
**Keep original:** ✅ For records

```yaml
doc_type: letter
area: [[Career]]
project: [[Job Search 2025]]
recipient: Company Name
date_sent: 2024-12-16
regarding: Application follow-up
```

**When to create:**
- Cover letters
- Follow-up correspondence
- Formal communications
- Business letters

---

### CVs/Resumes (`doc_type: cv`)

**Convert to markdown:** ✅ Yes  
**Keep DOCX:** ✅ For sending

```yaml
doc_type: cv
area: [[Career]]
version: 2025-v1
regarding: AI/ML roles
```

**Strategy:**
- Master CV in markdown (easy editing)
- Keep DOCX synced (employers expect .docx)
- Clone for company-specific versions
- Track tailored versions in "Related" section

---

### Invoices (`doc_type: invoice`)

**Convert to markdown:** ✅ Yes  
**Keep original:** Optional

```yaml
doc_type: invoice
area: [[Finances]]
status: unpaid
amount: 4500
due: 2025-12-30
invoice_number: NV-2025-012
recipient: Client Name
```

**Track:**
- Payment status
- Due dates
- Client relationship
- Revenue by period

---

### Contracts (`doc_type: contract`)

**Convert to markdown:** ⚠️ Summary only  
**Keep original:** ✅ Essential (legal validity)

```yaml
doc_type: contract
area: [[Business]]
status: signed
party: ACME Corporation
effective_date: 2025-01-01
expiry_date: 2026-01-01
```

**Strategy:**
- Keep legal document as DOCX/PDF
- Create markdown summary note
- Track key dates and obligations

---

### Reports (`doc_type: report`)

**Convert to markdown:** ✅ Yes  
**Keep original:** Optional

```yaml
doc_type: report
project: [[Q4 Performance Review]]
status: final
date_sent: 2025-12-15
```

---

### Forms (`doc_type: form`)

**Convert to markdown:** ❌ No (needs editing in Word)  
**Keep original:** ✅ Yes

```yaml
doc_type: form
status: incomplete
original_file: benefits-enrollment.docx
due: 2025-01-15
```

**Strategy:**
- Link to DOCX in lightweight markdown note
- Track completion status
- Note deadline and requirements

---

## File Organization Strategy

### The ADHD-Friendly Approach

**Don't move files between folders.** Use frontmatter + Dataview instead.

| Content Type | Default Location | Why |
|--------------|------------------|-----|
| Meeting notes, drafts, plans | Project folder | Project-born content |
| Research, references, documents | Resources (or Inbox) | Reusable, multi-purpose |

### Linking vs. Moving

```yaml
# This note stays in Resources/Documents
# But appears in project via Dataview query
project: [[Job Search 2025]]
area: [[Career]]
```

**Benefits:**
- No "where should this go?" decisions
- Documents can serve multiple projects
- Archive project without untangling resources

---

## Dataview Queries

### All Documents Dashboard

```dataview
TABLE doc_type, status, created, regarding
FROM ""
WHERE type = "document"
SORT created DESC
```

### Project-Specific Documents

```dataview
TABLE doc_type, status, date_sent, regarding
FROM ""
WHERE type = "document" AND project = [[Job Search 2025]]
SORT created DESC
```

### Unpaid Invoices

```dataview
TABLE amount, due, recipient, file.link as "Invoice"
FROM ""
WHERE type = "document" AND doc_type = "invoice" AND status = "unpaid"
SORT due ASC
```

### Recent CVs and Letters

```dataview
TABLE version, status, recipient, regarding
FROM ""
WHERE type = "document" AND (doc_type = "cv" OR doc_type = "letter")
SORT modified DESC
LIMIT 10
```

### Documents by Type

```dataview
TABLE status, created, regarding
FROM ""
WHERE type = "document" AND doc_type = "invoice"
SORT created DESC
```

### Documents Needing Action

```dataview
TABLE doc_type, due, regarding
FROM ""
WHERE type = "document" AND (status = "draft" OR status = "unpaid")
SORT due ASC
```

---

## Workflow

### 1. Document Arrives (DOCX in Inbox)

**Inbox processor detects:**
- Document type (CV, letter, invoice, etc.)
- Suggested area/project
- Whether to convert to markdown

### 2. Convert to Markdown

**Using pandoc or similar:**
```bash
pandoc input.docx -o output.md
```

### 3. Create Note with Template

- Use appropriate doc_type template
- Add frontmatter properties
- Include Summary and Key Points sections
- Paste converted markdown content

### 4. Handle Original File

| Doc Type | Action |
|----------|--------|
| Letters | Keep for records |
| CVs | Keep for sending |
| Invoices | Optional (can delete) |
| Contracts | **Must keep** (legal) |
| Reports | Optional |
| Forms | **Must keep** (for editing) |

### 5. Link to Projects/Areas

Add to frontmatter:
```yaml
area: [[Career]]
project: [[Job Search 2025]]
```

Project dashboard will automatically surface via Dataview.

---

## Progressive Summarization for Documents

Apply layers as you revisit:

**Layer 1:** Full converted markdown  
**Layer 2:** Bold key passages (when reviewing for project)  
**Layer 3:** Highlight critical points (on subsequent review)  
**Layer 4:** Write summary (for frequently-used documents)

**Don't summarize on a schedule** - do it opportunistically when already working with the document.

---

## Common Patterns

### Job Application Documents

```
Resources/Documents/
├─ CV Master 2025.md (master version)
├─ CV - Bunnings 2024-12.md (tailored)
├─ Letter - Bunnings Follow-up.md
└─ Letter - Google Application.md

All linked via:
project: [[Job Search 2025]]
```

### Client Invoices

```
Resources/Documents/Invoices/
├─ Invoice - ACME 2025-12.md
├─ Invoice - Widget Co 2025-11.md

All linked via:
area: [[Finances]]
```

### Legal Documents

```
Resources/Documents/Legal/
├─ Employment Contract Summary.md (markdown)
│   └─ Links to: employment-contract.pdf
├─ Lease Agreement Summary.md (markdown)
    └─ Links to: lease-agreement.pdf
```

---

## Key Takeaways

✅ **Do:**
- Convert to markdown for searchability
- Use frontmatter for structured data
- Link to projects/areas, don't move files
- Keep originals only when necessary
- Apply Progressive Summarization opportunistically
- Let Dataview surface documents dynamically

❌ **Don't:**
- Keep binary formats when markdown works
- Over-organize with complex folder structures
- Move files between folders repeatedly
- Summarize documents you never use
- Duplicate content across multiple locations

---

## Integration with Your Second Brain

### Capture
Documents arrive via email, downloads, or creation → Inbox

### Organize
Add frontmatter properties → Link to area/project → Leave in Resources

### Distill
Apply Progressive Summarization layers when reviewing for projects

### Express
Reuse document content as Intermediate Packets in new projects

---

This system balances:
- **Capture speed** (quick processing from inbox)
- **Searchability** (markdown + semantic search)
- **Relationships** (area/project linking via Dataview)
- **Reusability** (documents serve multiple contexts)
- **ADHD-friendly** (minimal decisions, clear structure)
