# Web Clipper E2E Test Plan

**Version:** 1.0
**Last Updated:** 2025-12-16
**Owner:** Nathan Vale

---

## Overview

This document outlines the end-to-end testing strategy for the para-obsidian Web Clipper integration, covering the complete workflow from bookmark capture to browser export.

## System Under Test

**Workflow Stages:**
```
Web Clipper → Raw Capture → Inbox Scan → Classification →
Suggestion → Review → Execution → PARA Note → Browser Export
```

**Key Components:**
- Obsidian Web Clipper plugin
- Inbox processing engine (scan/classify/execute)
- Bookmark classifier (content-based, threshold 0.3)
- LLM orchestration (with heuristic fallback)
- Frontmatter validation (with URL pattern validation)
- Export to Netscape Bookmark Format

---

## Prerequisites

### Environment Setup

1. **Obsidian Vault:**
   ```bash
   export PARA_VAULT=/path/to/test-vault
   ```

2. **PARA Folder Structure:**
   ```
   test-vault/
   ├── 00 Inbox/           # Raw captures land here
   ├── 01 Projects/
   ├── 02 Areas/
   ├── 03 Resources/
   ├── 04 Archives/
   └── Templates/
       └── bookmark.md     # Bookmark template
   ```

3. **Dependencies:**
   - Bun runtime installed
   - Ollama running (for LLM tests): `ollama serve`
   - Haiku model pulled: `ollama pull haiku`
   - Web Clipper extension installed in browser

4. **Configuration:**
   ```json
   // .para-obsidianrc
   {
     "vault": "/path/to/test-vault",
     "autoCommit": false,  // Disable for testing
     "defaultModel": "haiku"
   }
   ```

---

## Test Data Preparation

### 1. Web Clipper Template Configuration

Ensure Web Clipper uses this template:
```markdown
---
type: bookmark
url: {{url}}
title: {{title}}
clipped: {{date:YYYY-MM-DD}}
template_version: 1
---

# {{title}}

{{content}}
```

### 2. Test URLs (Cover Different Scenarios)

| Scenario | URL | Expected Category |
|----------|-----|-------------------|
| Tech documentation | https://kit.cased.com/docs | Resources |
| Travel destination | https://www.japan.travel | Projects (if trip active) |
| News article | https://www.bbc.com/news/article | Resources |
| GitHub repo | https://github.com/anthropics/claude-code | Resources |
| Video tutorial | https://www.youtube.com/watch?v=example | Resources |
| Local tool | http://localhost:3000/docs | Projects |

### 3. Edge Case URLs

- Empty title: Web page with no `<title>` tag
- Long title: Title >100 characters
- Special characters: Title with emoji, unicode
- Missing metadata: No author, no publish date
- Invalid protocol: `ftp://example.com` (should fail validation)
- No protocol: `example.com` (should fail validation)

---

## Manual E2E Test Procedure

### Test Case 1: Happy Path - Single Bookmark

**Objective:** Verify complete workflow from capture to export.

**Steps:**

1. **Capture (Web Clipper)**
   ```
   1. Open https://kit.cased.com/docs in browser
   2. Click Web Clipper extension
   3. Verify template loads correctly
   4. Click "Clip to vault"
   5. Verify success notification
   ```

   **Expected Result:**
   - File created in `00 Inbox/` with frontmatter
   - Filename: `🔖 Kit - Code Intelligence Platform.md`

2. **Scan**
   ```bash
   bun run src/cli.ts process-inbox scan
   ```

   **Expected Result:**
   ```
   Found 1 unprocessed item:
   - 🔖 Kit - Code Intelligence Platform.md
   ```

3. **Classify**
   ```bash
   bun run src/cli.ts process-inbox scan --verbose
   ```

   **Expected Result:**
   - Matches bookmark classifier (score ≥ 0.3)
   - Shows content-only fields used
   - Shows LLM fallback fields (if any)

4. **Execute (Interactive)**
   ```bash
   bun run src/cli.ts process-inbox execute
   ```

   **Interactive Steps:**
   - Review suggestion
   - Verify PARA category auto-selected (Resources)
   - Verify category field populated
   - Accept suggestion (press Enter)

   **Expected Result:**
   - Note moved to `03 Resources/Bookmarks/`
   - Frontmatter includes `para: Resources`
   - All required fields present
   - Original inbox file deleted

5. **Validate**
   ```bash
   bun run src/cli.ts frontmatter validate "03 Resources/Bookmarks/🔖 Kit - Code Intelligence Platform.md"
   ```

   **Expected Result:**
   ```
   ✓ Valid frontmatter
   - type: bookmark
   - para: Resources
   - url: https://kit.cased.com/docs (pattern matched)
   - title: Kit - Code Intelligence Platform
   - clipped: 2025-12-16
   - template_version: 1
   ```

6. **Export**
   ```bash
   bun run src/cli.ts export-bookmarks --out ~/test-bookmarks.html
   ```

   **Expected Result:**
   - HTML file created
   - Contains bookmark under "Resources" category
   - ADD_DATE uses clipped timestamp
   - Alphabetically sorted

