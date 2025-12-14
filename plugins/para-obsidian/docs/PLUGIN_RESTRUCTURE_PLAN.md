# Para-Obsidian Plugin Restructure Plan

**Date:** December 2025
**Goal:** Make the plugin ADHD-friendly with clear, predictable structure
**Status:** ✅ **COMPLETED**

**Completion Date:** December 14, 2025
**Final Result:** All objectives achieved. Plugin now has clear, ADHD-friendly structure with organized domains and clean root directory containing only `cli.ts` (CLI-first architecture).

---

## TL;DR - Key Findings

| Orphan File | Dependents | Destination | Risk |
|-------------|------------|-------------|------|
| `migrations.ts` | **0 (DEAD CODE!)** | **DELETE** | None |
| `fs.ts` | 19 files | `shared/fs.ts` | High |
| `test-utils.ts` | 14 test files | `testing/utils.ts` | Medium |
| `logger.ts` | 9 files | `shared/logger.ts` | Medium |
| `indexer.ts` | 5 files | `search/indexer.ts` | Low |
| `llm.ts` | 3 files | `llm/client.ts` | Low |
| `cli-helpers.ts` | 1 file | `cli/helpers.ts` | Low |
| `kit-check.ts` | 1 file | `search/kit-check.ts` | Low |

**Quick wins:**
1. Delete `migrations.ts` (dead code, duplicate of `templates/migrations.ts`)
2. Move low-risk files first (`kit-check.ts`, `cli-helpers.ts`, `llm.ts`)
3. Move high-risk files last with careful import updates

---

## The Problem

The current plugin structure has grown organically and is now cognitively overwhelming:

### Root-Level Chaos (21 files in `src/`)

```
src/
├── cli-helpers.ts              # Helper for CLI - but there's a cli/ folder!
├── cli.frontmatter.suggest.test.ts  # Why not in cli/ or frontmatter/?
├── cli.frontmatter.test.ts     # Same problem
├── cli.helpers.test.ts         # Inconsistent naming (cli-helpers vs cli.helpers)
├── cli.rename.test.ts          # Should be in cli/ folder
├── cli.test.ts                 # Should be in cli/ folder
├── cli.ts                      # Main CLI entry - ok to be here
├── frontmatter.filename.test.ts # Should be in frontmatter/ folder
├── frontmatter.migrate.test.ts  # Should be in frontmatter/ folder
├── frontmatter.plan.test.ts     # Should be in frontmatter/ folder
├── frontmatter.test.ts          # Should be in frontmatter/ folder
├── fs.test.ts                   # Infrastructure utility
├── fs.ts                        # Infrastructure utility
├── indexer.test.ts              # Should be with search or separate folder
├── indexer.ts                   # Should be with search or separate folder
├── kit-check.ts                 # Development utility for semantic search
├── llm.test.ts                  # Should be in llm/ folder
├── llm.ts                       # There's already an llm/ folder!
├── logger.ts                    # Shared utility - no folder home
├── migrations.ts                # DUPLICATE of templates/migrations.ts!
└── test-utils.ts                # Test helper - no folder home
```

**Pain Points:**

1. **Scattered test files** - Tests at root level instead of with their modules
2. **Duplicate files** - `migrations.ts` at root is identical to `templates/migrations.ts`
3. **Duplicate naming** - `llm.ts` at root AND `llm/` folder
4. **Inconsistent naming** - `cli-helpers.ts` vs `cli.helpers.test.ts`
5. **No clear home** - `logger.ts`, `test-utils.ts`, `fs.ts` are orphans
6. **Monster folders** - inbox/ has 105 symbols, 30+ files

### Monster Files (Over 15KB)

