# Migration Plan: Remove `title` Frontmatter Field

**Goal:** Establish filename as the single source of truth for note titles, eliminating redundant `title` frontmatter field.

**Impact:**
- 95 notes with `title` field in vault
- 18 templates with `title` field
- 16 note types with `title` in validation rules
- Multiple code paths that read/write `title`

---

## Rationale

### Current State (3 Sources of Truth)
1. **Filename** → `🧒🏼 Levi - Parenting.md`
2. **`title` frontmatter** → `title: Levi - Parenting`
3. **H1 heading** → `# Levi - Parenting`

### Problems
- **Triple maintenance burden** — Must keep all three in sync
- **Drift is inevitable** — Rename file, forget to update frontmatter
- **No Dataview usage** — `this.title` is never queried; Dataview uses `this.file.name`
- **ADHD tax** — Extra cognitive load with zero benefit

### Community Best Practice
From Nick Milo (Linking Your Thinking):
> "When I started I included 'title' etc that I realized I wasn't doing anything with, so I removed them all."

---

## Migration Phases

### Phase 1: Code Changes (para-obsidian plugin)

#### 1.1 Update Validation Rules
**File:** `src/config/defaults.ts`

Remove `title: { type: "string" }` from ALL note types:
- project, area, resource, task, daily, weekly-review
- capture, checklist, booking, itinerary, research
- trip, session, invoice, bookmark, medical-statement

```typescript
// BEFORE
project: {
  required: {
    title: { type: "string" },  // REMOVE
    created: { type: "date" },
    // ...
  }
}

// AFTER
project: {
  required: {
    created: { type: "date" },
    // ...
  }
}
```

#### 1.2 Update Routing Scanner
**File:** `src/inbox/routing/scanner.ts`

Change from reading `attributes.title` to deriving from filename:

```typescript
// BEFORE (line 103)
const title = attributes.title as string | undefined;

// AFTER
const title = basename(file, ".md");
```

Remove the "Missing title" skip logic (lines 110-120) since filename always exists.

#### 1.3 Update Routing Executor
**File:** `src/inbox/routing/executor.ts`

Already uses `candidate.title` — no change needed if scanner provides filename.

#### 1.4 Update Note Creation
**File:** `src/notes/create.ts`

Remove title injection into frontmatter (lines 386-387):

```typescript
// REMOVE this block
if (!attributes.title || attributes.title === "null") {
  attributes.title = displayTitle;
}
```

#### 1.5 Update LLM Orchestration
**File:** `src/llm/orchestration.ts`

- Keep extracting title from LLM for **filename generation**
- Stop writing it to frontmatter
- `extracted.title` becomes the filename, not a frontmatter field

#### 1.6 Update Markdown Extractor
**File:** `src/inbox/scan/extractors/markdown.ts`

Change title extraction priority:
```typescript
// BEFORE (lines 71-72)
if (typeof attributes.title === "string" && attributes.title.trim()) {
  return attributes.title.trim();
}

// AFTER - Remove this block, always use filename or H1
```

#### 1.7 Update Tests
Files to update:
- `src/cli/migrate-remove-tags.test.ts` — Remove `title` expectations
- `src/inbox/scan/extractors/markdown.test.ts` — Update title extraction tests
- `src/frontmatter/tests/frontmatter.test.ts` — Remove title assertions
- `mcp/index.test.ts` — Update frontmatter expectations

---

### Phase 2: Template Updates (Vault)

#### 2.1 Remove `title` from All Templates
**Location:** `/Users/nathanvale/code/my-second-brain/Templates/`

Templates to update (18 total):
- `area.md`, `project.md`, `resource.md`, `task.md`
- `daily.md`, `weekly-review.md`, `capture.md`
- `booking.md`, `checklist.md`, `itinerary.md`
- `invoice.md`, `medical-statement.md`, `research.md`
- `trip.md`, `cv.md`, `document.md`, `employment-contract.md`, `letter.md`

**Pattern to remove:**
```yaml
# REMOVE this line from frontmatter
title: "<% tp.system.prompt("...") %>"
```

**Keep H1 heading** — It provides visual context when reading the note.

#### 2.2 Template Version Bump
Bump `template_version` in `DEFAULT_TEMPLATE_VERSIONS` for all affected types.

---

### Phase 3: Vault Migration (Existing Notes)

#### 3.1 Create Migration Command
Add new CLI command: `para migrate:remove-title`

```bash
# Dry run first
para migrate:remove-title --dry-run

# Execute migration
para migrate:remove-title
```

**Logic:**
1. Find all `.md` files with `title:` in frontmatter
2. Parse frontmatter
3. Remove `title` field
4. Write back (atomic)
5. Git commit per batch

#### 3.2 Migration Script
```typescript
// src/cli/migrate-remove-title.ts
async function migrateRemoveTitle(options: { dryRun: boolean }) {
  const files = await findFilesWithTitle(vault);

  for (const file of files) {
    const { attributes, body } = parseFrontmatter(content);
    delete attributes.title;

    if (!options.dryRun) {
      await writeNote(file, { attributes, body });
    }
  }

  if (!options.dryRun) {
    await gitCommit("chore(vault): remove redundant title frontmatter");
  }
}
```

---

### Phase 4: Documentation Updates

#### 4.1 Update CLAUDE.md Files
- `plugins/para-obsidian/CLAUDE.md`
- `plugins/para-obsidian/src/inbox/CLAUDE.md`

Document that filename is the single source of truth.

#### 4.2 Update Commands Documentation
- `commands/create.md`
- `commands/create-classifier.md`
- `commands/create-note-template.md`

Remove references to `title` frontmatter field.

---

## Rollback Plan

If issues arise:
1. Git revert the code changes
2. Restore templates from git
3. Re-add `title` field via migration script (reverse operation)

---

## Testing Checklist

- [ ] Validation passes without `title` field
- [ ] Note creation works (filename from user input/LLM)
- [ ] Routing uses filename correctly
- [ ] Inbox scan extracts title from filename/H1
- [ ] Export bookmarks uses filename
- [ ] All tests pass
- [ ] Dry-run migration shows expected changes
- [ ] Full migration completes without errors

---

## Timeline

| Phase | Description | Estimate |
|-------|-------------|----------|
| 1 | Code changes | 2-3 hours |
| 2 | Template updates | 30 min |
| 3 | Vault migration | 1 hour |
| 4 | Documentation | 30 min |

**Total:** ~4-5 hours

---

## Decision Points

Before proceeding, confirm:

1. **H1 heading** — Keep it? (Provides visual context in note body)
2. **Bookmark exception** — Keep `title` for bookmarks? (URL-based filenames are ugly)
3. **Migration timing** — Do all at once or incremental?
