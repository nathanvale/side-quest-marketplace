# Integration Test Guide

**ADHD-Friendly Documentation** — Get from zero to shipping tests in 20 minutes.

---

## Quick Start (5 minutes)

### Running Tests

```bash
# All integration tests
bun test test/integration

# Single classifier suite
bun test test/integration/suites/bookmark.integration.test.ts

# Watch mode for TDD workflow
bun test --watch test/integration

# Run with verbose output
bun test --verbose test/integration

# Run specific test by name
bun test test/integration --test-name-pattern "bookmark creation with all fields"
```

### Your First Test (Copy/Paste Ready)

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createTestHarness } from "../helpers";
import { FIXTURE_REGISTRY } from "../fixtures";
import { assertNoteExists, assertFrontmatterMatches } from "../helpers/assertions";

describe("Bookmark Classifier Integration", () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  test("bookmark creation with all fields", async () => {
    // 1. Load fixture with expected LLM response
    const fixture = FIXTURE_REGISTRY.bookmark.complete;
    harness.setLLMResponse(fixture._mockLLMResponse);

    // 2. Add test file to inbox
    await harness.addToInbox(
      fixture.input.filename,
      fixture.input.content
    );

    // 3. Execute workflow
    await harness.scan();
    await harness.execute();

    // 4. Assert note was created correctly
    await assertNoteExists(
      harness.vault,
      fixture.expectedOutcome.noteCreated
    );

    // 5. Verify frontmatter fields
    await assertFrontmatterMatches(
      harness.vault,
      fixture.expectedOutcome.noteCreated,
      fixture.expectedOutcome.frontmatter
    );
  });
});
```

**What just happened:**
1. Test harness creates isolated temp vault
2. Fixture provides mock LLM response (no Ollama needed!)
3. File added to inbox, workflow runs
4. Assertions verify note creation + frontmatter
5. Cleanup happens automatically in `afterEach`

---

## Test Harness Architecture

### Core Components

```
TestHarness
├── Vault (isolated temp directory)
├── Mock LLM Client (fixture responses)
├── InboxScanner (scan for files)
├── WorkflowExecutor (process files)
└── Cleanup Tracker (auto-remove files)
```

### What the Harness Does for You

| Feature | Benefit |
|---------|---------|
| **Isolated Vault** | Tests never conflict, safe parallel execution |
| **Mock LLM** | No Ollama required, deterministic responses |
| **Auto-cleanup** | No manual file deletion, no leftover state |
| **File Tracking** | Knows what was created, helps with assertions |
| **Config Injection** | Override vault path, templates, etc. |

### API Reference

```typescript
// Create harness
const harness = createTestHarness()
const harness = createTestHarness({ vaultPath: "/custom/path" })

// Set LLM responses
harness.setLLMResponse({ title: "My Bookmark", url: "..." })
harness.setLLMResponse(new Error("LLM timeout")) // Test error handling

// Add files to inbox
await harness.addToInbox("bookmark.md", "# Content")
await harness.addToInbox("article.txt", "Plain text")

// Execute workflow
await harness.scan() // Find files in inbox
await harness.execute() // Process all found files
await harness.execute({ dryRun: true }) // Preview without creating

// Query state
harness.getCreatedNotes() // Array of note paths
harness.getVaultPath() // Absolute path to test vault
harness.getConfig() // Current vault config

// Cleanup (automatic in afterEach, but can call manually)
harness.cleanup()
```

---

## Fixture Registry

### Structure

```
fixtures/
├── index.ts           # FIXTURE_REGISTRY export
├── bookmark/
│   ├── complete.ts    # All fields populated
│   ├── minimal.ts     # Only required fields
│   └── invalid.ts     # Missing required fields
├── article/
│   ├── complete.ts
│   └── minimal.ts
└── task/
    ├── complete.ts
    └── minimal.ts