| File | Size | Problem |
|------|------|---------|
| `inbox/engine.ts` | 34KB | Too many responsibilities |
| `git/index.test.ts` | 32KB | Huge test file |
| `notes/create.test.ts` | 32KB | Huge test file |
| `inbox/engine.test.ts` | 26KB | Huge test file |
| `llm/orchestration.ts` | 24KB | Should split by concern |
| `cli/frontmatter.ts` | 24KB | Too many CLI commands |
| `mcp-handlers/frontmatter.ts` | 22KB | Too many handlers |
| `git/index.ts` | 20KB | Should split by operation |
| `templates/index.ts` | 20KB | Should split by concern |
| `inbox/types.ts` | 18KB | Type dumping ground |

### Confusing Folder Organization

```
src/
├── cli/                    # CLI handlers - GOOD
├── mcp-handlers/           # MCP handlers - GOOD
├── inbox/                  # Big messy module (see separate plan)
├── frontmatter/            # Core frontmatter logic
├── llm/                    # BUT llm.ts is at root!
├── config/                 # Good
├── git/                    # Good
├── links/                  # Good
├── notes/                  # Good
├── search/                 # Good but indexer.ts is at root!
├── templates/              # Good
├── attachments/            # Good
└── utils/                  # Domain utils (title, wikilinks) - Good
```

**Questions I can't quickly answer:**

- Where do I find LLM stuff? `llm.ts` or `llm/`?
- Where are CLI tests? Root level or `cli/`?
- Where's the logger? Root level (orphan)
- Where's indexing? `indexer.ts` at root or `search/`?
- What's `kit-check.ts`? Dev utility for semantic search

---

## Dependency Analysis (via Kit)

### `logger.ts` - Shared infrastructure (KEEP AT ROOT or move to shared/)
**Imported by:**
- `cli/process-inbox.ts`
- `inbox/cli.ts`
- `inbox/llm-detection.ts`
- `inbox/engine.ts`
- `inbox/logger.test.ts`
- `inbox/detection/pdf-processor.ts`
- `inbox/infrastructure/processed-registry.ts`
- `inbox/registry/processed-registry.ts`
- `mcp/utils.ts`

### `fs.ts` - Shared infrastructure (KEEP AT ROOT or move to shared/)
**Imported by:**
- `attachments/index.ts`
- `attachments/link.ts`
- `cli/notes.ts`
- `frontmatter/migrate.ts`
- `frontmatter/update.ts`
- `frontmatter/validate.ts`
- `git/index.ts`
- `inbox/engine.ts`
- `indexer.ts`
- `links/clean.ts`
- `links/index.ts`
- `links/orphans.ts`
- `llm/orchestration.ts`
- `mcp-handlers/files.ts`
- `notes/create.ts`
- `notes/delete.ts`
- `notes/insert.ts`
- `search/index.ts`
- `search/semantic.ts`
- `fs.test.ts`

### `llm.ts` - LLM client utilities (MOVE TO llm/client.ts)
**Imported by:**
- `cli/create.ts`
- `llm/orchestration.ts`
- `llm.test.ts`

### `indexer.ts` - Vault indexing (MOVE TO search/indexer.ts)
**Imported by:**
- `cli/config.ts`
- `cli/search.ts`
- `llm/orchestration.ts`
- `mcp-handlers/indexer.ts`
- `indexer.test.ts`

### `migrations.ts` - DUPLICATE FILE (DELETE!)
**Imported by:** NOTHING (dead code!)
**Note:** `templates/migrations.ts` is the one being used

### `test-utils.ts` - Test utilities (MOVE TO testing/utils.ts)
**Imported by:**
- `cli.frontmatter.test.ts`
- `cli.rename.test.ts`
- `cli.test.ts`
- `config/index.test.ts`
- `fs.test.ts`
- `git/autocommit.test.ts`
- `git/index.test.ts`
- `indexer.test.ts`
- `links/index.test.ts`
- `links/orphans.test.ts`
- `links/rewrite.test.ts`
- `notes/create.test.ts`
- `notes/delete.test.ts`
- `search/index.test.ts`

### `cli-helpers.ts` - CLI arg parsing (MOVE TO cli/helpers.ts)
**Imported by:**
- `cli.helpers.test.ts`

### `kit-check.ts` - Kit CLI availability check (MOVE TO search/kit-check.ts)
**Imported by:**
- `search/semantic.ts`

