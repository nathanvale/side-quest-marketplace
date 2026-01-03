# Location-Based Organization Strategy

## For Your ADHD-Friendly Second Brain

---

## The Core Insight: Location = Type, Frontmatter = Organization

**Stop asking "where should this go?" The answer is always automatic.**

### The Simple Rule

| What You're Saving | Where It Goes | Every Single Time |
|-------------------|---------------|-------------------|
| Web clippings, articles, saved pages | `Resources/Clippings/` | No exceptions |
| Documents (DOCX, PDF, letters, CVs, invoices) | `Resources/Documents/` | No exceptions |
| Meeting notes, project plans, drafts | `Projects/[Project Name]/` | Only if project-born |

---

## Why This Works for ADHD

### The Problem with Traditional Organization

Every time you capture something, you face a decision tree:
- "Is this a project or an area?"
- "Which project does this belong to?"
- "Should I create a new folder or use existing?"
- "What if it's relevant to multiple things?"

**Each decision drains executive function.** With ADHD, these micro-decisions compound into capture avoidance.

### The Solution: Deterministic Location

**Location is determined by content TYPE, not content USE.**

| Question | Old Way (High Friction) | New Way (Zero Friction) |
|----------|------------------------|------------------------|
| Where does this CV go? | "Career? Job Search project? Applications folder?" | `Resources/Documents/` - done. |
| Where does this article go? | "Which topic? Which project? Interests?" | `Resources/Clippings/` - done. |
| Where does this invoice go? | "Finances? Business? Clients?" | `Resources/Documents/` - done. |

**You never decide WHERE. You only decide WHAT IT IS:**
- Clipping or document?
- That's it.

---

## The Two-Folder Resource Strategy

### Resources/Clippings/

**Everything from the web:**
- Articles you've read and highlighted
- Bookmarked pages
- Twitter threads
- Reddit posts
- YouTube video notes
- Blog posts
- Documentation pages
- Research papers (if web-sourced)

**All flat in one folder.** No subfolders.

```
Resources/Clippings/
├─ 2024-12-16 Progressive Summarization Explained.md
├─ 2024-12-18 ADHD and Executive Function Research.md
├─ 2024-12-20 Next.js App Router Migration Guide.md
├─ 2024-12-21 Parenting Tips for Difficult Transitions.md
└─ 2025-01-05 Semantic Search Implementation Tutorial.md
```

### Resources/Documents/

**Everything that arrived as a file:**
- CVs and resumes
- Cover letters
- Invoices
- Contracts
- Reports
- Forms
- Reference materials
- PDFs (non-web)
- Receipts
- Legal documents

**All flat in one folder.** No subfolders.

```
Resources/Documents/
├─ 2025-12-22 CV Master.md
├─ 2024-12-16 Letter Bunnings Followup.md
├─ 2025-12-15 Invoice ACME Corp.md
├─ 2024-11-20 Employment Contract Summary.md
├─ 2025-01-10 Tax Return 2024.md
└─ 2024-12-01 Health Insurance Policy.md
```

---

## Frontmatter Does All the Work

### The Magic of Links + Dataview

Your frontmatter creates the **logical organization** while location stays simple:

```yaml
---
type: document
doc_type: cv
area: [[Career]]
project: [[Job Search 2025]]
status: final
created: 2025-12-22
---
```

**This note lives in `Resources/Documents/` permanently.**

But it appears in:
- Your "Career" area dashboard (via `area: [[Career]]`)
- Your "Job Search 2025" project page (via `project: [[Job Search 2025]]`)
- Your "All Documents" dashboard (via `type: document`)
- Your "All CVs" view (via `doc_type: cv`)

**Same physical location. Multiple logical contexts.**

---

## How This Solves Common Problems

### Problem 1: "This is relevant to multiple projects"

**Old way:** Copy the file? Link to it? Move it later? Stress.

**New way:**
```yaml
project: [[Job Search 2025]]
project2: [[Career Development]]
area: [[Career]]
```

One file, multiple contexts. Lives in `Resources/Documents/` forever.