```

### Fixture Anatomy

```typescript
export const bookmarkComplete: DocumentTypeFixture<BookmarkDocument> = {
  // Test metadata
  _meta: {
    description: "Bookmark with all optional fields populated",
    classifier: "bookmark",
    variant: "complete"
  },

  // Mock LLM response (what classifier receives from Ollama)
  _mockLLMResponse: {
    title: "Comprehensive TypeScript Guide",
    url: "https://typescriptlang.org/docs",
    author: "TypeScript Team",
    tags: ["typescript", "programming", "reference"],
    datePublished: "2024-01-15",
    summary: "Official TypeScript documentation covering all features"
  },

  // Input file (what appears in inbox)
  input: {
    filename: "bookmark-complete.md",
    content: `# Comprehensive TypeScript Guide
URL: https://typescriptlang.org/docs
Author: TypeScript Team
Published: 2024-01-15

Official TypeScript documentation covering all features`
  },

  // Expected outcome after workflow
  expectedOutcome: {
    noteCreated: "resources/bookmarks/comprehensive-typescript-guide.md",
    frontmatter: {
      title: "Comprehensive TypeScript Guide",
      url: "https://typescriptlang.org/docs",
      author: "TypeScript Team",
      tags: ["typescript", "programming", "reference"],
      datePublished: "2024-01-15",
      summary: "Official TypeScript documentation covering all features"
    },
    inboxFileDeleted: true
  }
}
```

### Fixture Categories

| Category | Purpose | Example Fixtures |
|----------|---------|------------------|
| **complete** | All fields populated | Full frontmatter, all optional fields |
| **minimal** | Only required fields | Bare minimum for valid note |
| **invalid** | Missing required data | Test error handling paths |
| **edge-cases** | Unusual but valid data | Unicode, long text, special chars |

---

## Writing a New Fixture

### Step-by-Step Guide

**1. Choose fixture category and create file**

```bash
touch test/integration/fixtures/bookmark/edge-case-unicode.ts
```

**2. Use the fixture helper function**

```typescript
import { createDocumentTypeFixture } from "../helpers";
import type { BookmarkDocument } from "@/src/inbox/classify/classifiers/definitions/bookmark";

export const bookmarkUnicode = createDocumentTypeFixture<BookmarkDocument>({
  _meta: {
    description: "Bookmark with unicode characters in title",
    classifier: "bookmark",
    variant: "edge-case"
  },

  _mockLLMResponse: {
    title: "日本語のブックマーク",
    url: "https://example.com/unicode",
    tags: ["unicode", "日本語"],
    summary: "Testing unicode support"
  },

  input: {
    filename: "unicode-bookmark.md",
    content: "# 日本語のブックマーク\nURL: https://example.com/unicode"
  },

  expectedOutcome: {
    noteCreated: "resources/bookmarks/日本語のブックマーク.md",
    frontmatter: {
      title: "日本語のブックマーク",
      url: "https://example.com/unicode",
      tags: ["unicode", "日本語"],
      summary: "Testing unicode support"
    },
    inboxFileDeleted: true
  }
});
```

**3. Register in fixture registry**

```typescript
// test/integration/fixtures/index.ts
import { bookmarkUnicode } from "./bookmark/edge-case-unicode";

export const FIXTURE_REGISTRY = {
  bookmark: {
    complete: bookmarkComplete,
    minimal: bookmarkMinimal,
    unicode: bookmarkUnicode // <-- Add here
  }
}
```

**4. Write test using new fixture**

```typescript
test("handles unicode characters in bookmark title", async () => {
  const fixture = FIXTURE_REGISTRY.bookmark.unicode;
  harness.setLLMResponse(fixture._mockLLMResponse);

  await harness.addToInbox(fixture.input.filename, fixture.input.content);
  await harness.scan();
  await harness.execute();

  await assertNoteExists(harness.vault, fixture.expectedOutcome.noteCreated);
});
```

**5. TypeScript will error if schema changes**

```typescript
// If BookmarkDocument schema adds required field:
type BookmarkDocument = {
  title: string;
  url: string;
  priority: "high" | "medium" | "low"; // <-- NEW REQUIRED FIELD
}

// Your fixture will error:
_mockLLMResponse: {
  title: "...",
  url: "..."
  // TypeScript error: Property 'priority' is missing
}
```

Fix by updating fixture:
```typescript
_mockLLMResponse: {
  title: "...",
  url: "...",
  priority: "medium" // <-- Add new field
}
```

---

## Custom Assertions

### Available Assertions

```typescript
// Note existence
await assertNoteExists(vaultPath, "resources/bookmarks/my-note.md")
await assertNoteNotExists(vaultPath, "inbox/processed-file.md")

// Frontmatter validation
await assertFrontmatterMatches(vaultPath, notePath, {
  title: "Expected Title",
  tags: ["tag1", "tag2"]
})

