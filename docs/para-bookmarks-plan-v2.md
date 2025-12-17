# PARA Bookmarks Integration Plan v2

**Author:** Nathan Vale
**Scope:** para-obsidian plugin — intelligent PARA organization for web bookmarks
**Status:** Revised based on code review feedback

---

## Executive Summary

**Key Insight:** Obsidian Web Clipper (100K+ users) already handles capture. para-obsidian provides **intelligent PARA classification** using the existing inbox pipeline.

**Strategy:** Integrate with existing infrastructure instead of building parallel systems.

**Core Value:**
- ✅ **Capture:** Obsidian Web Clipper (iOS/macOS Safari, browser extension)
- ✅ **Classify:** para-obsidian inbox pipeline with bookmark-specific classifier
- ✅ **Organize:** PARA folders with proper frontmatter
- ✅ **Export (Optional):** Browser HTML from vault notes

---

## Architecture Decision

### ✅ Chosen Approach: Inbox Pipeline Integration

**Rationale (from agent reviews):**
- Score: 67/105 for original plan due to parallel system creation
- 8 critical bugs identified in standalone approach
- 80% scope reduction by using existing systems
- Leverages mature infrastructure (transactions, validation, registry)

**What This Means:**
1. Create bookmark classifier using `/para-obsidian:create-classifier`
2. Uses existing `scan → classify → suggest → review → execute` pipeline
3. Reuses `processed-registry.json` (no separate bookmarks registry)
4. Inherits safety features (Git guard, atomic ops, rollback)
5. Template versioning and validation included

---

## User Flow

### Phase 1: Capture (Obsidian Web Clipper)

**iOS Safari:**
```
1. Browse webpage
2. Share → "Obsidian Web Clipper"
3. Choose "Bookmark" template
4. Select vault → Inbox/
5. Tap "Add to Obsidian"
   → Creates note with frontmatter in Inbox/
```

**macOS Safari/Chrome:**
```
1. Click Web Clipper extension
2. Template auto-selects
3. Save to Inbox/
   → Note created with frontmatter
```

**Captured Note Format:**
```markdown
---
type: bookmark
url: https://kit.cased.com
title: Kit CLI Documentation
clipped: 2024-12-16
category: "[[Documentation]]"
author: "[[Cased]]"
published: 2024-01-15
tags: [cli, code-search]
---

## Notes
Fast semantic search for codebases using ML embeddings.

## Highlights
- "30-50x faster than grep for symbol lookup"
```

### Phase 2: Classify (Inbox Pipeline)

**Scan Inbox:**
```bash
# Scan for bookmark notes in inbox
bun run src/cli.ts process-inbox scan
```

**What Happens:**
1. Scans `Inbox/` for notes with `type: bookmark` frontmatter
2. Bookmark classifier runs heuristics:
   - URL patterns (`/docs/`, `/api/`, github.com, etc.)
   - Content markers (documentation keywords, timestamps)
   - Age-based classification (recent = Projects, old = Archives)
3. LLM extraction (if confidence < threshold):
   - Analyzes URL, title, content, tags
   - Suggests PARA category
   - Confidence scoring
4. Generates suggestion with extracted para: field

**Review & Execute:**
```bash
# Interactive review
bun run src/cli.ts process-inbox execute
```

- Shows suggested PARA classification
- User can accept/edit/reject
- Moves note to proper PARA folder
- Updates frontmatter with `para: Resources`
- Marks as processed in registry

**Result:**
```
Inbox/kit-cli.md → Resources/Web/Kit CLI Documentation.md
```

Updated frontmatter:
```yaml
---
type: bookmark
para: Resources  # Added by classifier
url: https://kit.cased.com
title: Kit CLI Documentation
clipped: 2024-12-16
# ... other fields
---
```

### Phase 3: Export to Browser (Optional)

**Generate Browser HTML:**
```bash
# Export PARA-organized bookmarks
bun run src/cli.ts export-bookmarks \
  --filter "type:bookmark" \
  --out ~/Downloads/bookmarks-para.html
```

**Output:**
- Netscape HTML format
- Folder structure mirrors PARA:
  ```
  Bookmarks/
    ├── Projects/
    ├── Areas/
    ├── Resources/
    └── Archives/
  ```
