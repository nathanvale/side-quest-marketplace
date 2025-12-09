# Attachments Management for ADHD Minds

> ADHD-friendly flat folder approach with timestamp-based IDs and wikilink connections

## Table of Contents
- [Core Philosophy](#core-philosophy)
- [Storage Structure](#storage-structure)
- [File Naming Convention](#file-naming-convention)
- [Linking Pattern](#linking-pattern)
- [Querying Attachments with Dataview](#querying-attachments-with-dataview)
- [ADHD-Friendly Workflow](#adhd-friendly-workflow)
- [Migration from Nested to Flat](#migration-from-nested-to-flat)
- [Git Integration](#git-integration)
- [Why This Works for ADHD](#why-this-works-for-adhd)
- [Quick Reference](#quick-reference)

---

## Core Philosophy

**Linking is key. Folder hierarchy is not.**

Traditional nested folder structures (`Attachments/Projects/2025/ProjectName/`) create cognitive overhead and decision paralysis. The ADHD-friendly approach uses a **single flat folder** with **timestamp-based IDs** and relies on **wikilink connections** to maintain relationships.

### Key Principles

1. **Flat structure** - All files in one `Attachments/` folder
2. **Timestamp IDs** - Files named with `YYYYMMDD-HHMM-` prefix for instant chronological ordering
3. **Linking matters** - Relationships established through wikilinks, not folder trees
4. **Git-friendly** - Works seamlessly with version control
5. **Zero decisions** - No "where should this go?" paralysis

---

## Storage Structure

### Recommended Setup

```
Attachments/          # Single flat folder
├── 20251226-0830-booking-confirmation.pdf
├── 20251226-0915-screenshot-error.png
├── 20251227-1030-diagram-architecture.png
├── 20251227-1445-doc-meeting-notes.pdf
└── 20251228-0900-photo-team-event.jpg
```

**NO subfolders.** All attachments live at the root level of `Attachments/`.

### Obsidian Settings

Configure Obsidian to use this pattern:

**Settings → Files and Links → Default location for new attachments**
- Set to: `In the folder specified below`
- Attachment folder path: `Attachments`

**Settings → Files and Links → New link format**
- Use: `Relative path to file`

This ensures all attachments automatically go to `Attachments/` and links work correctly.

---

## File Naming Convention

### Format

```
YYYYMMDD-HHMM-type-description.ext
```

### Components

| Component | Purpose | Example |
|-----------|---------|---------|
| `YYYYMMDD` | Date stamp | `20251226` |
| `HHMM` | Time stamp (24h) | `0830`, `1445` |
| `type` | File category | `booking`, `photo`, `doc`, `diagram`, `screenshot` |
| `description` | Contextual name | `confirmation`, `error`, `architecture` |
| `ext` | File extension | `pdf`, `png`, `jpg`, `docx` |

### Type Categories

| Type | Use For | Examples |
|------|---------|----------|
| `booking` | Travel confirmations, tickets | `20251226-0830-booking-flight.pdf` |
| `photo` | Images, photographs | `20251227-1030-photo-venue.jpg` |
| `screenshot` | Screen captures | `20251227-1445-screenshot-error.png` |
| `diagram` | Architecture, flowcharts | `20251228-0900-diagram-system.png` |
| `doc` | Documents, PDFs | `20251228-1100-doc-contract.pdf` |
| `receipt` | Financial records | `20251229-1200-receipt-purchase.pdf` |
| `scan` | Scanned documents | `20251229-1300-scan-form.pdf` |

### Examples

```
20251226-0830-booking-flight-mel-to-syd.pdf
20251227-0915-screenshot-deployment-error.png
20251227-1030-diagram-microservices-arch.png
20251227-1445-doc-q4-meeting-notes.pdf
20251228-0900-photo-team-offsite.jpg
20251228-1100-receipt-hotel-booking.pdf
20251229-1200-scan-signed-contract.pdf
```

### Naming Script

Create a quick shell alias for renaming files on import:

```bash
# In ~/.zshrc or ~/.bashrc
att() {
  local file="$1"
  local type="$2"
  local desc="$3"
  local timestamp=$(date +"%Y%m%d-%H%M")
  local ext="${file##*.}"
  local newname="${timestamp}-${type}-${desc}.${ext}"
  mv "$file" "$HOME/path/to/vault/Attachments/$newname"
  echo "Renamed to: $newname"
}

# Usage:
# att downloaded-file.pdf booking flight-confirmation
# → 20251226-0830-booking-flight-confirmation.pdf
```

---

## Linking Pattern

### Use Full Vault Paths

Always use the full path from vault root in wikilinks:

```markdown
[[Attachments/20251226-0830-booking-flight.pdf]]
```

**NOT:**
```markdown
[[booking-flight.pdf]]              # Ambiguous
[[../Attachments/booking-flight.pdf]]  # Fragile relative path
```

### Inline Display

For images, use standard Markdown syntax with vault path:

```markdown
![[Attachments/20251227-1030-photo-venue.jpg]]
```

### Link with Context

Always add context when linking attachments:

```markdown
## Attachments

**Flight confirmation:** [[Attachments/20251226-0830-booking-flight.pdf]]

**Venue photos:**
- ![[Attachments/20251227-1030-photo-venue-entrance.jpg]]
- ![[Attachments/20251227-1031-photo-venue-interior.jpg]]

**Architecture diagram:** [[Attachments/20251228-0900-diagram-system-arch.png]]
```

### Link Multiple Times

Don't worry about linking the same file from multiple notes. Relationships through links are the point:

```markdown
# In 01_Projects/Website Redesign.md
[[Attachments/20251227-1030-diagram-new-layout.png]]

# In 02_Areas/Design System.md
[[Attachments/20251227-1030-diagram-new-layout.png]]

# In 03_Resources/UI Patterns.md
[[Attachments/20251227-1030-diagram-new-layout.png]]
```

This creates a rich web of connections showing where the attachment is relevant.

---

## Querying Attachments with Dataview

### Show All Attachments Linked from Current Note

```dataview
TABLE WITHOUT ID
  file.link as "Note",
  file.outlinks as "Attached Files"
FROM "01_Projects"
WHERE file.outlinks AND length(filter(file.outlinks, (x) => contains(string(x), "Attachments"))) > 0
SORT type ASC, file.name ASC
```

### Show All Notes Linking to a Specific Attachment

```dataview
TABLE WITHOUT ID
  file.link as "Note",
  type as "Type"
FROM [[Attachments/20251226-0830-booking-flight.pdf]]
SORT file.folder ASC, file.name ASC
```

### Show Recent Attachments (Last 7 Days)

```dataview
TABLE WITHOUT ID
  file.link as "Attachment",
  file.mtime as "Modified",
  length(file.inlinks) as "Linked By"
FROM "Attachments"
WHERE file.mtime >= date(today) - dur(7 days)
SORT file.mtime DESC
```

### Find Orphaned Attachments (Not Linked Anywhere)

```dataview
TABLE WITHOUT ID
  file.link as "Orphaned File",
  file.size as "Size",
  file.mtime as "Modified"
FROM "Attachments"
WHERE length(file.inlinks) = 0
SORT file.mtime DESC
```

### Show Attachments by Type

```dataview
TABLE WITHOUT ID
  file.link as "File",
  file.mtime as "Modified",
  length(file.inlinks) as "Links"
FROM "Attachments"
WHERE contains(file.name, "-photo-")
SORT file.mtime DESC
```

### Project Attachments Dashboard

Add this to project templates:

```markdown
## Attachments

### Linked Files
```dataview
TABLE WITHOUT ID
  file.link as "Note",
  file.outlinks as "Attached Files"
FROM "01_Projects"
WHERE file.outlinks AND length(filter(file.outlinks, (x) => contains(string(x), "Attachments"))) > 0
SORT type ASC, file.name ASC
```

**Storage:** `Attachments/` (flat folder, no nesting)

**Naming:** `YYYYMMDD-HHMM-type-description.ext`

**Examples:**
- `[[Attachments/20251226-0830-booking-file.pdf]]`
- `[[Attachments/20251227-0915-photo-name.jpg]]`

**Key:** Linking matters, not folder hierarchy.
```

---

## ADHD-Friendly Workflow

### Capture Flow

**1. Download/Save File**
- Browser downloads to `~/Downloads/`
- Screenshot saves to `~/Desktop/`

**2. Rename Immediately**
```bash
# Use the att() function or manual rename
att contract.pdf doc signed-agreement
# → 20251226-0830-doc-signed-agreement.pdf
```

**3. Move to Vault**
```bash
# File automatically moved by att() function
# Or manually:
mv ~/Downloads/file.pdf ~/path/to/vault/Attachments/20251226-0830-doc-file.pdf
```

**4. Link from Note**
```markdown
[[Attachments/20251226-0830-doc-signed-agreement.pdf]]
```

### Zero-Decision Rules

1. **Never think about folders** - Everything goes to `Attachments/`
2. **Timestamp is automatic** - Use current date/time, always
3. **Type from preset list** - Pick from: `booking`, `photo`, `doc`, `diagram`, `screenshot`, `receipt`, `scan`
4. **Description is brief** - 2-3 words max

### Batch Processing

Process multiple files at once using a script:

```bash
#!/bin/bash
# batch-import.sh

VAULT_PATH="$HOME/path/to/vault/Attachments"

for file in ~/Downloads/*.pdf; do
  timestamp=$(date +"%Y%m%d-%H%M")
  filename=$(basename "$file")
  newname="${timestamp}-doc-${filename}"
  mv "$file" "$VAULT_PATH/$newname"
  echo "Imported: $newname"
done
```

### Daily Review

Use Dataview to review recent imports:

```dataview
TABLE WITHOUT ID
  file.link as "Recent Import",
  length(file.inlinks) as "Linked?",
  file.mtime as "Added"
FROM "Attachments"
WHERE file.mtime >= date(today) - dur(1 day)
SORT file.mtime DESC
```

**Action:** Link any orphaned files to relevant notes.

---

## Migration from Nested to Flat

### Step 1: Inventory Current Structure

```bash
cd /path/to/vault/Attachments
find . -type f | wc -l  # Count files
find . -type d | sort    # List directories
```

### Step 2: Flatten Hierarchy

```bash
#!/bin/bash
# flatten-attachments.sh

ATTACHMENTS_DIR="/path/to/vault/Attachments"
cd "$ATTACHMENTS_DIR"

# Move all files to root
find . -mindepth 2 -type f -exec mv {} . \;

# Remove empty directories
find . -mindepth 1 -type d -empty -delete
```

### Step 3: Add Timestamps

```bash
#!/bin/bash
# add-timestamps.sh

ATTACHMENTS_DIR="/path/to/vault/Attachments"
cd "$ATTACHMENTS_DIR"

for file in *.*; do
  # Get file modification date
  mtime=$(stat -f "%Sm" -t "%Y%m%d-%H%M" "$file")

  # Skip if already has timestamp
  if [[ $file =~ ^[0-9]{8}-[0-9]{4}- ]]; then
    continue
  fi

  # Rename with timestamp prefix
  mv "$file" "${mtime}-doc-${file}"
done
```

### Step 4: Update Links

Use Obsidian's built-in "Detect all file links" feature:
1. Settings → Files and Links
2. Click "Detect all file links"
3. Obsidian will update all wikilinks automatically

Or use search-and-replace:
```
Find: \[\[.*Attachments/(.*?)\]\]
Replace: [[Attachments/$1]]
```

### Step 5: Verify

Run orphan detection query:

```dataview
TABLE WITHOUT ID
  file.link as "File",
  length(file.inlinks) as "Links"
FROM "Attachments"
WHERE length(file.inlinks) = 0
SORT file.name ASC
```

---

## Git Integration

### Why Flat Structure Wins with Git

**Problem:** Nested folders create noisy git diffs:
```
renamed: Attachments/Projects/2025/Q1/file.pdf
      -> Attachments/Projects/2025/Q2/file.pdf
```

**Solution:** Flat structure = stable paths:
```
added: Attachments/20251226-0830-doc-file.pdf
```

### .gitignore Strategy

Exclude large binaries but track small files:

```gitignore
# .gitignore

# Exclude large attachments by extension
Attachments/*.mp4
Attachments/*.mov
Attachments/*.zip
Attachments/*.dmg

# Exclude files over 10MB (configured in .gitattributes)
*.pdf filter=lfs diff=lfs merge=lfs -text
*.png filter=lfs diff=lfs merge=lfs -text
*.jpg filter=lfs diff=lfs merge=lfs -text
```

### Git LFS Setup (Optional)

For large files, use Git LFS:

```bash
# Install Git LFS
brew install git-lfs
git lfs install

# Track large file types
git lfs track "Attachments/*.pdf"
git lfs track "Attachments/*.png"
git lfs track "Attachments/*.jpg"

# Commit .gitattributes
git add .gitattributes
git commit -m "chore: configure Git LFS for attachments"
```

### Commit Patterns

```bash
# Single file
git add Attachments/20251226-0830-booking-flight.pdf
git commit -m "docs: add flight booking confirmation"

# Batch import
git add Attachments/
git commit -m "docs: import Dec 26 receipts and bookings"

# Cleanup
git rm Attachments/20251201-*
git commit -m "chore: remove outdated November attachments"
```

---

## Why This Works for ADHD

### Cognitive Load Reduction

| Traditional Nested | ADHD-Friendly Flat | Impact |
|--------------------|-------------------|--------|
| "Where should this go?" | Always `Attachments/` | Zero decision fatigue |
| Manual categorization | Timestamp auto-sorts | No category paralysis |
| Deep folder navigation | Flat list, search by name | Less clicking, faster access |
| Folder-based relationships | Link-based connections | Explicit context |
| Move files to reorganize | Links stay stable | No broken references |

### Visual Scanning

Flat folder with timestamp prefixes creates **chronological visual order**:

```
20251226-0830-booking-flight.pdf
20251226-0915-screenshot-error.png
20251227-1030-diagram-arch.png
20251227-1445-doc-notes.pdf
20251228-0900-photo-team.jpg
```

**ADHD Win:** Instant time-based scanning. Recent files rise to top. Old files sink naturally.

### Search-Friendly

Filenames contain **searchable metadata**:

- Search `photo` → All photos
- Search `202512` → December 2025 files
- Search `booking` → All bookings
- Search `screenshot` → All screenshots

**ADHD Win:** No need to remember folder structure. Search finds files by any attribute.

### Link Visualization

Obsidian's graph view shows **attachment relationships**:

```
[Project Note] ──links to──> [Attachment]
                              ^
                              |
                          links from
                              |
[Area Note] ─────links to─────┘
```

**ADHD Win:** Visual confirmation that file is connected. Orphaned files stand out immediately.

### Hyperfocus Compatible

**Flat structure supports hyperfocus flow:**
1. Download file
2. Rename with timestamp + type + description
3. Drop in `Attachments/`
4. Link from note

**No interruptions.** No decisions. Pure flow state.

---

## Quick Reference

### File Naming Template

```
YYYYMMDD-HHMM-type-description.ext
```

### Common Types

```
booking, photo, screenshot, diagram, doc, receipt, scan
```

### Linking Format

```markdown
[[Attachments/20251226-0830-booking-file.pdf]]
```

### Shell Function

```bash
att() {
  local file="$1"
  local type="$2"
  local desc="$3"
  local timestamp=$(date +"%Y%m%d-%H%M")
  local ext="${file##*.}"
  local newname="${timestamp}-${type}-${desc}.${ext}"
  mv "$file" "$HOME/path/to/vault/Attachments/$newname"
  echo "Renamed to: $newname"
}
```

### Orphan Detection Query

```dataview
TABLE WITHOUT ID
  file.link as "Orphaned File",
  file.mtime as "Modified"
FROM "Attachments"
WHERE length(file.inlinks) = 0
SORT file.mtime DESC
```

### Migration Steps

1. Flatten: `find . -mindepth 2 -type f -exec mv {} . \;`
2. Cleanup: `find . -mindepth 1 -type d -empty -delete`
3. Rename: Add timestamps using script
4. Update: Obsidian "Detect all file links"
5. Verify: Run orphan detection query

---

## Resources

- **Obsidian Forum:** Attachments best practices discussions
- **PARA Method:** @./para-method.md
- **Dataview Queries:** @./dataview-patterns.md
- **Obsidian Settings:** @./obsidian-best-practices.md

---

**Remember:** The goal is not perfect organization. The goal is **zero friction** between "I have a file" and "I've linked it where it matters."

Linking is everything. Folders are nothing.
