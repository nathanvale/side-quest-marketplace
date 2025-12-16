# Frontmatter Fast-Path Integration Tests

## Status: **PENDING IMPLEMENTATION** (Phase 4)

These integration tests define the expected behavior for the frontmatter fast-path optimization feature. They currently **fail** because the feature has not been implemented yet.

---

## What These Tests Verify

### 1. Pre-tagged Notes Skip LLM (Performance Optimization)
- Notes with `type: bookmark` or `type: invoice` in frontmatter should skip LLM classification
- Detection source should be `"frontmatter"` not `"heuristic"` or `"llm"`
- No LLM-related warnings should appear
- Saves 2-5 seconds per note + API costs

**Current behavior:** Returns `"heuristic"` detection source, still fast but not transparent about source

### 2. Type Detection from Frontmatter
- Frontmatter `type` field should override content-based heuristics
- Even if content looks like different type, frontmatter wins
- All frontmatter fields should be extracted without LLM call

**Current behavior:** Uses heuristics regardless of frontmatter type field

### 3. Partial Frontmatter Uses LLM for Missing Fields
- If `type: bookmark` exists but `url` or `title` missing, use LLM to fill gaps
- Should preserve existing frontmatter fields
- Detection source should be `"llm"` (or possibly `"llm+frontmatter"`)

**Current behavior:** Returns `"llm+heuristic"` which is close but doesn't distinguish frontmatter contribution

### 4. Invalid Type Falls Back to LLM
- Unknown types like `type: unknown-document-type` should trigger LLM reclassification
- Should warn user about type correction
- LLM should correct based on content analysis

**Current behavior:** Returns `"llm+heuristic"`, warns appropriately

### 5. Empty/Missing Frontmatter Uses Full LLM
- `---\n---` (empty) or no frontmatter should trigger full LLM classification
- Should extract all fields via LLM

**Current behavior:** Returns `"none"` for empty frontmatter (unexpected), `"llm+heuristic"` for no frontmatter

### 6. PARA Field Detection
- Existing `para: Resources` or `area: "[[Health]]"` should be respected
- LLM suggestions should not override explicit frontmatter PARA assignments
- Area wikilinks should be preserved

**Current behavior:** Tests failing due to missing frontmatter detection source

### 7. Performance Optimization (Batch Processing)
- Batch of pre-tagged notes should avoid multiple LLM calls
- Mixed batches (tagged + untagged) should only call LLM for untagged files
- Significant time savings for bulk Web Clipper imports

**Current behavior:** All files use heuristics or LLM regardless of frontmatter

---

## Implementation Requirements

To make these tests pass, the following changes are needed:

### 1. Add `"frontmatter"` to `DetectionSource` type
**File:** `src/inbox/types.ts`

```typescript
export type DetectionSource =
  | "llm+heuristic"
  | "llm"
  | "heuristic"
  | "frontmatter"  // NEW: Pre-tagged from existing frontmatter
  | "none";
```

### 2. Check Frontmatter Before Heuristics/LLM
**File:** `src/inbox/classify/classifiers/loader.ts` or engine processing

Add frontmatter pre-check:
```typescript
// Before calling heuristics or LLM:
const frontmatter = extractFrontmatter(content);

if (frontmatter.type && isValidClassifierType(frontmatter.type)) {
  // Skip LLM entirely if type is valid and required fields present
  return {
    detectionSource: "frontmatter",
    documentType: frontmatter.type,
    extractedFields: frontmatter,
    confidence: 1.0
  };
}
```

### 3. Partial Frontmatter Detection
If frontmatter has type but missing required fields:
- Use LLM to extract missing fields
- Merge LLM results with existing frontmatter
- Mark as `"llm"` detection source (frontmatter provided initial type)

### 4. Update Suggestion Builder
**File:** `src/inbox/classify/classifiers/suggestion-builder.ts`

Handle new `"frontmatter"` detection source:
```typescript
if (frontmatterResult && frontmatterResult.hasValidType) {
  detectionSource = "frontmatter";
  confidence = "high"; // Pre-tagged notes are high confidence
  // ... use frontmatter fields directly
}
```

### 5. Update Tests After Implementation
Once implementation is complete:
- Run tests: `bun test test/integration/suites/frontmatter.integration.test.ts`
- All 15 tests should pass
- Verify performance: batch of 10 pre-tagged notes should be instant (no LLM calls)

---

## Performance Impact (Expected)

### Before Frontmatter Fast-Path
- 10 bookmarks from Web Clipper: 20-50 seconds (2-5s per LLM call)
- API costs: 10 LLM calls @ ~$0.01 each = $0.10

### After Frontmatter Fast-Path
- 10 pre-tagged bookmarks: <1 second (frontmatter parsing only)
- API costs: $0 (no LLM calls needed)
- **Speedup: 20-50x for Web Clipper workflows**

---

## Test Execution

```bash
# Run frontmatter tests (currently fail)
bun test test/integration/suites/frontmatter.integration.test.ts

# After implementation, should see:
# ✓ Frontmatter Fast Path (15 tests pass)
```

---

## Related Documentation

- **Phase 4 Plan:** See project docs for frontmatter fast-path implementation plan
- **Web Clipper Workflow:** `docs/BOOKMARK_WORKFLOW.md`
- **Classifier System:** `src/inbox/classify/classifiers/README.md`
- **Detection Sources:** `src/inbox/types.ts` (DetectionSource type)

---

## Notes

- These tests follow the "test-first" approach documenting expected behavior
- Tests use the integration test harness with real file operations
- LLM calls are mocked to verify they're NOT called for pre-tagged notes
- Tests verify end-to-end behavior (scan → execute → file creation)
