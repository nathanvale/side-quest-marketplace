# PARA Bookmarks Integration Plan (Revised)

Author: Nathan Vale
Scope: para-obsidian plugin — intelligent PARA organization for web bookmarks captured via Obsidian Web Clipper

---

## Strategy Shift: Organization, Not Capture

**Key Insight:** Obsidian Web Clipper (official, 100K+ users) already solved capture perfectly. para-obsidian should be the **intelligence layer** that organizes captured bookmarks into PARA structure.

**Core Value Proposition:**
- **Capture:** Users use Obsidian Web Clipper (iOS/macOS Safari share sheet, browser extension)
- **Classify:** para-obsidian provides intelligent PARA organization (heuristics + optional LLM)
- **Organize:** Moves notes to correct PARA folders, updates frontmatter, maintains links
- **Export (Optional):** Generate browser HTML from vault notes for native bookmark sync

---

## Defaults (Revised)

- **Primary artifact:** Vault notes (Markdown files with frontmatter: `type: bookmark`, `para: Resources`)
- **Capture method:** Obsidian Web Clipper (user installs from App Store/Chrome Store)
- **Classification:** Heuristics-first, `--use-llm` opt-in for low-confidence items
- **State tracking:** `bookmarks-registry.json` (tracks URL hashes, prevents reprocessing)
- **UX:** Non-interactive fast path; `--review` flag for approval/move UI
- **Browser export:** Optional HTML generation from vault notes (secondary feature)
- **Delivery order:** CLI first, MCP second, iOS Shortcut template third

---

## End-to-End User Flow

### **Phase 1: Capture (User's Choice)**

**Option A: Obsidian Web Clipper (Recommended)**

**iOS Safari:**
```
1. Browse webpage
2. Tap Share → "Obsidian Web Clipper"
3. Choose template (Bookmark, Article, Recipe, etc.)
4. Select vault + folder (default: Inbox/Bookmarks/)
5. Tap "Add to Obsidian"
→ Markdown note created in vault
```

**macOS Safari/Chrome:**
```
1. Browse webpage
2. Click Web Clipper extension icon
3. Template auto-applies (based on URL rules)
4. Select vault/folder
5. Click save
→ Markdown note in vault
```

**Output (Web Clipper Bookmark Template):**
```markdown
---
type: bookmark
url: https://kit.cased.com
title: Kit CLI Documentation
author: Cased
published: 2024-01-15
category: Resources
tags: [cli, code-search]
---

## Notes
Fast semantic search for codebases using ML embeddings.

## Highlights
- "30-50x faster than grep for symbol lookup"
- Uses tree-sitter for AST parsing
```

**Option B: iOS Shortcut (Optional - Power Users)**

We provide pre-built shortcut: **"Save to PARA Inbox"**
- Uses same frontmatter format as Web Clipper
- Saves to `Inbox/Bookmarks/`
- Optional: Can prompt for PARA category during capture

---

### **Phase 2: Classify (para-obsidian Plugin)**

**Batch Classification:**
```bash
# Classify all bookmarks in Inbox
/para-obsidian:classify-bookmarks

# CLI version
bun run cli.ts para classify-bookmarks \
  --source "Inbox/Bookmarks/" \
  --review  # Optional: Review before moving

# With LLM assist
bun run cli.ts para classify-bookmarks \
  --source "Inbox/" \
  --use-llm  # Low-confidence items use LLM
```

**What It Does:**
1. Scans vault for notes with `type: bookmark` frontmatter
2. Applies heuristics to classify into PARA:
   - **Projects:** GitHub repos, time-bound keywords, recent captures (<30 days)
   - **Areas:** Banking/finance, health, recurring domains
   - **Resources:** Documentation URLs (`/docs/`, `/api/`), reference sites
   - **Archives:** Old captures (>180 days), explicit archive markers
3. (Optional) LLM classifies low-confidence items
4. Moves notes to correct PARA folders:
   - `Projects/Web/`, `Areas/Web/`, `Resources/Web/`, `Archives/Web/`