### Problem 2: "I need to reorganize my notes"

**Old way:** Spend hours moving files between folders, breaking links.

**New way:** Update frontmatter. That's it. Location never changes.

```yaml
# Changed from inactive to active project
project: [[House Renovation 2025]]  # was: [[House Ideas]]
status: active  # was: someday
```

File stays in `Resources/Documents/`. Dataview queries update instantly.

### Problem 3: "Where did I put that thing?"

**Old way:** Search through nested folders, try to remember your past organizational logic.

**New way:** 
- Clipping? It's in `Resources/Clippings/`
- Document? It's in `Resources/Documents/`
- Search or Dataview query finds it instantly

### Problem 4: "I'm archiving this project"

**Old way:** Untangle which files belong to the project, which are shared resources.

**New way:** 
1. Move `Projects/Job Search 2025/` to `Archives/`
2. Done.

All the CVs, letters, and research notes stay in `Resources/` where they belong, ready to be reused.

---

## The Complete Vault Structure

```
Your Vault/
├─ 00 Inbox/                    ← Temporary holding, processed weekly
├─ 1 Projects/
│   ├─ Job Search 2025/
│   │   ├─ _Project Plan.md     ← Dataview dashboard
│   │   ├─ Meeting - Recruiter Call.md
│   │   └─ Draft - Career Goals.md
│   └─ House Renovation 2025/
│       ├─ _Project Plan.md
│       └─ Meeting - Contractor.md
├─ 2 Areas/
│   ├─ Career/
│   │   └─ _Career Dashboard.md  ← Dataview dashboard
│   ├─ Health/
│   ├─ Finances/
│   └─ Relationships/
├─ 3 Resources/
│   ├─ Clippings/               ← ALL web content
│   │   ├─ [dated clippings...]
│   │   └─ [hundreds of files - that's fine!]
│   └─ Documents/               ← ALL documents
│       ├─ [dated documents...]
│       └─ [hundreds of files - that's fine!]
└─ 4 Archives/
    └─ [completed projects...]
```

---

## How Dataview Surfaces Everything

### On Your Job Search Project Page

```dataview
## Related Documents
TABLE doc_type, status, created
FROM "3 Resources/Documents"
WHERE project = [[Job Search 2025]]
SORT created DESC
```

**Shows:**
- All CVs tagged with this project
- All cover letters
- All application-related documents

**Even though they all live in `Resources/Documents/`**

### On Your Career Area Page

```dataview
## All Career Documents
TABLE doc_type, project, status
FROM "3 Resources/Documents"
WHERE area = [[Career]]
SORT created DESC
```

**Shows:**
- CVs (both master and tailored versions)
- Professional development certificates
- Performance reviews
- Contract summaries

**All from the same physical location**

### On Your Finances Area Page

```dataview
## Unpaid Invoices
TABLE amount, due, recipient
FROM "3 Resources/Documents"
WHERE area = [[Finances]] AND doc_type = "invoice" AND status = "unpaid"
SORT due ASC
```

```dataview
## All Financial Documents
TABLE doc_type, status, regarding
FROM "3 Resources/Documents"
WHERE area = [[Finances]]
SORT created DESC
```

---

## Migration Strategy

### If You Already Have Nested Folders

**Don't stress. Migrate gradually:**

1. **New captures starting today:** Use the two-folder structure
2. **When you access old files:** Move them to the appropriate location
3. **Let search handle the rest** until you naturally encounter files

**Don't do a "big bang" reorganization.** That's overhead with no ROI. Opportunistic migration only.

### Setting Up Fresh

1. Create `Resources/Clippings/`
2. Create `Resources/Documents/`
3. Done.

---

## Inbox Processing Workflow

### Every Capture Goes to Inbox First

```
00 Inbox/
├─ Quick thought about project.md
├─ Article from web.md
├─ bunnings-application.docx
└─ invoice-december.pdf
```

### Weekly Processing (5-10 minutes)

For each item:

1. **Is it a web clipping?**
   - Convert/move to `Resources/Clippings/`
   - Add frontmatter (area, project, type)
   - Delete from inbox

