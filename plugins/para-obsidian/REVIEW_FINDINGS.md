# Para-Obsidian Code Review Findings

**Date:** 2025-12-24
**Reviewers:** 9 specialized agents (3 bug hunters, 3 code quality, 3 API contracts)
**Domains:** Inbox Engine, Execution/Operations, CLI/Config

---

## Priority 1: Critical Bugs (Fix Immediately)

### P1.1 Registry Race Condition
- **File:** `src/inbox/core/engine.ts:1078-1093`
- **Issue:** Cross-process corruption when concurrent execute() calls modify registry
- **Root Cause:** No cross-process file locking during save operations
- **Fix:** Add `withFileLock()` wrapper around entire load-modify-save cycle
- **Impact:** Data loss - processed items can be lost, causing re-processing

### P1.2 Path Traversal Bypass ✅ FIXED
- **File:** `src/config/index.ts:164-191`
- **Issue:** Malicious `PARA_OBSIDIAN_CONFIG=//etc/passwd` bypasses validation
- **Root Cause:** Incomplete path traversal regex (only checks for `..`)
- **Fix:** ✅ Removed `//` check, rely on canonicalized path validation
- **Impact:** Security - arbitrary file read via config loading
- **Tests Added:** 7 comprehensive security tests covering:
  - `..` traversal rejection
  - Absolute paths outside safe locations
  - Double-slash bypass attempts (`//etc/passwd`)
  - Multiple `..` escape attempts
  - Allowed paths within vault, cwd, and home/.config

### P1.3 Hash Verification After Move
- **File:** `src/inbox/execute/attachment-mover.ts:159-180`
- **Issue:** File moved BEFORE hash verification - corruption leaves bad state
- **Root Cause:** `moveFile()` executed before integrity check completes
- **Fix:** Compute hash BEFORE move, verify AFTER move, rollback on mismatch
- **Impact:** Data loss - original file gone, corrupted copy may persist

### P1.4 TOCTOU File Hashing
- **File:** `src/inbox/core/engine.ts:388-424`
- **Issue:** File could be deleted/modified between hash check and processing
- **Root Cause:** No file lock held during hash-to-extraction window
- **Fix:** Acquire file lock before hashing, hold until extraction completes
- **Impact:** Processing wrong content or crashes

### P1.5 Type A Registry Bypass
- **File:** `src/inbox/core/operations/execute-suggestion.ts:583-600`
- **Issue:** Type A documents (markdown source of truth) bypass idempotency
- **Root Cause:** `movedAttachment` undefined fails `restrictRegistryToAttachments` check
- **Fix:** Track Type A documents in registry with `itemType: "note"`
- **Impact:** Duplicate processing if source file restored

### P1.6 Exit Race Condition
- **File:** `src/cli.ts:388-390`
- **Issue:** CLI exits with code 0 before async command completes
- **Root Cause:** `.then(() => process.exit(0))` runs before main resolves
- **Fix:** Remove explicit exit, let process exit naturally or `await main()`
- **Impact:** CI/CD pipelines see false success

---

## Priority 2: High-Priority Bugs

### P2.1 Config Merge Order Violation
- **File:** `src/config/index.ts:281-285`
- **Issue:** User config silently overridden by project config
- **Root Cause:** Object spread merges in wrong order
- **Fix:** Reverse order to `{...projectRc, ...userRc, ...explicitRc}`

### P2.2 Registry Cleanup Race
- **File:** `src/inbox/execute/executor.ts:231-238`
- **Issue:** Registry entries removed before other processes read them
- **Root Cause:** No file-level lock during registry removal
- **Fix:** Move registry cleanup to AFTER all operations complete

### P2.3 Rollback Leaves Orphans
- **File:** `src/inbox/core/staging/rollback.ts:32-56`
- **Issue:** Failed `unlinkSync()` during rollback leaves orphaned notes
- **Root Cause:** No retry mechanism or cleanup job
- **Fix:** Add retry logic, implement staging folder cleanup on startup

### P2.4 Registry Save Failure Orphans State
- **File:** `src/inbox/core/operations/execute-suggestion.ts:811-824`
- **Issue:** In-memory registry cleared but save fails, leaving inconsistent state
- **Root Cause:** Two-phase update breaks atomicity
- **Fix:** Make `save()` throw exceptions that halt execution loop

### P2.5 Exit Code Swallowed
- **File:** `src/cli.ts:376-383`
- **Issue:** All errors exit with code 1, losing specific error context
- **Root Cause:** Catch block ignores `error.exitCode` property
- **Fix:** Check if thrown error has exitCode: `process.exit(error.exitCode ?? 1)`

### P2.6 Silent Config Failure
- **File:** `src/config/index.ts:140-150`
- **Issue:** Invalid JSON in config files silently uses defaults
- **Root Cause:** No try-catch wrapper around individual `loadJsonIfExists` calls
- **Fix:** Catch parse errors per file, log which configs loaded