5. Updates frontmatter: `para: Resources`
6. Updates registry to skip reprocessing

**Review Mode (`--review`):**
- Shows proposed classifications in terminal UI
- User can accept/reject/move individual bookmarks
- Confirms before applying changes

---

### **Phase 3: Export to Browser (Optional)**

**Generate Browser HTML:**
```bash
# Export PARA-organized bookmarks to browser HTML
/para-obsidian:export-bookmarks-to-browser

# CLI version
bun run cli.ts para export-to-browser \
  --filter "type:bookmark" \
  --out ~/Downloads/bookmarks-para.html
```

**What It Does:**
1. Reads all vault notes with `type: bookmark`
2. Groups by `para:` frontmatter field
3. Generates Netscape HTML with PARA folder structure:
   ```
   Bookmarks/
     ├── Projects/
     ├── Areas/
     ├── Resources/
     └── Archives/
   ```
4. User imports HTML into Safari/Chrome
5. Native bookmarks now mirror PARA structure

---

## CLI Surface (Revised)

### **Core Commands**

```bash
# Classify bookmarks from Inbox → PARA folders
para classify-bookmarks \
  --source "Inbox/Bookmarks/" \
  [--review] \
  [--use-llm] \
  [--dry-run]

# Quick capture (creates bookmark note in Inbox)
para create-bookmark \
  --url "https://example.com" \
  --title "Example Site" \
  [--notes "My thoughts..."] \
  [--tags "cli,tools"]

# Export vault bookmarks to browser HTML
para export-to-browser \
  [--filter "type:bookmark"] \
  [--out ~/Downloads/bookmarks-para.html]

# Import browser HTML → vault notes (batch migration)
para import-from-browser \
  --input bookmarks.html \
  --dest "Inbox/Bookmarks/"
```

### **Utility Commands**

```bash
# Show bookmark stats
para bookmark-stats
→ Total: 347 | Projects: 23 | Areas: 45 | Resources: 256 | Archives: 23

# Find unclassified bookmarks
para find-unclassified
→ Lists notes with type:bookmark but no para: field

# Rebuild registry (force reprocessing)
para rebuild-registry
```

---

## MCP Surface (Mirrors CLI)

```typescript
// Classify bookmarks
para_bookmarks_classify({
  source: "Inbox/Bookmarks/",
  review: false,
  use_llm: false,
  dry_run: false,
  response_format: "json"
})

// Create bookmark note
para_bookmarks_create({
  url: "https://kit.cased.com",
  title: "Kit CLI",
  notes: "Fast code search",
  tags: ["cli", "tools"],
  response_format: "json"
})

// Export to browser
para_bookmarks_export_to_browser({
  filter: "type:bookmark",
  output_path: "~/Downloads/bookmarks-para.html",
  response_format: "json"
})

// Import from browser
para_bookmarks_import_from_browser({
  input_path: "~/Downloads/bookmarks.html",
  destination: "Inbox/Bookmarks/",
  response_format: "json"
})

// Stats
para_bookmarks_stats({
  response_format: "json"
})
```

---

## Heuristics Engine

### **Classification Rules (Priority Order)**

**1. Projects (Time-Bound Work)**
- URL contains: `/issues/`, `/pull/`, `/projects/`, `/milestones/`
- GitHub/GitLab repo URLs
- Created within last 30 days + work-related keywords
- Title matches: "Sprint", "Roadmap", "Planning", "Q1", "Q2", etc.

**2. Areas (Ongoing Responsibilities)**
- URL contains: `/dashboard/`, `/account/`, `/settings/`
- Banking/finance: `netbank`, `commbank`, `paypal`, `stripe`
- Health/fitness: `strava`, `myfitnesspal`, `health`
- Home/family: `homeassistant`, `recipes`, `calendar`
- Keywords: "Portal", "Admin", "Management"