---

## The Solution: Clear Domain Organization

### Principle 1: Tests Live With Source

Move all `*.test.ts` files to sit alongside their source in `tests/` subdirectories:

```
# Before (scattered)
src/cli.test.ts
src/cli.frontmatter.test.ts
src/frontmatter.test.ts

# After (organized)
src/cli/tests/cli.test.ts
src/cli/tests/frontmatter.test.ts
src/frontmatter/tests/frontmatter.test.ts
```

### Principle 2: No Orphan Files at Root

Every file should have a folder home:

```
# Before (orphans)
src/llm.ts           # Orphan - there's an llm/ folder!
src/logger.ts        # Orphan
src/fs.ts            # Orphan
src/test-utils.ts    # Orphan
src/indexer.ts       # Orphan
src/migrations.ts    # DUPLICATE - DELETE!

# After (organized)
src/llm/client.ts           # Move llm.ts → llm/client.ts
src/shared/logger.ts        # Create shared/ folder
src/shared/fs.ts            # Infrastructure utilities
src/testing/utils.ts        # Test utilities
src/search/indexer.ts       # Move with search
```

### Principle 3: CLI-First Architecture

Only this file should be at `src/` root:

```
src/
└── cli.ts            # CLI entry point (executable)
```

**Rationale:** This is a CLI-first plugin where `cli.ts` is the main entry point. No public API index needed since the CLI is the "front door".

---

## Proposed Structure

```
para-obsidian/
├── .claude-plugin/        # Plugin metadata (keep)
├── commands/              # Slash commands (keep)
├── docs/                  # Documentation (keep)
├── hooks/                 # Claude hooks (keep)
├── mcp/                   # MCP server (keep)
├── scripts/               # Shell scripts (keep)
├── skills/                # Claude skills (keep)
│
└── src/
    ├── index.ts           # Public API exports
    ├── cli.ts             # CLI entry point
    │
    ├── cli/               # CLI HANDLERS (all CLI logic)
    │   ├── index.ts
    │   ├── config.ts
    │   ├── create.ts
    │   ├── frontmatter.ts
    │   ├── git.ts
    │   ├── helpers.ts     # ← moved from src/cli-helpers.ts
    │   ├── links.ts
    │   ├── notes.ts
    │   ├── process-inbox.ts
    │   ├── search.ts
    │   ├── types.ts
    │   ├── utils.ts
    │   └── tests/         # CLI tests grouped
    │       ├── cli.test.ts
    │       ├── frontmatter.test.ts
    │       ├── frontmatter-suggest.test.ts
    │       ├── helpers.test.ts
    │       ├── rename.test.ts
    │       └── utils.test.ts
    │
    ├── mcp-handlers/      # MCP HANDLERS (keep as-is, well organized)
    │   ├── index.ts
    │   ├── config.ts
    │   ├── files.ts
    │   ├── frontmatter.ts
    │   ├── indexer.ts
    │   ├── links.ts
    │   └── search.ts
    │
    ├── frontmatter/       # FRONTMATTER DOMAIN
    │   ├── index.ts
    │   ├── types.ts
    │   ├── parse.ts
    │   ├── validate.ts
    │   ├── migrate.ts
    │   ├── update.ts
    │   └── tests/
    │       ├── frontmatter.test.ts
    │       ├── filename.test.ts
    │       ├── migrate.test.ts
    │       └── plan.test.ts
    │
    ├── notes/             # NOTES DOMAIN
    │   ├── index.ts
    │   ├── create.ts
    │   ├── delete.ts
    │   ├── insert.ts
    │   └── tests/
    │       ├── create.test.ts
    │       ├── delete.test.ts
    │       └── insert.test.ts
    │
    ├── templates/         # TEMPLATES DOMAIN
    │   ├── index.ts
    │   ├── migrations.ts  # ← THE authoritative migrations file
    │   └── tests/
    │       ├── index.test.ts
    │       └── extract-headings.test.ts
    │
    ├── links/             # LINKS DOMAIN
    │   ├── index.ts
    │   ├── clean.ts
    │   ├── orphans.ts
    │   ├── rewrite.ts
    │   └── tests/
    │       ├── index.test.ts
    │       ├── orphans.test.ts
    │       └── rewrite.test.ts
    │
    ├── attachments/       # ATTACHMENTS DOMAIN
    │   ├── index.ts
    │   ├── link.ts
    │   └── tests/
    │       └── index.test.ts
    │
    ├── search/            # SEARCH DOMAIN
    │   ├── index.ts
    │   ├── indexer.ts     # ← moved from src/indexer.ts
    │   ├── semantic.ts
    │   ├── kit-check.ts   # ← moved from src/kit-check.ts
    │   └── tests/
    │       ├── index.test.ts
    │       ├── indexer.test.ts
    │       └── semantic.test.ts
    │
    ├── git/               # GIT DOMAIN
    │   ├── index.ts
    │   └── tests/
    │       ├── index.test.ts
    │       └── autocommit.test.ts
    │
    ├── llm/               # LLM DOMAIN
    │   ├── index.ts
    │   ├── client.ts      # ← moved from src/llm.ts
    │   ├── orchestration.ts
    │   ├── prompt-builder.ts
    │   ├── constraints.ts
    │   └── tests/
    │       ├── client.test.ts
    │       ├── orchestration.test.ts
    │       ├── prompt-builder.test.ts
    │       └── constraints.test.ts
    │
    ├── config/            # CONFIG DOMAIN
    │   ├── index.ts
    │   ├── defaults.ts
    │   └── tests/
    │       └── index.test.ts
    │
    ├── utils/             # DOMAIN UTILS (keep - well organized)
    │   ├── index.ts
    │   ├── title.ts
    │   └── wikilinks.ts
    │
    ├── inbox/             # INBOX DOMAIN (see separate plan)
    │   └── ... (see INBOX_FOLDER_RESTRUCTURE_PLAN.md)
    │
    ├── shared/            # SHARED INFRASTRUCTURE (new!)
    │   ├── index.ts
    │   ├── logger.ts      # ← moved from src/logger.ts
    │   └── fs.ts          # ← moved from src/fs.ts
    │
    └── testing/           # TEST UTILITIES (new!)
        ├── index.ts
        └── utils.ts       # ← moved from src/test-utils.ts
```

