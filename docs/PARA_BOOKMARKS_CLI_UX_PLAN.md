# CLI UX Review: para-obsidian Bookmark Workflow

**Status:** Plan  
**Created:** 2024-12-17  
**Plugin:** para-obsidian  

---

## 1. What the CLI is trying to help the user do

The `para-obsidian` CLI helps users:
1. **Create classifiers** - Wizard-based setup for document type detection
2. **Process inbox** - Scan captured bookmarks, get PARA classification suggestions, review interactively, execute moves
3. **Export bookmarks** - Generate browser-compatible HTML from vault

Primary workflow: Capture → Classify → Organize → (Optional) Export

---

## 2. Friction & Confusion Audit

### Issue 1: Wizard Overload (create-classifier)
**Evidence:**
```
Q1: What type of documents should this classifier detect?
Q2: Priority? (0-100)
Q3: PARA area?
Q4: Filename patterns?
Q5: Content patterns?
Q6: Fields to extract? [complex nested format]
Q7: Field descriptions?
Q8: Template name?
Q9: Create template?
Q10: Scoring thresholds?
```

**User Impact:** 10 questions before any value delivered. High abandonment risk.

**Why it happens:** No progressive disclosure. Expert-mode questions mixed with essential setup.

---

### Issue 2: Cryptic Field Extraction Format
**Evidence:**
```
Q6: Fields to extract?
A:
title:string:required
url:string:required
clipped:date:required
category:wikilink:optional
```

**User Impact:** User must learn custom DSL syntax. No autocomplete, no validation feedback during entry.

**Why it happens:** CLI prompt doesn't guide format. No examples shown inline.

---

### Issue 3: No Dry-Run Before Execute
**Evidence:**
```bash
bun run src/cli.ts process-inbox execute
```
Immediately moves files. No `--dry-run` flag mentioned.

**User Impact:** Accidental file moves. No undo path shown.

**Why it happens:** Missing "safe by default" design.

---

### Issue 4: Ambiguous Review Commands
**Evidence:**
```
Commands:
  a - approve
  e - edit PARA category
  s - skip
  q - quit
```

**User Impact:** 
- What does "skip" do? Skip this item or skip review entirely?
- No way to go back to previous item
- No way to see all pending items
- No batch approve

**Why it happens:** Minimal command set, no progressive disclosure.

---

### Issue 5: Silent Registry State
**Evidence:** Troubleshooting mentions:
```
# Remove from registry: Edit `.para/processed-registry.json`, delete entry
```

**User Impact:** User must manually edit JSON to "undo" processing. No CLI command for this.

**Why it happens:** Registry management not exposed as user-facing commands.

---

### Issue 6: Long Command Paths
**Evidence:**
```bash
bun run src/cli.ts process-inbox scan
bun run src/cli.ts export-bookmarks --filter "type:bookmark" --out ~/Downloads/bookmarks-para.html
```

**User Impact:** Verbose commands, easy to mistype. No aliases.

**Why it happens:** No shorthand aliases or shell completions mentioned.

---

## 3. Fixes That Are Cheap and High-Leverage

### Fix 1: Wizard Quick-Start Mode
**Before:**
```
Q1: What type of documents should this classifier detect?
```

**After:**
```
Create classifier for: bookmark

Use recommended defaults? (Y/n): Y

✓ Classifier created: bookmark
✓ Template created: Templates/bookmark.md
✓ Registry updated

Customize later: bun run para config edit bookmark
```

---

### Fix 2: Inline Format Examples
**Before:**
```
Q6: Fields to extract?
```

**After:**
```
Fields to extract (one per line, format: name:type:required|optional):

Examples:
  title:string:required
  url:string:required
  published:date:optional
  tags:array:optional

Enter fields (empty line to finish):
> title:string:required
> url:string:required
> 
```

---

### Fix 3: Add Dry-Run Default
**Before:**
```bash
bun run src/cli.ts process-inbox execute
```

**After:**
```bash
bun run para execute

Preview (dry-run):
  ✓ Inbox/Kit CLI Docs.md → Resources/Web/Kit CLI Docs.md
  ✓ Inbox/NetBank.md → Areas/Web/NetBank.md

Execute these moves? (y/N): y
```

