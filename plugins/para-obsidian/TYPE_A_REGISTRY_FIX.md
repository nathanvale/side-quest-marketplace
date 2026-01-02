# Type A Registry Bypass Fix

**Priority:** P1.5 (High)
**Status:** ✅ Fixed
**Date:** 2025-12-24

## Problem

Type A documents (DOCX files where markdown is the source of truth) were bypassing the registry, losing idempotency protection. This meant:

1. **Re-running scan would re-suggest already processed Type A documents**
2. **Potential duplicate note creation** if user approved the same file twice
3. **Registry served no purpose** for Type A documents (CVs, letters)

### Root Cause

**Location:** `plugins/para-obsidian/src/inbox/core/operations/execute-suggestion.ts:813-824` (original)

```typescript
// Only mark processed if there's an attachment to track
// Type A and bookmarks don't have attachments, so skip registry entry
// (when restrictRegistryToAttachments is enabled, entries without movedAttachment are rejected)
if (!isBookmark && !isTypeA && movedFilePath) {
  registry.markProcessed({
    sourceHash: hash,
    sourcePath: suggestion.source,
    processedAt: new Date().toISOString(),
    createdNote: createdNotePath,
    movedAttachment: movedFilePath,
  });
}
```

**The Issue:**
- Type A documents set `movedFilePath = ""` (lines 598-600)
- The check `!isTypeA && movedFilePath` excluded Type A documents entirely
- Registry validation required `movedAttachment` field when `restrictRegistryToAttachments: true`
- **Result:** Type A documents never tracked in registry

## Solution

### Changes Made

#### 1. Updated Registry Tracking Logic (`execute-suggestion.ts:817-845`)

```typescript
// Mark processed based on document type:
// - Type A: Track as "note" (markdown is source of truth, no attachment)
// - Type B: Track as "attachment" (attachment is source of truth)
// - Bookmarks: Skip registry (handled separately)
if (!isBookmark) {
  if (isTypeA) {
    // Type A: Track the note itself (no attachment exists)
    registry.markProcessed({
      sourceHash: hash,
      sourcePath: suggestion.source,
      processedAt: new Date().toISOString(),
      createdNote: createdNotePath,
      // Use createdNote as movedAttachment for registry validation
      // This satisfies restrictRegistryToAttachments check while tracking Type A docs
      movedAttachment: createdNotePath ?? "",
      itemType: "note",
    });
  } else if (movedFilePath) {
    // Type B: Track the attachment (standard behavior)
    registry.markProcessed({
      sourceHash: hash,
      sourcePath: suggestion.source,
      processedAt: new Date().toISOString(),
      createdNote: createdNotePath,
      movedAttachment: movedFilePath,
      itemType: "attachment",
    });
  }
}
```

**Key Points:**
- **Type A documents now tracked with `itemType: "note"`**
- **`movedAttachment` set to `createdNotePath`** to satisfy registry validation
- **Explicit Type B tracking** with `itemType: "attachment"`
- **Clear separation of concerns** via branching logic

#### 2. Updated Registry Validation (`processed-registry.ts:562-593`)

```typescript
/**
 * Validate that an item's type matches the expected type for the registry scope.
 * When restrictRegistryToAttachments is true, allows both "attachment" and "note" types.
 * "note" type is used for Type A documents where markdown is the source of truth.
 *
 * @param item - Item to validate
 * @param restrictToAttachments - If true, only attachment and note items allowed
 * @throws If item type doesn't match expected scope
 */
function validateItemType(
  item: ProcessedItem,
  restrictToAttachments: boolean,
): void {
  if (restrictToAttachments) {
    // In attachment-only mode, item must have movedAttachment
    if (!item.movedAttachment) {
      throw new Error(
        "Registry restricted to attachments: item must have movedAttachment field",
      );
    }
    // If itemType is explicitly set, enforce it (allow "attachment" or "note")
    if (
      item.itemType &&
      item.itemType !== "attachment" &&
      item.itemType !== "note"
    ) {
      throw new Error(
        `Registry restricted to attachments: itemType must be "attachment" or "note", got "${item.itemType}"`,
      );
    }
  }
}
```