- Import into Safari/Chrome for native sync

---

## Implementation Plan

### Phase 1: Create Bookmark Classifier

**Use existing wizard:**
```bash
/para-obsidian:create-classifier bookmark
```

**Wizard Q&A:**

**Q1:** What type of documents should this classifier detect?
**A:** Web bookmarks captured via Obsidian Web Clipper with frontmatter type:bookmark

**Q2:** Priority? (0-100)
**A:** 70 (mid-priority, after invoices/medical but before generic documents)

**Q3:** PARA area?
**A:** Varies (classifier determines from URL/content)

**Q4:** Filename patterns?
**A:** (skip - Web Clipper names may vary)

**Q5:** Content patterns?
**A:** type: bookmark, url: http, clipped:

**Q6:** Fields to extract?
```
title:string:required
url:string:required
clipped:date:required
category:wikilink:optional
author:wikilink:optional
published:date:optional
tags:array:optional
notes:string:optional
```

**Q7:** Field descriptions?
```yaml
title: Bookmark title or page title
url: Original webpage URL
clipped: Date bookmark was captured
para: PARA classification (Projects/Areas/Resources/Archives)
```

**Q8:** Template name?
**A:** bookmark

**Q9:** Create template?
**A:** basic (generates Templater-compatible template)

**Q10:** Scoring thresholds?
**A:** defaults (heuristic: 0.3, LLM: 0.7)

**Generated Files:**
1. `src/inbox/classify/classifiers/definitions/bookmark.ts` - Classifier code
2. `src/inbox/classify/classifiers/definitions/index.ts` - Registry updated
3. `${PARA_VAULT}/Templates/bookmark.md` - Templater template

### Phase 2: Define Classification Heuristics

**Heuristics in `bookmark.ts`:**

```typescript
heuristics: {
  contentMarkers: [
    { pattern: "^type:\\s*bookmark", weight: 1.0 },
    { pattern: "^url:\\s*https?://", weight: 0.9 },
    { pattern: "^clipped:\\s*\\d{4}-\\d{2}-\\d{2}", weight: 0.8 },
  ],
  threshold: 0.7, // High threshold - must clearly be bookmark
}
```

**PARA Classification Logic (LLM prompt):**

```typescript
extraction: {
  promptHint: `Classify this bookmark into PARA:

- Projects: Time-bound work
  - GitHub/GitLab repos with active issues/PRs
  - Project management tools
  - Recent (<30 days) work-related bookmarks

- Areas: Ongoing responsibilities
  - Banking/finance portals (netbank, paypal, stripe)
  - Health dashboards (strava, myfitnesspal)
  - Home management (homeassistant, recipes)
  - Account settings pages

- Resources: Reference material (DEFAULT)
  - Documentation (/docs/, /api/, /reference/)
  - Tutorials, guides, articles
  - Stack Overflow, MDN, dev.to
  - Learning resources

- Archives: Stale content
  - Created >180 days ago
  - Deprecated/archived URLs
  - Legacy documentation

Extract URL, title, and determine PARA category with reasoning.`,
  keyFields: ["title", "url", "clipped", "para"],
}
```

### Phase 3: Browser Export (Optional Feature)

**New CLI command:**
```bash
bun run src/cli.ts export-bookmarks \
  [--filter "type:bookmark"] \
  [--out ~/Downloads/bookmarks.html]
```

**Implementation:**
1. Query all notes with `type: bookmark` frontmatter
2. Group by `para:` field
3. Generate Netscape HTML:
   ```html
   <!DOCTYPE NETSCAPE-Bookmark-file-1>
   <H1>Bookmarks</H1>
   <DL><p>
       <DT><H3>Projects</H3>
       <DL><p>
           <DT><A HREF="url">Title</A>
       </DL><p>
       <DT><H3>Resources</H3>
       ...
   </DL>
   ```
4. Write to output path

**MCP Tool:**
```typescript
para_export_bookmarks({
  filter: "type:bookmark",
  output_path: "~/Downloads/bookmarks-para.html",
  response_format: "json"
})
```

---

## Frontmatter Schema