// Partial frontmatter (only check specific fields)
await assertFrontmatterContains(vaultPath, notePath, {
  tags: ["must-have-tag"]
})

// File deletion
await assertInboxFileDeleted(vaultPath, "inbox/processed-file.md")

// Content validation
await assertNoteContent(vaultPath, notePath, expectedContent)
await assertNoteContentContains(vaultPath, notePath, "substring")

// Template application
await assertTemplateApplied(vaultPath, notePath, "bookmark")
```

### Writing Custom Assertions

```typescript
// test/integration/helpers/assertions.ts
export async function assertTagsInclude(
  vaultPath: string,
  notePath: string,
  expectedTags: string[]
): Promise<void> {
  const fullPath = path.join(vaultPath, notePath);
  const content = await readTextFile(fullPath);
  const frontmatter = parseFrontmatter(content);

  const actualTags = frontmatter.tags || [];
  for (const tag of expectedTags) {
    if (!actualTags.includes(tag)) {
      throw new Error(
        `Expected tag "${tag}" not found. Actual tags: ${actualTags.join(", ")}`
      );
    }
  }
}

// Use in tests
await assertTagsInclude(harness.vault, "my-note.md", ["typescript", "programming"])
```

---

## Debugging Test Failures

### Common Errors and Solutions

#### 1. Note Not Created

**Error:**
```
AssertionError: Note not found: resources/bookmarks/my-note.md
```

**Checklist:**
- [ ] Did `harness.scan()` find the inbox file?
  ```typescript
  const files = await harness.scan()
  console.log("Found files:", files) // Should include your test file
  ```

- [ ] Did `harness.execute()` run without errors?
  ```typescript
  try {
    await harness.execute()
  } catch (error) {
    console.error("Execution failed:", error)
  }
  ```

- [ ] Is the expected path correct?
  ```typescript
  const created = harness.getCreatedNotes()
  console.log("Actually created:", created)
  ```

- [ ] Did the classifier detect the document type?
  ```typescript
  harness.setLLMResponse(fixture._mockLLMResponse) // Make sure this matches fixture
  ```

#### 2. Frontmatter Mismatch

**Error:**
```
AssertionError: Frontmatter field 'title' mismatch
  Expected: "My Title"
  Actual: "my title"
```

**Solutions:**

```typescript
// Check exact frontmatter written
const fullPath = path.join(harness.vault, notePath)
const content = await readTextFile(fullPath)
console.log("Actual frontmatter:", content.split("---")[1])

// Common issues:
// - Case sensitivity: "My Title" vs "my title"
// - Extra whitespace: "title " vs "title"
// - Array formatting: ["tag"] vs "tag"
// - Date formatting: "2024-01-15" vs 2024-01-15
```

**Fix fixture to match actual behavior:**
```typescript
expectedOutcome: {
  frontmatter: {
    title: "my title", // Match actual casing
    tags: ["tag1", "tag2"], // Array format
    datePublished: "2024-01-15" // String format
  }
}
```

#### 3. Harness Cleanup Failures

**Error:**
```
Error: ENOENT: no such file or directory
```

**Cause:** Cleanup tried to delete already-deleted file

**Solution:**
```typescript
// Option 1: Check file exists before cleanup
afterEach(() => {
  if (harness) {
    harness.cleanup({ skipMissing: true })
  }
})

// Option 2: Catch cleanup errors
afterEach(() => {
  try {
    harness.cleanup()
  } catch (error) {
    console.warn("Cleanup warning:", error.message)
  }
})
```

#### 4. LLM Response Not Applied

**Error:**
```
AssertionError: Expected frontmatter field 'author' to be "John Doe", got undefined
```

**Cause:** Forgot to set LLM response, or set it after workflow ran

**Solution:**
```typescript
// WRONG: Set response after execution
await harness.scan()
await harness.execute()
harness.setLLMResponse(fixture._mockLLMResponse) // Too late!

// CORRECT: Set response before execution
harness.setLLMResponse(fixture._mockLLMResponse)
await harness.scan()
await harness.execute()
```

#### 5. Test Flakiness (Passes Sometimes)

**Symptoms:**
- Test passes locally, fails in CI
- Test passes alone, fails in suite

**Causes & Fixes:**

```typescript
// 1. Shared state between tests
// BAD: Reusing harness across tests
let harness = createTestHarness()
test("test 1", async () => { /* uses harness */ })
test("test 2", async () => { /* uses same harness */ })