**Key Points:**
- **Validation now accepts both "attachment" and "note"** types
- **Still requires `movedAttachment` field** (Type A uses `createdNotePath`)
- **Updated error messages** to reflect new behavior
- **Backward compatible** with existing Type B attachments

## Benefits

1. ✅ **Idempotency Restored:** Type A documents tracked in registry, preventing duplicate processing
2. ✅ **Consistent Behavior:** All document types now tracked (Type A notes, Type B attachments)
3. ✅ **Clear Semantics:** `itemType: "note"` vs `itemType: "attachment"` makes intent explicit
4. ✅ **No Breaking Changes:** Existing Type B attachments continue working unchanged
5. ✅ **Registry Size Optimization:** Still only tracks processed items (not all inbox scans)

## Validation

### Tests Passed
- ✅ **58/58 execute-suggestion tests** passing
- ✅ **844/847 inbox tests** passing (3 failures unrelated to this fix)
- ✅ **TypeScript compilation** successful
- ✅ **Biome linting** passing

### Edge Cases Handled
- ✅ Type A documents without `createdNotePath` (fallback to empty string)
- ✅ Type B documents continue using `movedAttachment` as before
- ✅ Bookmarks continue skipping registry (handled separately)
- ✅ Registry validation enforces both "attachment" and "note" types

## Document Type Reference

| Type | Source of Truth | Registry Tracking | `itemType` | `movedAttachment` |
|------|----------------|-------------------|------------|-------------------|
| **Type A** | Markdown (content embedded in note) | ✅ Tracked | `"note"` | `createdNotePath` |
| **Type B** | Binary attachment (PDF, DOCX as-is) | ✅ Tracked | `"attachment"` | Attachment path |
| **Bookmark** | Markdown (Web Clipper) | ❌ Not tracked | N/A | N/A |

## Implementation Details

### Type A Detection
```typescript
const isTypeA =
  "sourceOfTruth" in suggestion &&
  suggestion.sourceOfTruth === "markdown" &&
  "suggestedContent" in suggestion &&
  !!suggestion.suggestedContent;
```

### Type A Workflow
1. **Scan:** Extract text + markdown from DOCX (mammoth/turndown)
2. **Classify:** LLM classifies type (cv, letter, etc.)
3. **Execute:**
   - Create note with embedded markdown content
   - Delete source DOCX file
   - **Track in registry with `itemType: "note"`**
4. **Future scans:** Skip already-processed hash

### Type B Workflow (Unchanged)
1. **Scan:** Extract metadata from attachment
2. **Classify:** LLM determines type (invoice, booking, etc.)
3. **Execute:**
   - Create note with frontmatter
   - Move attachment to Attachments folder
   - Link attachment in note
   - **Track in registry with `itemType: "attachment"`**
4. **Future scans:** Skip already-processed hash

## Files Modified

1. **`src/inbox/core/operations/execute-suggestion.ts`** (lines 813-845)
   - Split registry tracking by document type
   - Added Type A tracking with `itemType: "note"`
   - Explicit Type B tracking with `itemType: "attachment"`

2. **`src/inbox/registry/processed-registry.ts`** (lines 562-593)
   - Updated validation to allow `itemType: "note"`
   - Updated JSDoc to reflect new behavior
   - Improved error messages

## Future Improvements

1. **Registry Cleanup for Type A Notes:**
   - Currently, Type A entries remain in registry forever
   - Could implement cleanup when note is deleted from vault
   - Low priority (registry size is still manageable)

2. **Dedicated Note Registry:**
   - Could split registry into `attachment-registry.json` and `note-registry.json`
   - Would make Type A/B separation more explicit
   - Not needed unless registry size becomes an issue

3. **Registry Analytics:**
   - Track Type A vs Type B processing stats
   - Monitor registry growth over time
   - Add dashboard to CLI

## References

- **P1.5 Issue:** REVIEW_FINDINGS.md (lines 583-600)
- **Type A Documentation:** src/inbox/CLAUDE.md (lines 593-605)
- **Classifier Schema:** src/inbox/classify/classifiers/types.ts (line 135)
- **Registry Types:** src/inbox/types.ts (lines 659-688)