---

## Priority 3: Code Quality (Refactoring)

### P3.1 Extract `processSingleFile` (376 lines → ~80)
- **File:** `src/inbox/core/engine.ts:349-725`
- **Extract to:**
  - `checkFileHash()` - lines 386-424
  - `extractFileContent()` - lines 442-483
  - `classifyWithLLM()` - lines 492-609
  - `detectDocumentType()` - lines 645-673

### P3.2 Extract `executeSuggestion` (578 lines → ~100)
- **File:** `src/inbox/core/operations/execute-suggestion.ts:279-857`
- **Extract to:**
  - `handlers/bookmark-handler.ts` - lines 506-775
  - `handlers/type-a-handler.ts` - lines 583-598
  - `handlers/type-b-handler.ts` - lines 608-808

### P3.3 Split Large Files (>200 lines)
- `src/inbox/enrich/strategies/youtube-strategy.ts` (463 lines)
- `src/inbox/enrich/bookmark-enricher.ts` (558 lines)

### P3.4 Handle Empty Catch Blocks
- `src/inbox/core/engine.ts:219` - Add logging
- `src/inbox/core/engine.ts:412` - Add logging

### P3.5 Replace Magic Numbers
- `src/inbox/core/engine.ts:618-629` - Use `CONFIDENCE_THRESHOLDS`
- `src/inbox/types.ts:359-368` - Use named constants

### P3.6 Complete Registry Rollback
- **File:** `src/inbox/execute/executor.ts:198-201`
- **Fix:** Clear registry in-progress marker during rollback

---

## Priority 4: API Contract Improvements

### P4.1 Export BaseSuggestion
- **File:** `src/inbox/types.ts:116`
- **Issue:** Base interface not exported, blocking composition
- **Fix:** `export interface BaseSuggestion { ... }`

### P4.2 Fix isRoutableSuggestion Type Guard
- **File:** `src/inbox/types.ts:316-319`
- **Issue:** Returns boolean, loses type narrowing
- **Fix:** Return type predicate `s is CreateNoteSuggestion & { suggestedDestination: string }`

### P4.3 Create FieldType Enum
- **File:** `src/config/index.ts:56`
- **Issue:** String literal union for field types
- **Fix:** `enum FieldType { String = "string", Date = "date", ... }`

### P4.4 Template Version Type Safety
- **File:** `src/config/defaults.ts:325-343`
- **Issue:** No type enforcement that every template has a version
- **Fix:** `const VERSIONS: Record<TemplateType, number> = { ... } satisfies ...`

### P4.5 Migration Path Validation
- **File:** `src/frontmatter/types.ts:362-365`
- **Issue:** `MigrationHooks` allows invalid version transitions (downgrades)
- **Fix:** Validate upgrade-only paths at registration time

### P4.6 Validate Classifier Field References
- **File:** `src/inbox/classify/classifiers/types.ts:32-49`
- **Issue:** `conditionalOn` can reference non-existent fields
- **Fix:** Add `createInboxConverter()` factory that validates references

### P4.7 Prevent ReDoS in Heuristic Patterns
- **File:** `src/inbox/classify/classifiers/types.ts:13-18`
- **Issue:** Raw string regex without validation
- **Fix:** Create `RegexPattern` value object with ReDoS detection

### P4.8 RoutingCandidate Invalid State
- **File:** `src/inbox/routing/types.ts:14-46`
- **Issue:** Both `area` and `project` optional, but one required
- **Fix:** Discriminated union: `AreaRouting | ProjectRouting`

---

## Quick Reference

### Files Most Affected
1. `src/inbox/core/engine.ts` - 5 issues
2. `src/inbox/core/operations/execute-suggestion.ts` - 4 issues
3. `src/config/index.ts` - 4 issues
4. `src/cli.ts` - 3 issues
5. `src/inbox/execute/executor.ts` - 2 issues

### Estimated Effort
| Priority | Count | Effort |
|----------|-------|--------|
| P1 Critical | 6 | 2-3 days |
| P2 High | 6 | 1-2 days |
| P3 Quality | 6 | 2-3 days |
| P4 Contracts | 8 | 1-2 days |

---

## Session Start Checklist

When resuming work on these findings:

1. **Start with security fix:** P1.2 Path Traversal Bypass
2. **Then data integrity:** P1.1 Registry Race, P1.3 Hash Verification
3. **Run full validation:** `bun run validate`
4. **Commit incrementally:** One fix per commit with conventional format

```bash
# Suggested first session commands
cd plugins/para-obsidian
bun test src/config  # Verify current state
# Fix P1.2, then:
bun test src/config  # Verify fix
git commit -m "fix(para-obsidian): prevent path traversal in config loading"
```