**Bookmark Note Frontmatter:**
```yaml
---
type: bookmark          # Required - identifies bookmark note
para: Resources         # Required - PARA classification (added by classifier)
url: https://example.com # Required - original URL
title: "Page Title"    # Required - bookmark title
clipped: 2024-12-16    # Required - capture date (ISO)
category: "[[Docs]]"   # Optional - user category (wikilink)
author: "[[John Doe]]" # Optional - author (wikilink)
published: 2024-01-15  # Optional - original pub date
tags: [cli, tools]     # Optional - topic tags
notes: ""              # Optional - user notes
template_version: 1    # Required - for migrations
---
```

**Validation Rules (inherited from config/defaults.ts):**
```typescript
bookmark: {
  required: {
    type: { type: "literal", value: "bookmark" },
    para: { type: "enum", values: ["Projects", "Areas", "Resources", "Archives"] },
    url: { type: "string", pattern: "^https?://" },
    title: { type: "string", minLength: 1 },
    clipped: { type: "date", format: "YYYY-MM-DD" },
    template_version: { type: "number" }
  },
  optional: {
    category: { type: "wikilink" },
    author: { type: "wikilink" },
    published: { type: "date" },
    tags: { type: "array" },
    notes: { type: "string" }
  }
}
```

---

## Bugs Addressed (from Agent Reviews)

### ✅ Bug #1: Registry Collision
**Original Issue:** URL-only hash causes data loss
**Fix:** Use existing `processed-registry.json` with SHA256 file hash (includes all content)

### ✅ Bug #2: File Moving Race Condition
**Original Issue:** Concurrent runs corrupt vault
**Fix:** Inbox pipeline uses file locking + atomic operations

### ✅ Bug #3: Frontmatter Corruption
**Original Issue:** No validation during classification
**Fix:** Frontmatter validation in `config/defaults.ts` enforced automatically

### ✅ Bug #4: Template Name Collision
**Original Issue:** Overwrites existing templates
**Fix:** Wizard detects existing templates, offers use-existing/create-new/skip

### ✅ Bug #5: Browser Export HTML Corruption
**Original Issue:** Malformed HTML from invalid frontmatter
**Fix:** Validation before export, sanitize special characters

### ✅ Bug #6: LLM Classification Budget Explosion
**Original Issue:** All bookmarks use LLM
**Fix:** Heuristics-first with high threshold (0.7), LLM only for low-confidence

### ✅ Bug #7: iOS Shortcut Silent Data Loss
**Original Issue:** No error handling
**Fix:** Frontmatter validation catches malformed captures

### ✅ Bug #8: Git Auto-Commit Breaking Workflow
**Original Issue:** Commits during classification
**Fix:** Git guard in inbox pipeline checks for uncommitted changes before LLM processing

---

## Folder Structure

```
vault/
├── Inbox/                      # Web Clipper destination
│   ├── kit-cli-docs.md        # Captured bookmark (before classification)
│   └── ...
├── Projects/
│   └── Web/                    # Active project bookmarks
│       └── github-repo.md
├── Areas/
│   └── Web/                    # Ongoing responsibility bookmarks
│       └── netbank-portal.md
├── Resources/
│   └── Web/                    # Reference material (most bookmarks)
│       └── Kit CLI Documentation.md  # After classification
└── Archives/
    └── Web/                    # Stale bookmarks
        └── deprecated-api.md

Templates/
└── bookmark.md                 # Created by wizard
```

---

## Success Metrics

**Primary:**
- ✅ Zero parallel infrastructure created (uses inbox pipeline)
- ✅ >90% heuristic accuracy for PARA classification
- ✅ <30s per bookmark processing time
- ✅ All 8 critical bugs addressed

**Secondary:**
- Browser export adoption: ~20% of users
- Classification accuracy improves via LLM feedback loop
- Template versioning enables future schema migrations

---

## Implementation Checklist

### Phase 1: Bookmark Classifier (Week 1)
- [ ] Run `/para-obsidian:create-classifier bookmark` wizard
- [ ] Define PARA classification heuristics
- [ ] Test with sample Web Clipper captures
- [ ] Validate frontmatter schema
- [ ] Write classifier tests