---

## Mental Model

**"Where do I find X?"**

| I want to... | Go to folder |
|--------------|--------------|
| Add CLI command | `cli/` |
| Add MCP tool | `mcp-handlers/` |
| Work with frontmatter | `frontmatter/` |
| Create/edit notes | `notes/` |
| Work with templates | `templates/` |
| Fix link issues | `links/` |
| Manage attachments | `attachments/` |
| Search vault | `search/` |
| Git operations | `git/` |
| AI/LLM stuff | `llm/` |
| Config loading | `config/` |
| Process inbox | `inbox/` |
| Shared utilities (logger, fs) | `shared/` |
| Test helpers | `testing/` |

---

## Migration Steps

### Phase 1: Delete Duplicates ⚠️ LOW RISK
- [ ] Delete `src/migrations.ts` (duplicate of `templates/migrations.ts`, NOT imported anywhere)

### Phase 2: Create New Folders
- [ ] Create `src/shared/` folder
- [ ] Create `src/testing/` folder
- [ ] Create test subdirectories in each domain folder

### Phase 3: Move Shared Infrastructure
**Files with many dependents - update imports carefully!**

| File | Move To | Dependents |
|------|---------|------------|
| `src/logger.ts` | `src/shared/logger.ts` | 9 files |
| `src/fs.ts` | `src/shared/fs.ts` | 19 files |

### Phase 4: Move LLM Client
| File | Move To | Dependents |
|------|---------|------------|
| `src/llm.ts` | `src/llm/client.ts` | 3 files |
| `src/llm.test.ts` | `src/llm/tests/client.test.ts` | 0 files |