**3. Resources (Reference Material)**
- URL contains: `/docs/`, `/documentation/`, `/api/`, `/reference/`, `/guide/`
- Domain ends in: `.dev`, `.io`, `/wiki/`
- Title contains: "Tutorial", "Guide", "Documentation", "API", "Reference"
- Stack Overflow, MDN, dev.to, Medium articles

**4. Archives (Stale/Completed)**
- Created >180 days ago
- URL contains: `/archive/`, `/deprecated/`
- Title contains: "Archive", "Old", "Legacy", "Deprecated"

**5. Default → Resources**
- If no heuristic matches, default to Resources
- LLM can override if `--use-llm` enabled

---

## LLM Integration (Opt-In)

**When to Use LLM:**
- Heuristic confidence <70%
- User passes `--use-llm` flag
- Ambiguous URLs (personal blog posts, generic sites)

**LLM Prompt:**
```
Classify this bookmark into PARA categories:
- Projects: Time-bound work (e.g., client projects, events, goals with deadlines)
- Areas: Ongoing responsibilities (e.g., health, finance, home, career)
- Resources: Reference material (e.g., docs, tutorials, articles to reference later)
- Archives: Inactive/stale content

URL: {url}
Title: {title}
Created: {created_date}
Notes: {notes}

Return JSON: {"para": "Resources", "confidence": 0.85, "reasoning": "..."}
```

**LLM Provider:** Local via Ollama (default), or user-configured LLM

---

## State Management

### **Registry Format: `bookmarks-registry.json`**

```json
{
  "version": "1.0.0",
  "last_updated": "2024-01-15T10:30:00Z",
  "bookmarks": {
    "url-hash-abc123": {
      "url": "https://kit.cased.com",
      "title": "Kit CLI Documentation",
      "para": "Resources",
      "vault_path": "Resources/Web/Kit CLI Documentation.md",
      "classified_at": "2024-01-15T10:00:00Z",
      "method": "heuristic",
      "confidence": 0.95
    }
  }
}
```

**Purpose:**
- Prevents reprocessing same bookmarks
- Tracks classification history
- Supports incremental updates
- Isolated from inbox registry

---

## Integration with para-obsidian

### **Template: `templates/bookmark.md`**

```markdown
---
type: bookmark
url: {{url}}
title: {{title}}
author: {{author}}
published: {{published}}
category: {{category}}
tags: {{tags}}
para: {{para}}
created: {{date}}
---

## Notes
{{notes}}

## Highlights
{{highlights}}
```

### **Folder Structure**

```
vault/
├── Inbox/
│   └── Bookmarks/              # Web Clipper captures here
├── Projects/
│   └── Web/                    # Classified bookmarks
├── Areas/
│   └── Web/
├── Resources/
│   └── Web/
└── Archives/
    └── Web/
```

### **Frontmatter Convention**

```yaml
type: bookmark               # Identifies as bookmark note
para: Resources              # PARA classification
url: https://example.com     # Original URL
title: Example Site          # Page title
author: John Doe             # Optional
published: 2024-01-15        # Optional
category: Documentation      # Optional
tags: [cli, tools]           # Optional
```

---

## iOS Shortcut Template (Optional)

**Provide pre-built shortcut:** "Save to PARA Inbox"

**What it does:**
1. Receives URL + title from Safari share sheet
2. Prompts: "Add notes?" (optional text input)
3. Creates Markdown note in `Inbox/Bookmarks/`
4. Uses Web Clipper-compatible frontmatter format
5. User later runs `/para-obsidian:classify-bookmarks`

**Shortcut Config:**
```
Input: URL, Title (from share sheet)
Actions:
1. Get URL → Set Variable: bookmark_url
2. Get Title → Set Variable: bookmark_title
3. Ask for Input → "Notes (optional)" → Set Variable: notes
4. Text:
   ---
   type: bookmark
   url: [bookmark_url]
   title: [bookmark_title]
   created: [current_date]
   ---

   ## Notes
   [notes]
5. Save File → Obsidian vault: Inbox/Bookmarks/[title].md
```