---

### Fix 4: Enhanced Review Commands
**After:**
```
Commands:
  a     approve this item
  e     edit PARA category
  n     next (skip, keep in inbox)
  b     back to previous
  A     approve all remaining
  l     list all pending
  ?     help
  q     quit (approved items still pending)
```

---

### Fix 5: Registry Management Commands
**Add:**
```bash
bun run para registry list          # Show processed items
bun run para registry remove <id>   # Remove from registry (allows reprocess)
bun run para undo <id>              # Move back to inbox + remove from registry
```

---

### Fix 6: Command Aliases
**Add to package.json scripts or shell config:**
```bash
alias para="bun run src/cli.ts"
# Then:
para scan          # instead of: bun run src/cli.ts process-inbox scan
para execute       # instead of: bun run src/cli.ts process-inbox execute
para export        # instead of: bun run src/cli.ts export-bookmarks
```

---

## 4. Interaction Model Improvements

### Commands & Shortcuts
| Current | Proposed |
|---------|----------|
| `process-inbox scan` | `scan` or `inbox` |
| `process-inbox execute` | `execute` or `move` |
| `export-bookmarks` | `export` |
| `create-classifier` | `init` or `setup` |

### Defaults & Safe Actions
- **Execute** should default to dry-run, require `--confirm` or interactive confirmation
- **Quit** during review should clarify: "0 items moved, 3 approved items pending"

### Undo/Redo
```bash
para undo                    # Undo last operation
para undo --list             # Show undo history
para undo "Kit CLI Docs"     # Undo specific item
```

### Progressive Disclosure
```
para init bookmark

? Use recommended settings? (Y/n)
  Y = Quick setup with sensible defaults
  n = Expert mode (10 questions)
```

### Expert vs Guided Mode
```bash
para scan              # Guided: interactive review
para scan --batch      # Expert: approve all high-confidence
para scan --json       # Expert: output for scripting
```

---

## 5. Latency & Long-Running Task UX

### Current Issues
- No time estimates for LLM classification
- No progress indicator during scan
- SIGINT behavior undocumented

### Recommended Improvements

**Progress Display:**
```
Scanning inbox...
[████████░░░░░░░░] 8/20 files

Classifying with LLM...
[██░░░░░░░░░░░░░░] 2/8 (avg 3.2s/item, ~20s remaining)
```

**Cancellation Handling:**
```
^C
Interrupted. 5/8 items classified.
Progress saved. Resume with: para scan --continue
```

**What to Do While Waiting:**
```
Classifying 15 bookmarks (est. ~45s)...
Tip: Add heuristics to speed up common patterns
     See: para help heuristics
```

---

## 6. Error States & Recovery

### Current Error (from troubleshooting)
```
Symptom: Classifier Not Detecting Bookmarks
```

### Improved Error Messages

**Before:** (implied silent failure)
```
Found 0 new files
```

**After:**
```
Found 0 classifiable files in Inbox/

Possible causes:
  • No files with type: bookmark frontmatter
  • Files already in processed registry

Debug:
  para inbox list              # Show all inbox files
  para registry check          # Show if files are registered
  para scan --verbose          # Show why files were skipped
```

---

**Before:** (manual JSON editing)
```
Remove from registry: Edit `.para/processed-registry.json`
```

**After:**
```
To reprocess a file:
  para reprocess "Kit CLI Docs"     # Moves back to inbox, clears registry

To see what's been processed:
  para registry list
```

---

## 7. Heuristics & Consistency Scorecard

| Heuristic | Score | Justification |
|-----------|-------|---------------|
| **Discoverability** | 2/5 | Commands hidden behind long paths, no `--help` examples shown |
| **Learnability** | 2/5 | 10-question wizard with custom DSL, no quick-start path |
| **Efficiency** | 3/5 | Batch operations exist but buried, review mode lacks batch approve |
| **Consistency** | 3/5 | Command naming varies (`process-inbox` vs `export-bookmarks`) |
| **Feedback/Visibility** | 2/5 | No progress bars, no time estimates, unclear what registry contains |
| **Error Prevention** | 2/5 | No dry-run default, no confirmation before file moves |
| **Recoverability** | 1/5 | Manual JSON editing required for undo, no undo command |
| **Trustworthiness** | 3/5 | LLM reasoning shown, but confidence thresholds not explained |