### Phase 5: Move Search-Related Files
| File | Move To | Dependents |
|------|---------|------------|
| `src/indexer.ts` | `src/search/indexer.ts` | 5 files |
| `src/indexer.test.ts` | `src/search/tests/indexer.test.ts` | 0 files |
| `src/kit-check.ts` | `src/search/kit-check.ts` | 1 file |

### Phase 6: Move CLI Helpers
| File | Move To | Dependents |
|------|---------|------------|
| `src/cli-helpers.ts` | `src/cli/helpers.ts` | 1 file |
| `src/cli.helpers.test.ts` | `src/cli/tests/helpers.test.ts` | 0 files |

### Phase 7: Move Test Utilities
| File | Move To | Dependents |
|------|---------|------------|
| `src/test-utils.ts` | `src/testing/utils.ts` | 14 test files |

### Phase 8: Consolidate Root-Level Tests
| File | Move To |
|------|---------|
| `src/cli.test.ts` | `src/cli/tests/cli.test.ts` |
| `src/cli.frontmatter.test.ts` | `src/cli/tests/frontmatter.test.ts` |
| `src/cli.frontmatter.suggest.test.ts` | `src/cli/tests/frontmatter-suggest.test.ts` |
| `src/cli.rename.test.ts` | `src/cli/tests/rename.test.ts` |
| `src/frontmatter.test.ts` | `src/frontmatter/tests/frontmatter.test.ts` |
| `src/frontmatter.filename.test.ts` | `src/frontmatter/tests/filename.test.ts` |
| `src/frontmatter.migrate.test.ts` | `src/frontmatter/tests/migrate.test.ts` |
| `src/frontmatter.plan.test.ts` | `src/frontmatter/tests/plan.test.ts` |
| `src/fs.test.ts` | `src/shared/tests/fs.test.ts` |

### Phase 9: Create/Update Index Files
- [ ] Create `src/shared/index.ts` with exports
- [ ] Create `src/testing/index.ts` with exports
- [ ] Update `src/llm/index.ts` to export client
- [ ] Update `src/search/index.ts` to export indexer and kit-check

**Note:** No root-level `src/index.ts` needed - CLI-first architecture uses `cli.ts` as entry point.

### Phase 10: Verification
- [ ] Run `bun typecheck` to verify all imports
- [ ] Run `bun test` to verify all tests pass
- [ ] Update `CLAUDE.md` with new structure

---

## Import Update Reference

### When moving `logger.ts` → `shared/logger.ts`

Update imports in:
```typescript
// Before
import { ... } from "../logger";
import { ... } from "./logger";

// After
import { ... } from "../shared/logger";
import { ... } from "./shared/logger";
// OR from deeper: import { ... } from "../../shared/logger";
```

### When moving `fs.ts` → `shared/fs.ts`

Update imports in:
```typescript
// Before
import { ... } from "../fs";
import { ... } from "./fs";

// After
import { ... } from "../shared/fs";
import { ... } from "./shared/fs";
// OR from deeper: import { ... } from "../../shared/fs";
```

---

## Success Criteria

1. **No orphan files** - Every source file has a domain folder
2. **No duplicates** - `migrations.ts` duplicate deleted
3. **Tests with source** - All tests in `tests/` subdirectory of their domain
4. **Clear mental model** - "Where is X?" has ONE obvious answer
5. **Root is clean** - Only `index.ts` and `cli.ts` at `src/` root
6. **All tests pass** - No functionality changes, just reorganization

---

## Notes

- This is purely structural - no code logic changes
- Run tests after each phase
- Keep changes incremental
- The `inbox/` folder has its own restructure plan (see `INBOX_FOLDER_RESTRUCTURE_PLAN.md`)
- Use `git mv` to preserve file history

---

## Related Documents

- `INBOX_FOLDER_RESTRUCTURE_PLAN.md` - Detailed inbox module restructure
- `INBOX_CONTRACT_DESIGN_IMPROVEMENTS.md` - Contract design improvements (completed)