// GOOD: Fresh harness per test
beforeEach(() => { harness = createTestHarness() })

// 2. Async timing issues
// BAD: Not awaiting async operations
harness.addToInbox("file.md", "content") // Missing await!
await harness.scan()

// GOOD: Always await
await harness.addToInbox("file.md", "content")
await harness.scan()

// 3. File system race conditions
// BAD: Checking file immediately after creation
await createNote(path)
const exists = await pathExists(path) // Might not be flushed yet

// GOOD: Use assertions with retry logic
await assertNoteExists(vaultPath, path) // Retries up to 3 times
```

---

## Advanced Patterns

### Testing LLM Error Handling

```typescript
test("handles LLM timeout gracefully", async () => {
  // Simulate LLM error
  harness.setLLMResponse(new Error("Request timeout"))

  await harness.addToInbox("bookmark.md", "# Content")
  await harness.scan()

  // Execute should not throw
  await harness.execute()

  // Note should not be created
  await assertNoteNotExists(harness.vault, "resources/bookmarks/content.md")

  // Inbox file should remain (not deleted on error)
  await assertNoteExists(harness.vault, "inbox/bookmark.md")
})
```

### Testing Concurrent Processing

```typescript
test("processes multiple files concurrently", async () => {
  const fixtures = [
    FIXTURE_REGISTRY.bookmark.complete,
    FIXTURE_REGISTRY.article.complete,
    FIXTURE_REGISTRY.task.complete
  ]

  // Add all files to inbox
  for (const fixture of fixtures) {
    harness.setLLMResponse(fixture._mockLLMResponse)
    await harness.addToInbox(fixture.input.filename, fixture.input.content)
  }

  // Process all at once
  await harness.scan()
  await harness.execute({ parallel: true })

  // Verify all notes created
  for (const fixture of fixtures) {
    await assertNoteExists(harness.vault, fixture.expectedOutcome.noteCreated)
  }
})
```

### Testing Template Application

```typescript
test("applies bookmark template correctly", async () => {
  const fixture = FIXTURE_REGISTRY.bookmark.complete
  harness.setLLMResponse(fixture._mockLLMResponse)

  await harness.addToInbox(fixture.input.filename, fixture.input.content)
  await harness.scan()
  await harness.execute()

  // Verify template sections present
  const notePath = fixture.expectedOutcome.noteCreated
  await assertNoteContentContains(harness.vault, notePath, "## Summary")
  await assertNoteContentContains(harness.vault, notePath, "## Notes")
  await assertNoteContentContains(harness.vault, notePath, "## Related")
})
```

### Testing Dry Run Mode

```typescript
test("dry run previews without creating files", async () => {
  const fixture = FIXTURE_REGISTRY.bookmark.complete
  harness.setLLMResponse(fixture._mockLLMResponse)

  await harness.addToInbox(fixture.input.filename, fixture.input.content)
  await harness.scan()

  // Dry run returns preview
  const preview = await harness.execute({ dryRun: true })

  // No files created
  expect(harness.getCreatedNotes()).toHaveLength(0)

  // Preview shows what would be created
  expect(preview).toContainEqual({
    action: "create",
    path: fixture.expectedOutcome.noteCreated,
    frontmatter: fixture.expectedOutcome.frontmatter
  })
})
```

---

## FAQ

### General Questions

**Q: Do I need Ollama running to run tests?**

A: No. Tests use `createTestLLMClient()` which returns fixture responses. No network calls, no Ollama dependency.

**Q: Can I run tests in parallel?**

A: Yes. Each test gets an isolated temp vault, so tests never conflict. Bun runs tests in parallel by default.

**Q: How do I skip cleanup for debugging?**

A: Set `KEEP_TEST_VAULTS=1`:
```bash
KEEP_TEST_VAULTS=1 bun test test/integration
```
Vaults will be preserved in `/tmp/para-obsidian-test-*` for inspection.

**Q: What if I want to test with a real LLM?**

A: Use the `createRealLLMHarness()` helper:
```typescript
const harness = createRealLLMHarness({ ollamaModel: "llama3.2:3b" })
// No need to set mock responses, uses actual Ollama
```

### Fixture Questions

**Q: How do I update all fixtures when schema changes?**

A: TypeScript will error on all fixtures with missing fields. Fix each one individually, or use the migration helper:
```bash
bun run scripts/migrate-fixtures.ts --add-field priority:medium
```

**Q: Can I share fixtures across test files?**

A: Yes. Fixtures are exported from `FIXTURE_REGISTRY`, accessible anywhere:
```typescript
import { FIXTURE_REGISTRY } from "../fixtures"
const fixture = FIXTURE_REGISTRY.bookmark.complete
```

**Q: Should I test every possible field combination?**

A: No. Use **equivalence partitioning**:
- **Complete**: All fields populated
- **Minimal**: Only required fields
- **Invalid**: Missing required fields
- **Edge cases**: Unusual but valid data

**Q: How do I test optional field validation?**

A: Create fixture with invalid optional value:
```typescript
_mockLLMResponse: {
  title: "Valid",
  url: "https://example.com",
  priority: "invalid-value" // Should fail validation
}
```

### Debugging Questions

**Q: Test passes locally but fails in CI?**

A: Common causes:
1. **Timing**: CI slower, async race conditions exposed
   - Fix: Use assertions with retries
2. **File paths**: Windows vs Unix path separators
   - Fix: Always use `path.join()`, never string concatenation
3. **Environment**: CI missing env vars
   - Fix: Check `process.env` values in test

**Q: How do I see what files were created?**

A: Use harness inspection methods:
```typescript
console.log("Created notes:", harness.getCreatedNotes())
console.log("Vault path:", harness.getVaultPath())