**Installation:** User downloads `.shortcut` file from plugin docs

---

## Implementation Phases

### **Phase 1: Core Classification (Week 1-2)**
- [ ] Heuristics engine (Projects, Areas, Resources, Archives)
- [ ] CLI: `para classify-bookmarks`
- [ ] Registry management
- [ ] Frontmatter updates
- [ ] File moving logic
- [ ] Tests

### **Phase 2: Review UI (Week 2-3)**
- [ ] `--review` terminal UI (simple list + accept/reject)
- [ ] Show proposed classifications
- [ ] Allow manual reassignment
- [ ] Confirm before moving files

### **Phase 3: LLM Integration (Week 3)**
- [ ] `--use-llm` flag
- [ ] Ollama integration (local LLM)
- [ ] Confidence scoring
- [ ] Flag LLM-classified items in frontmatter

### **Phase 4: Utilities (Week 4)**
- [ ] `para create-bookmark` (quick capture)
- [ ] `para bookmark-stats` (analytics)
- [ ] `para find-unclassified`
- [ ] `para rebuild-registry`

### **Phase 5: MCP Integration (Week 5)**
- [ ] MCP tools mirroring CLI
- [ ] JSON response format
- [ ] Error handling (`isError: true`)

### **Phase 6: Browser Export (Optional - Week 6)**
- [ ] `para export-to-browser` (vault notes → HTML)
- [ ] Netscape HTML format
- [ ] PARA folder structure

### **Phase 7: Browser Import (Optional - Week 7)**
- [ ] `para import-from-browser` (HTML → vault notes)
- [ ] Batch migration of old bookmarks
- [ ] Deduplication

### **Phase 8: iOS Shortcut (Week 8)**
- [ ] Pre-built shortcut template
- [ ] Documentation for installation
- [ ] Video walkthrough

---

## Success Metrics

**Primary:**
- % of bookmarks successfully classified (target: >90% heuristic accuracy)
- User adoption of classification workflow (target: weekly usage)
- Time saved vs manual organization (target: <30s per bookmark)

**Secondary:**
- LLM usage rate (expect <20% of bookmarks need LLM)
- Browser export adoption (expect <30% of users)
- iOS Shortcut downloads (expect <40% of users)

---

## Key Decisions

✅ **Leverage Web Clipper for capture** (don't reinvent the wheel)
✅ **Vault notes are primary artifact** (browser HTML is secondary)
✅ **Heuristics-first** (LLM is enhancement, not requirement)
✅ **Batch classification** (not one-by-one during capture)
✅ **PARA folders as destination** (matches existing para-obsidian structure)
✅ **Registry prevents reprocessing** (incremental updates)
✅ **Review mode optional** (fast path by default)

---

## FAQ

**Q: Why not classify during capture?**
A: Keeps capture fast, allows batch processing with better context, users can manually organize before auto-classification.

**Q: What if user doesn't use Web Clipper?**
A: Plugin works with any note that has `type: bookmark` frontmatter. Users can create manually, via shortcuts, or other tools.

**Q: How does this work with existing para-obsidian features?**
A: Uses same PARA folders, template system, frontmatter conventions. Seamless integration.

**Q: Can users reclassify bookmarks later?**
A: Yes. Edit frontmatter `para:` field, or re-run classification with `--force` flag.

**Q: What about browser bookmarks I already have?**
A: Use `para import-from-browser` to batch import HTML → vault notes, then classify.

**Q: Does this work with Safari Reading List?**
A: No. Reading List doesn't export to HTML. Use Web Clipper or manual notes.

---

## Next Steps

1. ✅ Review revised plan with Nathan
2. Start Phase 1: Core classification engine
3. Write tests for heuristics
4. Build CLI commands
5. Create example vault with test bookmarks
6. Documentation + video walkthrough
