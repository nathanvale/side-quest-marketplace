# Bookmark Workflow Guide

**Comprehensive guide to PARA-based bookmark management using Obsidian Web Clipper and para-obsidian**

---

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Capture](#capture)
- [Classification](#classification)
- [Organization](#organization)
- [Export (Optional)](#export-optional)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Overview

The para-obsidian bookmark workflow combines **Obsidian Web Clipper** for capture with **intelligent PARA classification** for organization. This approach leverages existing tools while adding smart classification to help you organize bookmarks by their role in your life.

### Key Benefits

- **Capture anywhere** - iOS/macOS Safari, Chrome, Firefox, Edge
- **Intelligent classification** - PARA-based organization with LLM assistance
- **Vault-first** - Bookmarks live in your Obsidian vault as markdown notes
- **Optional browser sync** - Export to browser HTML when needed
- **No parallel systems** - Uses existing inbox processing pipeline

### Architecture

```
┌─────────────────┐
│  Web Clipper    │  Capture bookmarks from browser/mobile
│  (iOS/Desktop)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Inbox/         │  Bookmarks land here with frontmatter
│  bookmark.md    │  type: bookmark, url, title, etc.
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Classifier     │  Heuristics + LLM analyze bookmark
│  Pipeline       │  Suggests PARA category
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PARA Folders   │  Projects/Web, Areas/Web,
│                 │  Resources/Web, Archives/Web
└─────────────────┘
```

---

## Setup

### Prerequisites

1. **Obsidian vault** - Set `PARA_VAULT` environment variable
2. **Obsidian Web Clipper** - Install from:
   - iOS: App Store (search "Obsidian Web Clipper")
   - Desktop: Browser extension (Chrome/Firefox/Edge/Safari)
3. **para-obsidian plugin** - Installed in SideQuest marketplace

### Step 1: Configure Obsidian Web Clipper

#### iOS Safari Setup

1. Install Obsidian Web Clipper from App Store
2. Open Safari → Share menu → "Edit Actions"
3. Enable "Obsidian Web Clipper"
4. Configure default vault and folder:
   - Vault: [Your vault name]
   - Folder: `Inbox`
   - Template: `bookmark` (if you have one, otherwise use default)

#### Desktop Browser Setup

**Chrome/Firefox/Edge:**
1. Install Obsidian Web Clipper extension
2. Click extension icon → Settings
3. Set default vault: [Your vault name]
4. Set default folder: `Inbox`
5. Configure template: `bookmark` (optional)

**Safari:**
1. Install Obsidian Web Clipper from Mac App Store
2. Enable in Safari → Preferences → Extensions
3. Configure default vault and folder (same as above)

### Step 2: Create Bookmark Classifier

The bookmark classifier analyzes captured bookmarks and suggests PARA categories.

```bash
cd /Users/nathanvale/code/side-quest-marketplace/plugins/para-obsidian
bun run src/cli.ts create-classifier bookmark
```

**Wizard Configuration (Recommended Answers):**

```
Q1: What type of documents should this classifier detect?
A: Web bookmarks captured via Obsidian Web Clipper with frontmatter type:bookmark

Q2: Priority? (0-100)
A: 70

Q3: PARA area?
A: varies

Q4: Filename patterns?
A: [skip - Web Clipper names vary]

Q5: Content patterns?
A: type: bookmark, url: http, clipped:

Q6: Fields to extract?
A:
title:string:required
url:string:required
clipped:date:required
category:wikilink:optional
author:wikilink:optional
published:date:optional
tags:array:optional
notes:string:optional
para:string:required

Q7: Field descriptions?
A:
- title: Bookmark title or page title
- url: Original webpage URL
- clipped: Date bookmark was captured
- para: PARA classification (Projects/Areas/Resources/Archives)

Q8: Template name?
A: bookmark

Q9: Create template?
A: basic

Q10: Scoring thresholds?
A: [use defaults]
```

**Generated Files:**
- `src/inbox/classify/classifiers/definitions/bookmark.ts` - Classifier logic
- `${PARA_VAULT}/Templates/bookmark.md` - Templater template
- Registry automatically updated

### Step 3: Verify Setup

```bash
# Check classifier registered
bun run src/cli.ts config

# Verify template exists
ls ${PARA_VAULT}/Templates/bookmark.md

# Test type checking
bun typecheck
```

---

## Capture

### iOS Safari Workflow

**Step 1: Browse to a webpage you want to bookmark**

Example: You're reading Kit CLI documentation at https://kit.cased.com

**Step 2: Open Share menu**

Tap the Share icon (square with arrow) in Safari toolbar

**Step 3: Select "Obsidian Web Clipper"**

Scroll through share options and tap "Obsidian Web Clipper"

**Step 4: Configure capture**

Web Clipper interface appears:

```
┌─────────────────────────────────┐
│ Save to Obsidian                │
├─────────────────────────────────┤
│ Title: Kit CLI Documentation    │
│ Vault: Para Brain               │
│ Folder: Inbox                   │
│ Template: bookmark              │
│                                 │
│ [Preview]                       │
│                                 │
│         [Add to Obsidian]       │
└─────────────────────────────────┘
```

- Title: Auto-filled (editable)
- Vault: Select your vault
- Folder: Set to `Inbox`
- Template: Choose `bookmark` (or default)

**Step 5: Tap "Add to Obsidian"**

Bookmark saved to `Inbox/Kit CLI Documentation.md`

### Desktop Browser Workflow

**Chrome/Firefox/Edge:**

1. Navigate to webpage
2. Click Web Clipper extension icon in toolbar
3. Template auto-selects (if configured)
4. Click "Clip to Obsidian"
5. Bookmark saved to Inbox

**Safari:**

1. Navigate to webpage
2. Click Share button → "Obsidian Web Clipper"
3. Configure vault/folder if needed
4. Click "Save"
5. Bookmark saved to Inbox

### Captured Note Format

**Example: `Inbox/Kit CLI Documentation.md`**

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
- "Automatic semantic index with fallback to text search"
```

**Key Frontmatter Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | Must be `bookmark` for classifier to detect |
| `url` | Yes | Original webpage URL |
| `title` | Yes | Page title or custom title |
| `clipped` | Yes | Capture date (ISO format) |
| `para` | No | Added by classifier during processing |
| `category` | No | User-defined category (wikilink) |
| `author` | No | Page author or organization |
| `published` | No | Original publication date |
| `tags` | No | Topic tags |
| `notes` | No | User notes about bookmark |

---

## Classification

### How PARA Classification Works

The bookmark classifier analyzes each bookmark and suggests a PARA category based on:

1. **URL patterns** - Recognizes common website types
2. **Content markers** - Detects documentation, GitHub repos, etc.
3. **Age** - Recent bookmarks may be project-related
4. **LLM analysis** - For ambiguous cases

### PARA Categories Explained

**Projects** - Time-bound work (active, short-term):
- GitHub/GitLab repos with active issues or PRs
- Project management tools (Jira, Trello, Asana)
- Work-in-progress documentation
- Time-sensitive resources for current projects
- **Example:** `https://github.com/username/active-project`

**Areas** - Ongoing responsibilities (permanent, no deadline):
- Banking and finance portals (NetBank, PayPal, Stripe)
- Health dashboards (Strava, MyFitnessPal, health insurance)
- Home management (HomeAssistant, recipe sites)
- Account settings and admin pages
- **Example:** `https://mybank.com/login`

**Resources** - Reference material (default category):
- Documentation sites (`/docs/`, `/api/`, `/reference/`)
- Tutorials, guides, how-tos
- Stack Overflow, MDN, dev.to articles
- Learning resources, courses
- General reference websites
- **Example:** `https://developer.mozilla.org/en-US/docs/`

**Archives** - Stale or completed content:
- Bookmarks older than 180 days
- Deprecated/archived URLs
- Legacy documentation
- Completed project resources
- **Example:** Old API docs for deprecated service

### Classification Process

#### Step 1: Scan Inbox

Run the inbox scanner to analyze captured bookmarks:

```bash
cd /Users/nathanvale/code/side-quest-marketplace/plugins/para-obsidian
bun run src/cli.ts process-inbox scan
```

**Output:**

```
Scanning inbox...
Found 3 new files

┌─────┬──────────────────────┬──────────┬────────────┬─────────────────┐
│ ID  │ Source               │ Type     │ Confidence │ Suggested Title │
├─────┼──────────────────────┼──────────┼────────────┼─────────────────┤
│ 1   │ Kit CLI Docume...    │ bookmark │ high (0.95)│ Kit CLI Docs    │
│ 2   │ GitHub PR #1234.md   │ bookmark │ high (0.92)│ Fix auth bug    │
│ 3   │ NetBank Login.md     │ bookmark │ med (0.78) │ Banking Portal  │
└─────┴──────────────────────┴──────────┴────────────┴─────────────────┘

Classifier: bookmark
Heuristic matches:
  - Content: "type: bookmark" (1.0), "url: https://" (0.9)
  - URL pattern: "/docs/" detected (Resources)

Extracted fields (LLM):
  1. Kit CLI Documentation
     - url: https://kit.cased.com
     - para: Resources (documentation site)
     - reasoning: URL contains /docs/, technical documentation

  2. GitHub PR #1234
     - url: https://github.com/user/repo/pull/1234
     - para: Projects (active work)
     - reasoning: Recent PR, active repository

  3. NetBank Login
     - url: https://mybank.com/netbank
     - para: Areas (ongoing responsibility)
     - reasoning: Banking portal, account management

Review suggestions? (y/n): y
```

#### Step 2: Review Suggestions

Interactive review mode shows each suggestion:

```
┌─────────────────────────────────────────────────────┐
│ Suggestion 1/3: Kit CLI Documentation              │
├─────────────────────────────────────────────────────┤
│ Source: Inbox/Kit CLI Documentation.md              │
│ Type: bookmark                                      │
│ PARA: Resources                                     │
│ Destination: Resources/Web/Kit CLI Documentation.md │
│                                                     │
│ Extracted Fields:                                   │
│ - title: Kit CLI Documentation                      │
│ - url: https://kit.cased.com                        │
│ - clipped: 2024-12-16                               │
│ - para: Resources                                   │
│                                                     │
│ LLM Reasoning:                                      │
│ "URL contains /docs/ pattern, technical             │
│  documentation for CLI tool. Reference material."   │
└─────────────────────────────────────────────────────┘

Commands:
  a - approve
  e - edit PARA category
  s - skip
  q - quit

> a
```

**Editing Example:**

```
> e
Enter new PARA category (Projects/Areas/Resources/Archives): Projects
Reason for change: Currently working with this tool
Updated suggestion:
  - para: Projects
  - destination: Projects/Web/Kit CLI Documentation.md
Save changes? (y/n): y
```

#### Step 3: Execute Suggestions

After reviewing all suggestions, execute approved moves:

```bash
bun run src/cli.ts process-inbox execute
```

**Output:**

```
Executing 3 suggestions...

✓ Created: Resources/Web/Kit CLI Documentation.md
✓ Created: Projects/Web/GitHub PR #1234.md
✓ Created: Areas/Web/NetBank Login.md
✓ Updated registry: 3 items processed

Summary:
- 3 notes created
- 0 failed
- 3 registry entries added

Vault committed: "chore: process 3 bookmarks from inbox"
```

### Heuristic Classification Rules

The classifier uses these heuristics before falling back to LLM:

**Projects Indicators:**
- URL contains: `github.com`, `gitlab.com`, `/issues/`, `/pull/`, `/mr/`
- Recent clipped date (< 30 days) + work-related tags
- Project management domains: `jira`, `trello`, `asana`

**Areas Indicators:**
- URL contains: `netbank`, `paypal`, `stripe`, `portal`, `dashboard`
- Account/settings pages: `/account`, `/settings`, `/profile`
- Health/fitness: `strava.com`, `myfitnesspal.com`
- Home automation: `homeassistant.io`

**Resources Indicators (Default):**
- URL contains: `/docs/`, `/api/`, `/reference/`, `/guide/`, `/tutorial/`
- Documentation sites: `developer.mozilla.org`, `docs.python.org`
- Learning platforms: `stackoverflow.com`, `dev.to`, `medium.com`
- No strong indicators for Projects/Areas/Archives

**Archives Indicators:**
- Clipped date > 180 days ago
- URL contains: `/archive/`, `/deprecated/`, `/legacy/`
- Tags include: `deprecated`, `old`, `archived`

---

## Organization

### Folder Structure

Bookmarks are organized into PARA folders with `Web/` subfolders:

```
vault/
├── Inbox/                      # Capture destination
│   ├── kit-cli-docs.md        # Before classification
│   └── github-pr-123.md
├── Projects/
│   └── Web/                    # Active project bookmarks
│       ├── GitHub PR #1234.md
│       └── Jira Sprint Board.md
├── Areas/
│   └── Web/                    # Ongoing responsibility bookmarks
│       ├── NetBank Login.md
│       └── Strava Dashboard.md
├── Resources/
│   └── Web/                    # Reference material (most bookmarks)
│       ├── Kit CLI Documentation.md
│       ├── MDN JavaScript Guide.md
│       └── TypeScript Handbook.md
└── Archives/
    └── Web/                    # Stale bookmarks
        └── Old API Docs.md

Templates/
└── bookmark.md                 # Templater template
```

### Note Structure After Classification

**Example: `Resources/Web/Kit CLI Documentation.md`**

```markdown
---
type: bookmark
para: Resources              # Added by classifier
url: https://kit.cased.com
title: Kit CLI Documentation
clipped: 2024-12-16
category: "[[Documentation]]"
author: "[[Cased]]"
published: 2024-01-15
tags: [cli, code-search]
template_version: 1
---

# Kit CLI Documentation

## Notes

Fast semantic search for codebases using ML embeddings.

## Highlights

- "30-50x faster than grep for symbol lookup"
- "Automatic semantic index with fallback to text search"

## Related

- [[Projects/SideQuest Marketplace]] - Using Kit for code search
- [[Areas/Development Tools]] - CLI tooling area

---
*Processed from inbox: 2024-12-16 11:30*
```

### Reclassification

If you need to move a bookmark to a different PARA category:

**Option 1: Manual Move**

1. Edit frontmatter `para:` field
2. Move file to new PARA folder
3. Update any links

**Option 2: Reprocess Through Inbox**

1. Move note back to Inbox
2. Remove from registry: Edit `.para/processed-registry.json`, delete entry
3. Run `process-inbox scan` again
4. Review new suggestion
5. Execute

---

## Export (Optional)

Export your PARA-organized bookmarks to browser HTML format for native browser sync.

### Generate Browser HTML

```bash
cd /Users/nathanvale/code/side-quest-marketplace/plugins/para-obsidian
bun run src/cli.ts export-bookmarks \
  --filter "type:bookmark" \
  --out ~/Downloads/bookmarks-para.html
```

**Output: `bookmarks-para.html`**

```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 FOLDED>Projects</H3>
    <DL><p>
        <DT><A HREF="https://github.com/user/repo/pull/1234">GitHub PR #1234</A>
        <DT><A HREF="https://jira.company.com/sprint/42">Sprint Board</A>
    </DL><p>
    <DT><H3 FOLDED>Areas</H3>
    <DL><p>
        <DT><A HREF="https://mybank.com/netbank">NetBank Login</A>
        <DT><A HREF="https://strava.com/dashboard">Strava Dashboard</A>
    </DL><p>
    <DT><H3 FOLDED>Resources</H3>
    <DL><p>
        <DT><A HREF="https://kit.cased.com">Kit CLI Documentation</A>
        <DT><A HREF="https://developer.mozilla.org">MDN Web Docs</A>
    </DL><p>
</DL>
```

### Import to Browser

**Safari:**
1. File → Import From → Bookmarks HTML File
2. Select `bookmarks-para.html`
3. Bookmarks appear in Favorites with PARA folders

**Chrome/Firefox/Edge:**
1. Bookmarks Manager (Ctrl+Shift+O / Cmd+Shift+O)
2. Three dots menu → Import bookmarks
3. Select `bookmarks-para.html`
4. PARA folder structure preserved

### Sync Workflow

If you want to keep browser bookmarks in sync with vault:

**Weekly/Monthly:**
1. Export vault bookmarks: `bun run src/cli.ts export-bookmarks ...`
2. Import to browser (overwrites existing structure)
3. Browser syncs to other devices (iCloud/Chrome Sync)

**Note:** This is one-way sync (vault → browser). Browser bookmarks don't sync back to vault automatically.

---

## Troubleshooting

### Classifier Not Detecting Bookmarks

**Symptom:** Bookmarks in Inbox but `process-inbox scan` doesn't find them.

**Solutions:**

1. **Check frontmatter:**
   ```yaml
   ---
   type: bookmark  # Must be exactly "bookmark"
   url: https://example.com
   ---
   ```

2. **Verify classifier registered:**
   ```bash
   bun run src/cli.ts config
   # Should show "bookmark" in classifiers list
   ```

3. **Check type-checking:**
   ```bash
   bun typecheck
   # Fix any errors in classifier definition
   ```

### Wrong PARA Category Suggested

**Symptom:** Classifier suggests Resources but should be Areas.

**Solutions:**

1. **Edit during review:**
   ```
   > e
   Enter new PARA category: Areas
   Reason: This is my banking portal (ongoing)
   ```

2. **Improve heuristics:**
   Edit `src/inbox/classify/classifiers/definitions/bookmark.ts`:
   ```typescript
   heuristics: {
     contentMarkers: [
       // Add specific patterns
       { pattern: "mybank.com", weight: 1.0 },
       { pattern: "netbank", weight: 0.9 },
     ]
   },
   extraction: {
     promptHint: `...
     - Areas: Banking portals like mybank.com
     ...`
   }
   ```

3. **Test changes:**
   ```bash
   # Move bookmark back to Inbox
   # Remove from registry
   # Reprocess
   bun run src/cli.ts process-inbox scan
   ```

### Web Clipper Not Saving to Inbox

**Symptom:** Web Clipper says "Saved" but note doesn't appear in Inbox.

**Solutions:**

1. **Check vault path:**
   ```bash
   echo $PARA_VAULT
   # Should be absolute path to your vault
   ```

2. **Verify folder exists:**
   ```bash
   ls ${PARA_VAULT}/Inbox/
   # Should list captured bookmarks
   ```

3. **Web Clipper settings:**
   - iOS: Open Web Clipper app → Settings → Default folder → `Inbox`
   - Desktop: Extension settings → Folder → `Inbox`

4. **Check Obsidian sync:**
   - If using Obsidian Sync, wait for sync to complete
   - Check vault folder directly in Finder/Explorer

### Template Fields Not Matching

**Symptom:** Classifier extracts fields that don't match template.

**Solutions:**

1. **Verify template fields:**
   ```bash
   cat ${PARA_VAULT}/Templates/bookmark.md
   # Check frontmatter field names
   ```

2. **Update classifier field mappings:**
   Edit `src/inbox/classify/classifiers/definitions/bookmark.ts`:
   ```typescript
   template: {
     name: "bookmark",
     fieldMappings: {
       title: "Bookmark title",
       url: "Original URL",
       clipped: "Clipped date (YYYY-MM-DD)",
       // Ensure these match template prompts
     }
   }
   ```

3. **Regenerate template:**
   ```bash
   # If template is broken, regenerate
   /para-obsidian:create-note-template bookmark
   # Choose "create-new" with suffix: bookmark-v2
   ```

### LLM Classification Slow

**Symptom:** Inbox processing takes >30s per bookmark.

**Solutions:**

1. **Improve heuristics to reduce LLM calls:**
   ```typescript
   heuristics: {
     threshold: 0.3,  // Lower threshold = more heuristic matches
     contentMarkers: [
       // Add more patterns to catch common cases
       { pattern: "documentation", weight: 0.8 },
       { pattern: "/docs/", weight: 0.9 },
     ]
   }
   ```

2. **Batch processing:**
   - Capture multiple bookmarks during week
   - Process all at once on weekend
   - LLM calls are parallelized

3. **Check Ollama performance:**
   ```bash
   # Test Ollama response time
   time ollama run llama3.2:latest "Hello"
   # Should be < 5s
   ```

### Duplicate Bookmarks

**Symptom:** Same URL saved multiple times with different titles.

**Solutions:**

1. **Search before capturing:**
   ```bash
   bun run src/cli.ts search --frontmatter "url=https://example.com"
   # Check if bookmark already exists
   ```

2. **Registry tracking prevents reprocessing:**
   - Once processed, bookmark won't be suggested again
   - Safe to leave duplicates in Inbox (won't be reprocessed)

3. **Manual deduplication:**
   ```bash
   # Search for duplicates
   bun run src/cli.ts search --frontmatter "url=https://kit.cased.com"
   # Delete older versions
   bun run src/cli.ts delete "Resources/Web/Old Kit Docs.md"
   ```

### Frontmatter Validation Errors

**Symptom:** `para:` field rejected during execution.

**Solutions:**

1. **Check valid values:**
   ```yaml
   para: Resources  # ✓ Valid
   para: resources  # ✗ Invalid (case-sensitive)
   para: Reference  # ✗ Invalid (not a PARA category)
   ```

2. **Valid PARA values:**
   - `Projects`
   - `Areas`
   - `Resources`
   - `Archives`

3. **Validate frontmatter:**
   ```bash
   bun run src/cli.ts frontmatter validate "Inbox/bookmark.md"
   # Shows validation errors with suggestions
   ```

---

## Best Practices

### Capture

**Immediate capture:**
- Bookmark pages while reading, don't wait
- Trust the classification system
- Add notes field for context (why you saved it)

**Consistent metadata:**
- Let Web Clipper auto-fill title/URL
- Add tags during capture if you know them
- Use category field sparingly (LLM can infer from content)

### Classification

**Review regularly:**
- Process inbox weekly or bi-weekly
- Don't let inbox grow beyond 20-30 bookmarks
- Review suggestions carefully (LLM isn't perfect)

**Iterate on heuristics:**
- If classifier consistently misclassifies a pattern, add heuristic
- Document your reasoning in classifier comments
- Test changes with real bookmarks

**Trust the defaults:**
- Resources is the right category for most bookmarks
- Projects should be time-bound (if it's ongoing, it's Areas)
- Archives for old content only (>6 months)

### Organization

**PARA philosophy:**
- **Projects** = "Will this be done in <3 months?"
- **Areas** = "Will I need this indefinitely?"
- **Resources** = "Reference material I might need someday"
- **Archives** = "No longer relevant/active"

**Folder hygiene:**
- Keep `Web/` subfolders for bookmarks
- Use consistent naming: "Website Name - Page Title"
- Archive old project bookmarks when project completes

**Linking:**
- Link bookmarks to related project/area notes
- Create index notes for topic clusters
- Example: `Resources/Web/CLI Tools Index.md` links to all CLI tool bookmarks

### Maintenance

**Weekly review:**
- Process inbox
- Archive completed project bookmarks
- Update tags/categories
- Delete no-longer-useful bookmarks

**Monthly cleanup:**
- Review Resources folder for outdated content
- Move stale bookmarks (>6 months) to Archives
- Update PARA categories if your projects/areas change

**Quarterly audit:**
- Export to browser HTML (backup)
- Review classifier performance
- Update heuristics based on misclassifications
- Refactor PARA structure if needed

---

## Advanced Workflows

### Custom Web Clipper Template

If you want to customize frontmatter fields captured by Web Clipper:

**Create custom template: `Templates/bookmark-custom.md`**

```markdown
---
type: bookmark
url: {{url}}
title: "{{title}}"
clipped: {{date:YYYY-MM-DD}}
category: "[[{{vault-prompt:Category}}]]"
priority: {{vault-prompt:Priority (high/medium/low)}}
tags: [{{tags}}]
---

# {{title}}

## Notes

{{vault-prompt:Why did you save this?}}

## Highlights

{{selection}}
```

**Configure in Web Clipper:**
- iOS: Template settings → Select `bookmark-custom`
- Desktop: Extension settings → Template → `bookmark-custom`

**Result:** More metadata captured during save.

### Automated Classification Rules

For high-volume bookmarking, create domain-based rules:

**Edit `bookmark.ts` classifier:**

```typescript
heuristics: {
  // Auto-classify by domain
  contentMarkers: [
    // Work domains → Projects
    { pattern: "company-jira.com", weight: 1.0, category: "Projects" },
    { pattern: "work-github.com", weight: 1.0, category: "Projects" },

    // Personal finance → Areas
    { pattern: "mybank.com", weight: 1.0, category: "Areas" },
    { pattern: "paypal.com", weight: 1.0, category: "Areas" },

    // Documentation → Resources
    { pattern: "/docs/", weight: 1.0, category: "Resources" },
    { pattern: "developer.mozilla.org", weight: 1.0, category: "Resources" },
  ],
  threshold: 0.3
}
```

**Benefit:** High-confidence heuristic matches skip LLM, faster processing.

### Bookmark Collections

Create curated collections by topic:

**Example: `Resources/Web/TypeScript Learning.md`**

```markdown
---
type: resource
area: "[[Development]]"
tags: [typescript, learning, index]
---

# TypeScript Learning Resources

## Official Documentation

- [[TypeScript Handbook]]
- [[TS Config Reference]]

## Tutorials

- [[TypeScript Deep Dive]]
- [[Effective TypeScript]]

## Tools

- [[TS Playground]]
- [[Type Challenges]]

---

*Collection of TypeScript bookmarks from Web folder*
```

**Workflow:**
1. Capture bookmarks normally
2. Process through inbox
3. Link from collection note
4. Update collection monthly

---

## Alternatives to Web Clipper

### iOS Shortcut (Advanced)

If you prefer iOS Shortcuts over Web Clipper:

**Create Shortcut: "Save to PARA Inbox"**

**Actions:**
1. Receive URL from Share Sheet
2. Get Title from Safari page
3. Ask for notes (optional)
4. Create text:
   ```
   ---
   type: bookmark
   url: [URL]
   title: "[Title]"
   clipped: [Current Date]
   ---

   ## Notes
   [User Input]
   ```
5. Save to Obsidian: `Inbox/[Title].md`

**Installation:**
- Download from plugin docs (TODO: create .shortcut file)
- Install via Shortcuts app
- Add to Share Sheet

### Browser HTML Import

If you have existing browser bookmarks:

**Export from browser:**
1. Browser → Bookmarks Manager → Export to HTML
2. Saves `bookmarks.html`

**Import to vault (TODO: implement reverse export):**
```bash
bun run src/cli.ts import-bookmarks \
  --from ~/Downloads/bookmarks.html \
  --to Inbox/
```

**Process through inbox:**
- Notes created with `type: bookmark` frontmatter
- LLM extracts metadata from HTML
- Classify via normal workflow

---

## Resources

- **Obsidian Web Clipper:** https://obsidian.md/clipper
- **PARA Method:** https://fortelabs.com/blog/para/
- **Templater Plugin:** https://silentvoid13.github.io/Templater/
- **Classification Guide:** `commands/create-classifier.md`
- **Template Guide:** `commands/create-note-template.md`
- **Usage Examples:** `USAGE_EXAMPLES.md`