// Or list vault directory
import { readDirRecursive } from "@sidequest/core/fs"
const files = await readDirRecursive(harness.getVaultPath())
console.log("All files:", files)
```

**Q: How do I debug LLM responses?**

A: Enable debug logging:
```typescript
const harness = createTestHarness({ debug: true })
// Logs all LLM requests/responses to console
```

### Advanced Questions

**Q: Can I test with a real vault instead of temp directory?**

A: Yes, but not recommended (state pollution). If needed:
```typescript
const harness = createTestHarness({
  vaultPath: "/path/to/real/vault",
  skipCleanup: true
})
```

**Q: How do I test classifier selection logic?**

A: Don't set LLM response. Let classifier auto-detect:
```typescript
// No harness.setLLMResponse() call
await harness.addToInbox("bookmark.md", "URL: https://example.com")
await harness.scan()
await harness.execute()

// Verify correct classifier was chosen
const created = harness.getCreatedNotes()
expect(created[0]).toMatch(/resources\/bookmarks\//)
```

**Q: How do I test multi-step workflows?**

A: Chain harness operations:
```typescript
// Step 1: Create bookmark
await harness.addToInbox("bookmark.md", "...")
await harness.scan()
await harness.execute()

// Step 2: Update bookmark with new tags
harness.setLLMResponse({ tags: ["new-tag"] })
await harness.update("resources/bookmarks/my-note.md")

// Step 3: Archive bookmark
await harness.archive("resources/bookmarks/my-note.md")
await assertNoteExists(harness.vault, "archive/bookmarks/my-note.md")
```

---

## Reference Links

- **Fixture Examples**: `test/integration/fixtures/`
- **Harness Source**: `test/integration/helpers/test-harness.ts`
- **Assertion Helpers**: `test/integration/helpers/assertions.ts`
- **Suite Examples**: `test/integration/suites/`

---

## TDD Workflow (Recommended)

```bash
# 1. Start watch mode
bun test --watch test/integration

# 2. Create fixture (test will fail)
# test/integration/fixtures/bookmark/new-variant.ts

# 3. Write failing test
# test/integration/suites/bookmark.integration.test.ts

# 4. Implement classifier logic
# src/inbox/classify/classifiers/definitions/bookmark.ts

# 5. Test passes, refactor
# Watch mode re-runs automatically

# 6. Commit
git add .
git commit -m "feat(para-obsidian): add bookmark unicode support"
```

**ADHD tip:** Use watch mode for instant feedback. Dopamine hits every time test turns green.

---

## Next Steps

1. **Read a real test suite**: `test/integration/suites/bookmark.integration.test.ts`
2. **Explore fixtures**: `test/integration/fixtures/bookmark/`
3. **Write your first test**: Copy the "Quick Start" example above
4. **Ask questions**: File an issue or DM @nathanvale

Happy testing! 🚀