7. **Import to Browser**
   ```
   1. Open Chrome/Firefox
   2. Bookmarks → Import bookmarks
   3. Select ~/test-bookmarks.html
   4. Verify bookmark appears in "Resources" folder
   ```

   **Expected Result:**
   - Bookmark imported successfully
   - Correct title, URL, folder
   - Timestamp matches clipped date

---

### Test Case 2: Batch Processing

**Objective:** Test handling multiple bookmarks simultaneously.

**Steps:**

1. Capture 5 bookmarks from different domains
2. Run `process-inbox scan` → should find 5 items
3. Run `process-inbox execute` → review each suggestion
4. Validate all 5 notes created successfully
5. Export → verify all appear in HTML

**Expected Result:**
- All bookmarks processed without errors
- No duplicate filenames (collision handling works)
- Export groups by PARA category

---

### Test Case 3: LLM Fallback

**Objective:** Verify graceful degradation when LLM unavailable.

**Steps:**

1. Stop Ollama: `pkill ollama`
2. Capture bookmark
3. Run `process-inbox scan --verbose`

**Expected Result:**
- Classification proceeds using heuristics only
- Warning shows LLM fallback occurred
- Suggestion shows which fields used fallback
- Execution succeeds with heuristic values

---

### Test Case 4: Invalid URL Validation

**Objective:** Test URL pattern validation catches invalid URLs.

**Steps:**

1. Manually create bookmark with invalid URL:
   ```markdown
   ---
   type: bookmark
   url: example.com  # Missing protocol
   title: Test
   clipped: 2025-12-16
   template_version: 1
   ---
   ```

2. Run validation:
   ```bash
   bun run src/cli.ts frontmatter validate "00 Inbox/Test.md"
   ```

**Expected Result:**
```
✗ Invalid frontmatter:
- url: must match pattern ^https?://, got "example.com"
```

---

### Test Case 5: Filter Flag

**Objective:** Test export filtering by frontmatter fields.

**Steps:**

1. Create bookmarks in different PARA categories
2. Export with filter:
   ```bash
   bun run src/cli.ts export-bookmarks --filter "type:bookmark,para:Resources"
   ```

**Expected Result:**
- Only Resources bookmarks included
- Projects/Areas/Archives excluded
- HTML shows single category

---

### Test Case 6: MCP Tool Integration

**Objective:** Test programmatic export via MCP server.

**Steps:**

1. Start MCP server (Claude Code should auto-start it)
2. Call tool via Claude:
   ```
   Use para_export_bookmarks with output_path="~/test.html"
   ```

**Expected Result:**
- Response includes resolved absolute path (not `~/test.html`)
- File created successfully
- Valid Netscape HTML format

---

## Automated Test Scenarios

### Unit Tests (Existing)

- ✅ Bookmark classifier matching (76 tests)
- ✅ Export bookmarks (9 tests)
- ✅ Frontmatter validation (332 tests)
- ✅ URL pattern validation

### Integration Tests (To Be Created)

**File:** `src/inbox/e2e-webclipper.test.ts`

```typescript
describe("Web Clipper E2E", () => {
  test("full workflow: capture → classify → execute → export", async () => {
    // Setup test vault
    // Create raw bookmark in inbox
    // Run scan
    // Run classify
    // Auto-accept suggestion
    // Run execute
    // Validate final note
    // Export to HTML
    // Verify HTML contents
  });

  test("batch processing with collision handling", async () => {
    // Create 3 bookmarks with same title
    // Process all
    // Verify filename deduplication
  });

  test("invalid URL rejected during validation", async () => {
    // Create bookmark with ftp:// URL
    // Validate should fail
  });

  test("para field optional for raw captures", async () => {
    // Create bookmark without para field
    // Validate should pass
    // After classification, para added
    // Validate should still pass
  });
});
```

### Performance Tests

```typescript
describe("Web Clipper Performance", () => {
  test("processes 100 bookmarks in <10 seconds", async () => {
    // Create 100 bookmarks
    // Measure scan time
    // Measure classify time
    // Measure execute time
  });

  test("export 1000 bookmarks in <5 seconds", async () => {
    // Create 1000 bookmark notes
    // Measure export time
    // Verify HTML size reasonable
  });
});
```

---

## Edge Cases & Failure Scenarios

### 1. Duplicate URL Detection

**Scenario:** Same URL bookmarked twice

**Expected:**
- Second bookmark gets deduplicated filename
- Both bookmarks preserved (different capture dates)

### 2. Missing Template

**Scenario:** bookmark.md template doesn't exist

**Expected:**
- Clear error message
- Suggests creating template
- Workflow halts gracefully

### 3. Git Conflicts

**Scenario:** Uncommitted changes in vault during processing

**Expected:**
- Git guard detects uncommitted changes
- Warning shown before LLM processing
- Option to commit or abort

### 4. Malformed Frontmatter

**Scenario:** Web Clipper creates invalid YAML

**Expected:**
- Parsing error caught
- Shows specific syntax error
- Suggests manual fix

### 5. Network Timeout (LLM)