**Overall: 18/40** — Functional but high friction, especially for first-time users.

---

## 8. Proposed "Ideal" Revised Flow

### Before (Current)
```bash
$ cd /Users/nathanvale/code/side-quest-marketplace/plugins/para-obsidian
$ bun run src/cli.ts create-classifier bookmark
Q1: What type of documents should this classifier detect?
> Web bookmarks captured via Obsidian Web Clipper with frontmatter type:bookmark
Q2: Priority? (0-100)
> 70
Q3: PARA area?
> varies
Q4: Filename patterns?
> [skip]
Q5: Content patterns?
> type: bookmark, url: http, clipped:
Q6: Fields to extract?
> title:string:required
> url:string:required
> ...8 more fields...
Q7: Field descriptions?
> ...
Q8: Template name?
> bookmark
Q9: Create template?
> basic
Q10: Scoring thresholds?
> [defaults]

$ bun run src/cli.ts process-inbox scan
Scanning inbox...
Found 3 new files
[table output]
Review suggestions? (y/n): y
[item 1]
> a
[item 2]
> a
[item 3]
> a

$ bun run src/cli.ts process-inbox execute
Executing 3 suggestions...
✓ Created: Resources/Web/Kit CLI Documentation.md
...
```

### After (Improved)
```bash
$ para init bookmark

Creating classifier: bookmark
Use recommended settings? (Y/n): Y

✓ Classifier: bookmark (priority 70)
✓ Template: Templates/bookmark.md
✓ Fields: title, url, clipped, para, category, author, tags

Ready to scan inbox: para scan

$ para scan

Scanning Inbox/ ...
[████████████████] 3 files found

Classifying (LLM)...
[████████████████] 3/3 complete (8.2s)

┌─────────────────────────────────────────────────────┐
│ 1/3: Kit CLI Documentation                          │
├─────────────────────────────────────────────────────┤
│ → Resources/Web/Kit CLI Documentation.md            │
│                                                     │
│ Confidence: 95% (heuristic: /docs/ pattern)         │
│ Reasoning: Documentation site, reference material   │
└─────────────────────────────────────────────────────┘
[a]pprove  [e]dit  [n]ext  [A]ll  [l]ist  [?]help  [q]uit
> A

Approved 3 items.

$ para execute

Preview:
  ✓ Kit CLI Documentation.md → Resources/Web/
  ✓ GitHub PR #1234.md → Projects/Web/
  ✓ NetBank Login.md → Areas/Web/

Execute? (y/N): y

Moving files...
[████████████████] 3/3 complete

✓ 3 bookmarks organized
✓ Registry updated

Undo available: para undo --last
```

---

## 9. Implementation Priority

### Phase 1: Quick Wins (1-2 days)
1. [ ] Add `--dry-run` flag to execute command
2. [ ] Add confirmation prompt before file moves
3. [ ] Add `para` alias in package.json scripts
4. [ ] Improve "0 files found" error message

### Phase 2: Core UX (3-5 days)
5. [ ] Quick-start mode for create-classifier wizard
6. [ ] Enhanced review commands (back, list, approve-all)
7. [ ] Progress indicators for scan/classify
8. [ ] Registry management commands (`list`, `remove`)

### Phase 3: Polish (2-3 days)
9. [ ] `para undo` command
10. [ ] Time estimates for LLM operations
11. [ ] SIGINT handling with resume support
12. [ ] Shell completion scripts

---

## Summary: Top 5 Priorities

1. **Add quick-start mode** — Skip 10-question wizard for common cases
2. **Dry-run by default** — Require confirmation before file moves
3. **Add `para undo`** — No manual JSON editing
4. **Progress indicators** — Time estimates for LLM classification
5. **Command aliases** — `para scan` not `bun run src/cli.ts process-inbox scan`