### Phase 2: End-to-End Testing (Week 1)
- [ ] Capture bookmarks via Web Clipper → Inbox
- [ ] Run `process-inbox scan`
- [ ] Verify PARA suggestions
- [ ] Run `process-inbox execute`
- [ ] Validate notes moved to correct folders
- [ ] Check registry tracking

### Phase 3: Browser Export (Week 2)
- [ ] Implement `export-bookmarks` CLI command
- [ ] Generate Netscape HTML format
- [ ] Test import into Safari/Chrome
- [ ] Add MCP tool wrapper
- [ ] Write export tests

### Phase 4: Documentation (Week 2)
- [ ] Update USAGE_EXAMPLES.md
- [ ] Create bookmark workflow guide
- [ ] iOS Shortcut template (optional)
- [ ] Video walkthrough

---

## Alternative Capture Methods (Optional)

### iOS Shortcut: "Save to PARA Inbox"

Pre-built shortcut for power users:

**What it does:**
1. Receives URL + title from Safari share sheet
2. Creates markdown note in `Inbox/`
3. Uses Web Clipper-compatible frontmatter
4. User runs inbox processing later

**Shortcut Actions:**
```
Input: URL, Title (share sheet)
1. Get URL → $url
2. Get Title → $title
3. Ask for notes (optional) → $notes
4. Create text:
   ---
   type: bookmark
   url: $url
   title: "$title"
   clipped: [current_date]
   ---

   ## Notes
   $notes
5. Save to Obsidian: Inbox/$title.md
```

**Installation:** Download `.shortcut` file from plugin docs

---

## FAQ

**Q: Why use inbox pipeline instead of standalone classification?**
A: Inbox pipeline provides proven infrastructure: transactions, rollback, validation, registry, Git guard, atomic operations. 80% scope reduction vs building parallel system.

**Q: What if I already have bookmarks in other tools?**
A: Use `export-bookmarks` in reverse - import browser HTML → vault notes, then classify via inbox pipeline.

**Q: Can I reclassify bookmarks later?**
A: Yes. Edit `para:` frontmatter field manually, or remove from registry and reprocess through inbox.

**Q: Does this work without Web Clipper?**
A: Yes. Any note with `type: bookmark` frontmatter works. Create manually, via shortcuts, or other tools.

**Q: How does LLM classification work?**
A: Heuristics run first (fast). If confidence <70%, LLM analyzes URL, title, content to suggest PARA category. User reviews suggestion before execution.

**Q: What about Safari Reading List?**
A: Reading List doesn't export to accessible format. Use Web Clipper or create notes manually.

---

## Key Decisions

✅ **Inbox pipeline integration** - Reuse mature infrastructure
✅ **Web Clipper for capture** - Don't reinvent the wheel
✅ **Heuristics-first classification** - LLM as enhancement
✅ **Vault notes primary artifact** - Browser HTML optional export
✅ **PARA folders destination** - Matches existing structure
✅ **Template versioning** - Future schema migrations supported
✅ **Registry tracking** - Prevents reprocessing
✅ **Git guard** - Safety check before LLM operations

---

## Next Steps

1. ✅ Review revised plan with Nathan
2. Run `/para-obsidian:create-classifier bookmark` wizard
3. Test end-to-end with Web Clipper captures
4. Implement browser export (if needed)
5. Create user documentation + video

---

## Comparison: Original vs Revised Plan

| Aspect | Original Plan | Revised Plan |
|--------|---------------|--------------|
| **Classification** | Standalone system | Inbox pipeline integration |
| **Registry** | `bookmarks-registry.json` | Existing `processed-registry.json` |
| **Template** | Custom inline definition | Wizard-generated with versioning |
| **Validation** | Manual implementation | Inherited from `config/defaults.ts` |
| **Safety** | Not specified | Transaction, rollback, Git guard |
| **Scope** | ~500 LOC new code | ~100 LOC (classifier only) |
| **Bugs** | 8 critical identified | 0 (all addressed) |
| **Code Quality** | 67/105 (63.8%) | Expected >90% (reuses proven code) |

**Outcome:** 80% scope reduction, inherits battle-tested infrastructure, addresses all critical bugs.