**Scenario:** Ollama request times out

**Expected:**
- Graceful fallback to heuristics
- Warning logged
- Processing continues

### 6. Filename Too Long

**Scenario:** URL title >255 characters

**Expected:**
- Title truncated for filename
- Full title preserved in frontmatter
- No filesystem errors

### 7. Special Characters in Title

**Scenario:** Title contains `/`, `?`, `*` (invalid filename chars)

**Expected:**
- Characters sanitized in filename
- Original title preserved in frontmatter

### 8. Empty Inbox

**Scenario:** No items to process

**Expected:**
```
No unprocessed items found in inbox.
```

---

## Validation Checklist

### Pre-Execution Validation

- [ ] PARA folders exist
- [ ] bookmark.md template exists
- [ ] Vault has no uncommitted changes (or disabled git guard)
- [ ] Ollama running (for LLM tests)

### Post-Capture Validation

- [ ] File exists in `00 Inbox/`
- [ ] Filename has 🔖 prefix
- [ ] Frontmatter has all required fields:
  - [ ] `type: bookmark`
  - [ ] `url` (valid http/https)
  - [ ] `title`
  - [ ] `clipped` (date format)
  - [ ] `template_version: 1`

### Post-Classification Validation

- [ ] Classifier matched (score ≥ 0.3)
- [ ] Suggestion shows correct template
- [ ] PARA category auto-selected
- [ ] All fields populated (LLM or heuristics)

### Post-Execution Validation

- [ ] Note moved to correct PARA folder
- [ ] Frontmatter includes `para` field
- [ ] All required fields valid
- [ ] Original inbox file deleted
- [ ] No filename collisions

### Post-Export Validation

- [ ] HTML file created at resolved path
- [ ] Valid Netscape Bookmark Format:
  ```html
  <!DOCTYPE NETSCAPE-Bookmark-file-1>
  <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
  <TITLE>Bookmarks</TITLE>
  <H1>Bookmarks</H1>
  <DL><p>
  ```
- [ ] Bookmarks grouped by PARA category
- [ ] Alphabetically sorted within categories
- [ ] ADD_DATE uses clipped timestamp (not created)
- [ ] All URLs valid and escaped

---

## Test Metrics

### Coverage Targets

- **Unit Tests:** 80% code coverage
- **Integration Tests:** 100% workflow coverage
- **E2E Tests:** All happy paths + critical edge cases

### Performance Targets

- **Scan:** <1s for 100 items
- **Classify:** <5s for 100 items (with LLM)
- **Execute:** <10s for 100 items
- **Export:** <5s for 1000 bookmarks

### Quality Gates

All tests must pass before:
- Merging to main
- Creating release
- Deploying to production

---

## Test Data Cleanup

After testing:

```bash
# Remove test bookmarks
rm -rf "$PARA_VAULT/00 Inbox/🔖 "*.md
rm -rf "$PARA_VAULT/03 Resources/Bookmarks/"

# Remove test export
rm ~/test-bookmarks.html

# Reset git (if needed)
cd "$PARA_VAULT" && git reset --hard HEAD
```

---

## Known Issues & Workarounds

### Issue 1: Web Clipper Template Sync

**Problem:** Web Clipper template out of sync with bookmark.md

**Workaround:** Manually update Web Clipper template in browser

**Long-term Fix:** Create sync command to update Web Clipper from template

### Issue 2: LLM Rate Limiting

**Problem:** Ollama rate limits on large batches

**Workaround:** Process in smaller batches (20 items max)

**Long-term Fix:** Implement backoff/retry logic

---

## Future Enhancements

1. **Automated E2E Tests in CI**
   - Spin up test vault
   - Run full workflow
   - Validate outputs
   - Teardown

2. **Visual Regression Testing**
   - Screenshot exported HTML
   - Compare against baseline
   - Detect layout changes

3. **Cross-Browser Testing**
   - Test import in Chrome, Firefox, Safari, Edge
   - Verify bookmark structure preserved

4. **Stress Testing**
   - 10,000 bookmarks
   - Concurrent processing
   - Memory profiling

---

## Appendix: Test URLs

### Real-World Test Set

```
# Technology
https://kit.cased.com/docs
https://github.com/anthropics/claude-code
https://code.visualstudio.com/docs

# Travel
https://www.japan.travel
https://www.tripadvisor.com/Tourism-g294232-Tokyo_Tokyo_Prefecture_Kanto-Vacations.html

# News
https://www.bbc.com/news
https://www.theguardian.com/world

# Learning
https://www.coursera.org/learn/machine-learning
https://www.youtube.com/watch?v=example

# Reference
https://developer.mozilla.org/en-US/docs/Web/JavaScript
https://docs.python.org/3/
```

### Edge Case Test Set

```
# Protocol variants
http://example.com
https://example.com

# Invalid (should fail validation)
ftp://example.com
example.com
mailto:test@example.com

# Special characters
https://example.com/path?query=value&foo=bar#anchor
https://example.com/🚀/emoji/path

# Localhost
http://localhost:3000
http://127.0.0.1:8080
```