2. **Is it a document?**
   - Convert to markdown (if needed)
   - Move to `Resources/Documents/`
   - Add frontmatter
   - Delete from inbox

3. **Is it project-specific content?**
   - Move to appropriate project folder
   - Delete from inbox

4. **Is it a fleeting thought?**
   - Expand into a note, or
   - Add to existing note, or
   - Delete if no longer relevant

**Goal:** Empty inbox weekly. Takes 5-10 minutes when you have deterministic destinations.

---

## Property Standards for Each Type

### For Clippings

```yaml
---
type: clipping
source_url: https://...
captured: 2024-12-16
area: [[Career]]
project: [[Job Search 2025]]
tags: #progressive-summarization
---
```

### For Documents

```yaml
---
type: document
doc_type: cv | letter | invoice | contract
area: [[Career]]
project: [[Job Search 2025]]
status: draft | final | sent
created: 2024-12-16
---
```

---

## Key Principles

### 1. Location is Permanent
Files don't move after initial placement. Only frontmatter changes.

### 2. Flat is Better Than Nested
Both `Clippings/` and `Documents/` are flat. No subfolders. Dataview does the filtering.

### 3. Frontmatter Creates Structure
Properties define relationships. Dataview surfaces relevant content wherever you need it.

### 4. One File, Multiple Contexts
A single document can appear in multiple area dashboards, multiple project pages, via frontmatter.

### 5. Archive Projects, Not Resources
When projects complete, move the project folder. Resources stay put, ready for reuse.

### 6. Search Overcomes Scale
500 files in one folder? No problem. Obsidian search + Dataview + ChromaDB semantic search handle it.

---

## The ADHD Benefits

✅ **Zero "where does this go?" decisions** - it's always automatic  
✅ **No nested folder navigation** - everything is one level deep  
✅ **No reorganization required** - just update frontmatter  
✅ **Impossible to "misfile"** - only two possible locations  
✅ **Fast capture** - drop in inbox, process weekly in batch  
✅ **Multiple contexts without duplication** - frontmatter links  
✅ **Archive without untangling** - resources stay separate from projects  

---

## Common Questions

### "Won't I have hundreds of files in one folder?"

**Yes. And that's fine.**

- Obsidian search is instant even with thousands of files
- Dataview filters them by properties
- Semantic search finds them by meaning
- File explorer is sorted by date (most recent first)

You won't browse the folder - you'll search or use Dataview.

### "What about file naming?"

**Use date prefixes for chronological sorting:**
```
2024-12-16 Letter Bunnings Followup.md
2025-12-22 CV Master Version.md
2025-01-10 Invoice ACME Corp December.md
```

Format: `YYYY-MM-DD Descriptive Name.md`

### "Can I ever create subfolders?"

**Only if you have a genuinely massive collection of ONE TYPE.**

Example: If you have 500 invoices, you might do:
```
Resources/Documents/
└─ Invoices/
    ├─ 2024/
    └─ 2025/
```

But wait until you actually have the scale problem. Don't prematurely optimize.

### "What about templates and reusable resources?"

**Those live in their own top-level folder:**
```
Templates/
├─ Document Note Template.md
├─ Meeting Note Template.md
└─ Project Plan Template.md
```

Templates aren't "resources" - they're scaffolding for creation.

---

## Implementation Checklist

- [ ] Create `Resources/Clippings/` folder
- [ ] Create `Resources/Documents/` folder
- [ ] Update capture tools to default to Inbox
- [ ] Set weekly inbox processing time
- [ ] Create Dataview queries on project/area pages
- [ ] Start using - capture without overthinking
- [ ] Trust the system - search finds everything

---

## Key Takeaway

> **Your brain should never ask "where does this go?"**
> 
> The answer is always automatic:
> - From the web? → Clippings
> - A document? → Documents
> - Project-born? → Project folder
> 
> Frontmatter creates the organization.
> Location creates the simplicity.

This is the lowest-friction, most ADHD-friendly organizational structure possible while maintaining complete logical flexibility through Dataview.
