# Inbox Processing Framework

**5-stage pipeline for automated file processing with LLM-powered classification and interactive approval**

---

## Quick Reference

**Type:** TypeScript module (part of para-obsidian plugin)
**Runtime:** Bun
**Test Pattern:** `*.test.ts` alongside source
**Architecture:** Domain-driven design with clear separation of concerns

---

## Pipeline Stages

```
┌─────────┐    ┌──────────┐    ┌─────────┐    ┌────────┐    ┌─────────┐
│  Scan   │───▶│ Classify │───▶│ Suggest │───▶│ Review │───▶│ Execute │
└─────────┘    └──────────┘    └─────────┘    └────────┘    └─────────┘
     │              │               │              │              │
 Extract        Classifier      Build          User          Create
 content        Registry       suggestions     approve        notes
(Git guard)  (Schema version) (LLM fallback) (Warnings)  (Collision safe)
```

**Recent Enhancements:**
- Classifier registry with schema versioning (v1.0)
- Bookmark classifier for Obsidian Web Clipper content
- Git guard prevents LLM calls on uncommitted changes
- LLM fallback transparency shows which fields used heuristics
- Filename collision handling with automatic deduplication
- Timestamped attachment filenames for unique naming
- Enhanced CLI with visual progress bars and shorter aliases
- Enhanced review commands: approve-all (A), back (b), list (l)
- Quick-start wizard with `--quick` flag
- Registry management commands (list, remove, clear)
- Export bookmarks command for browser-compatible output

---

## Directory Structure

```
src/inbox/
├── types.ts                   # Core types (39 symbols)
├── index.ts                   # Public API barrel
├── core/                      # Main engine
│   ├── engine.ts              # InboxEngine factory (with git guard, LLM fallback)
│   ├── engine-utils.ts        # Title/filename generation (collision handling)
│   ├── operations/            # Execution operations
│   │   ├── execute-suggestion.ts  # Suggestion executor (atomic, auto-commit)
│   │   └── report.ts          # Markdown report generation
│   ├── staging/               # Temporary file management
│   │   ├── cleanup.ts         # Orphaned staging cleanup
│   │   └── rollback.ts        # Transaction rollback (vault-relative paths)
│   ├── llm/                   # LLM client wrapper
│   │   └── client.ts          # callLLM with fallback transparency
│   └── vault/                 # Vault context
│       └── context.ts         # Projects/areas loader
├── classify/                  # Document classification
│   ├── llm-classifier.ts      # LLM-based detection (with fallback transparency)
│   ├── classifiers/           # NEW: Classifier registry system
│   │   ├── definitions/       # Built-in classifier modules
│   │   │   ├── _template.ts   # Classifier template
│   │   │   ├── booking.ts     # Travel/booking classifier
│   │   │   ├── bookmark.ts    # Web bookmark classifier (Obsidian Web Clipper)
│   │   │   ├── invoice.ts     # Invoice/receipt classifier
│   │   │   ├── medical-statement.ts  # Medical statement classifier
│   │   │   ├── research.ts    # Research paper classifier
│   │   │   ├── index.ts       # Barrel exports
│   │   │   └── README.md      # Classifier creation guide
│   │   ├── registry.ts        # Classifier registry with schema versioning
│   │   ├── loader.ts          # Classifier matching logic
│   │   ├── suggestion-builder.ts  # Build suggestions from classifiers
│   │   ├── types.ts           # Classifier schemas (InboxConverter)
│   │   └── migrations/        # Schema migrations
│   │       ├── index.ts       # Migration registry
│   │       ├── migrate.ts     # Migration executor
│   │       └── README.md      # Migration guide
│   ├── detection/             # Content processors
│   │   └── pdf-processor.ts  # PDF extraction + heuristics
│   └── converters/            # Legacy converter system (being phased out)
│       ├── defaults.ts        # Built-in converters
│       ├── loader.ts          # Converter matching
│       ├── suggestion-builder.ts  # Suggestion creation
│       └── types.ts           # Converter schemas
├── scan/                      # Content extraction
│   └── extractors/            # File type handlers
│       ├── markdown.ts        # .md extraction
│       ├── image.ts           # Image vision extraction
│       ├── pdf.ts             # PDF text extraction
│       ├── registry.ts        # Extractor registry
│       └── types.ts           # Extractor schemas
├── execute/                   # Suggestion execution
│   ├── executor.ts            # Main execution logic (atomic operations)
│   ├── note-creator.ts        # Note creation (filename collision handling)
│   ├── attachment-mover.ts    # Attachment handling
│   └── attachment-linker.ts   # Link insertion
├── registry/                  # Processed items tracking
│   └── processed-registry.ts  # SHA256-based dedup
├── ui/                        # Terminal interaction
│   ├── cli-adapter.ts         # Interactive approval loop (with inline warnings, execute cmd)
│   └── index.ts               # Public UI exports
└── shared/                    # Cross-cutting concerns
    └── errors.ts              # InboxError types
```

---

## Key Types (src/inbox/types.ts)

### Pipeline Types

```typescript
type Confidence = "high" | "medium" | "low"
type ProcessorType = "convert-to-note" | "move-attachment" | "skip"
type InboxAction = "create-note" | "move" | "rename" | "link" | "skip" | "challenge"

// Unique suggestion identifier
type SuggestionId = `suggestion-${string}`
```

### Suggestion Types (Discriminated Union)

```typescript
interface CreateNoteSuggestion {
  id: SuggestionId
  action: "create-note"
  source: string
  confidence: Confidence
  reason: string
  suggestedTitle: string
  suggestedNoteType: string
  suggestedArea?: string
  suggestedContent: string
}

type InboxSuggestion =
  | CreateNoteSuggestion
  | MoveSuggestion
  | RenameSuggestion
  | LinkSuggestion
  | SkipSuggestion
  | ChallengeSuggestion
```

### Engine Interface

```typescript
interface InboxEngine {
  scan(options?: ScanOptions): Promise<InboxSuggestion[]>
  execute(ids: SuggestionId[], options?: ExecuteOptions): Promise<ExecutionResult[]>
  editWithPrompt(id: SuggestionId, prompt: string): Promise<InboxSuggestion>
  challenge(suggestion: ChallengeSuggestion): Promise<InboxSuggestion>
  generateReport(results: ExecutionResult[]): string
}
```

---

## Core Engine (src/inbox/core/engine.ts)

### Factory Pattern

```typescript
const engine = createInboxEngine({
  vaultPath: "/path/to/vault",
  inboxFolder: "00 Inbox",              // Default
  attachmentsFolder: "Attachments",     // Default
  templatesFolder: "Templates",         // Default
  llmProvider: "haiku",                 // Default: Claude Haiku
  llmModel?: "specific-model",          // Optional override
  concurrency?: {                        // Concurrency limits
    pdfExtraction: 5,
    fileIO: 3
  }
})
```

### Main Operations

**scan()** - Find files, extract content, classify, build suggestions
- **Git Guard**: Checks for uncommitted changes first (aborts if found)
- Loads processed registry (SHA256 dedup)
- Finds supported files (.md, .pdf, images)
- Validates dependencies (pdf-to-text for PDFs)
- Builds vault context (projects, areas)
- Processes files in parallel (p-limit concurrency)
- Skips already-processed items
- **LLM Fallback Transparency**: Tracks which fields used LLM vs heuristics
- Returns suggestion array with fallback metadata

**execute()** - Apply approved suggestions
- Validates suggestion IDs
- Executes sequentially (atomic registry saves)
- Creates notes with frontmatter (with filename collision handling)
- Moves attachments (vault-relative paths for rollback safety)
- **Auto-commit**: Commits changes to vault (enabled by default)
- Updates registry
- Returns execution results

**editWithPrompt()** - Re-process with user guidance
- Re-extracts content
- Calls LLM with additional prompt
- Returns updated suggestion

**challenge()** - Request LLM justification
- Provides detailed reasoning for suggestion
- Returns challenge response

**generateReport()** - Create markdown summary
- Formats execution results
- Includes success/failure counts

---

## Classifier System (src/inbox/classify/classifiers/)

### Overview

The classifier system provides modular, versioned document type detection with schema migrations.

**Key Features:**
- **Schema Versioning**: Each classifier has a `schemaVersion` field
- **Migrations**: Automatic upgrades when schemas change
- **Heuristics First**: Pattern matching before expensive LLM calls
- **Extensible**: Add new classifiers without modifying core code

### Classifier Structure

```typescript
interface InboxConverter {
  schemaVersion: number
  id: string
  displayName: string
  enabled: boolean
  priority: number

  heuristics: {
    filenamePatterns: Array<{ pattern: string; weight: number }>
    contentMarkers: Array<{ pattern: string; weight: number }>
    threshold: number
  }

  fields: Array<{
    name: string
    type: "string" | "date" | "number" | "boolean"
    description: string
    requirement: "required" | "optional"
  }>

  migrations?: Array<(data: unknown) => unknown>
}
```

### Built-in Classifiers

| Classifier | ID | Priority | Detects |
|------------|----|---------:|---------|
| **invoice** | `invoice` | 100 | Invoices, receipts, bills, tax invoices |
| **booking** | `booking` | 90 | Travel bookings, reservations, confirmations |
| **bookmark** | `bookmark` | 85 | Web bookmarks from Obsidian Web Clipper |
| **medical-statement** | `medical-statement` | 85 | Medical statements, health records |
| **research** | `research` | 80 | Research papers, academic articles |

**Location:** `src/inbox/classify/classifiers/definitions/`

### Creating a Classifier

See `commands/create-classifier.md` for the complete guide.

**Quick Template:**

```typescript
// src/inbox/classify/classifiers/definitions/my-type.ts
import type { InboxConverter } from "../types";

export const myTypeClassifier: InboxConverter = {
  schemaVersion: 1,
  id: "my-type",
  displayName: "My Type",
  enabled: true,
  priority: 100,

  heuristics: {
    filenamePatterns: [
      { pattern: "keyword", weight: 1.0 }
    ],
    contentMarkers: [
      { pattern: "content pattern", weight: 0.9 }
    ],
    threshold: 0.5
  },

  fields: [
    { name: "title", type: "string", description: "Title", requirement: "required" }
  ]
};
```

### Schema Migrations

When a classifier schema changes, migrations handle data transformation:

```typescript
export const myTypeClassifier: InboxConverter = {
  schemaVersion: 2,  // Bumped from 1
  // ... other fields ...

  migrations: [
    // v1 → v2: Add new field
    (data: any) => ({
      ...data,
      newField: data.oldField?.toUpperCase() || ""
    })
  ]
};
```

**Migration files:** `src/inbox/classify/classifiers/migrations/`

### Classifier Registry

The registry (`registry.ts`) manages classifier loading, matching, and versioning:

```typescript
// Get all enabled classifiers
const classifiers = getClassifierRegistry()

// Find best match for a file
const best = await findBestClassifier(content, filename)

// Run migrations if needed
const migrated = await migrateClassifierData(classifier, data)
```

---

## Classification (src/inbox/classify/)

### LLM Classifier (llm-classifier.ts)

```typescript
// Build prompt with vault context
const prompt = buildInboxPrompt({
  extractedContent: content,
  filename: file.name,
  vaultContext: {
    projects: ["Project A", "Project B"],
    areas: ["Health", "Finance"]
  }
})

// Call LLM
const response = await callLLM(prompt, options)

// Parse structured response
const result: DocumentTypeResult = parseDetectionResponse(response)
```

### PDF Processing (classify/detection/pdf-processor.ts)

```typescript
// Extract text
const text = await extractPdfText(pdfPath)

// Apply heuristics
const patterns = combineHeuristics(text, filename)

// Returns: { type, area, title, confidence }
```

### Converters (classify/converters/)

**Defaults** (defaults.ts) - Built-in type converters (travel, bookings, etc.)
**Loader** (loader.ts) - Match file to converter (`findBestConverter`)
**Builder** (suggestion-builder.ts) - Create suggestions from LLM results

---

## Content Extraction (src/inbox/scan/)

### Extractor Registry Pattern

```typescript
import { getDefaultRegistry } from "./scan/extractors"

const registry = getDefaultRegistry()

// Auto-select extractor by file extension
const inboxFile = await createInboxFile(filePath, { vaultPath })
// Returns: InboxFile with extracted content
```

### Built-in Extractors

**markdown.ts** - Frontmatter + content extraction
**image.ts** - Vision API (base64 + LLM description)
**pdf.ts** - pdf-to-text wrapper

---

## Execution (src/inbox/execute/)

### Sequential Execution Flow

```typescript
// executor.ts - Main orchestrator
for (const suggestion of suggestions) {
  if (isCreateNoteSuggestion(suggestion)) {
    await noteCreator.create(suggestion)
    await attachmentMover.move(suggestion)
    await attachmentLinker.link(suggestion)
  }
  await registry.save()  // Atomic save per suggestion
}
```

### Components

**note-creator.ts** - Create notes with frontmatter
**attachment-mover.ts** - Move files to attachments folder
**attachment-linker.ts** - Insert `![[attachment]]` links

---

## Registry (src/inbox/registry/)

### Deduplication Strategy

```typescript
// SHA256-based processed items tracking
interface ProcessedItem {
  hash: string              // SHA256 of file content
  path: string              // Original path
  processedAt: string       // ISO timestamp
  suggestionId: SuggestionId
  createdNote?: string      // Resulting note path
  movedAttachment?: string  // Resulting attachment path
}

// Registry persisted to JSON
const registry = createRegistry(registryPath)
await registry.load()
const isProcessed = registry.has(hash)
await registry.save()
```

---

## UI (src/inbox/ui/)

### Interactive CLI Adapter (cli-adapter.ts)

**Command Parsing:**
- `a` - Approve current suggestion
- `A` - Approve all remaining suggestions
- `b` - Back to previous suggestion
- `l` - List all pending suggestions with status
- `x` or `execute` - Execute approved suggestions (explicit command)
- `1,2,5` - Approve specific IDs
- `e3 prompt` - Edit suggestion #3 with prompt
- `s3` - Skip suggestion #3
- `q` - Quit
- `h` or `?` - Help

**Inline Warnings:**
- Shows warning icon (⚠️) when LLM fallback was used
- Displays which fields were extracted via LLM vs heuristics
- Helps users understand suggestion confidence

**Security:**
- Prompt sanitization (removes code blocks, injection patterns)
- Length limits (500 chars)
- Logs when sanitization modifies input

**Display Formatting:**
- `formatSuggestion()` - Pretty-print single suggestion
- `formatSuggestionsTable()` - Format all suggestions
- `formatConfidence()` - Icon + color per confidence level
- `displayResults()` - Execution summary

**Interactive Loop:**
```typescript
const approvedIds = await runInteractiveLoop({ engine, suggestions })
const results = await engine.execute(approvedIds)
displayResults(results)
```

---

## Error Handling (src/inbox/shared/)

### InboxError System

```typescript
type ErrorCategory = "validation" | "file-io" | "llm" | "external-tool"
type ErrorCode = "INVALID_PATH" | "PDF_EXTRACTION_FAILED" | ...

class InboxError extends Error {
  category: ErrorCategory
  code: ErrorCode
  context?: ErrorContext
  recoverable: boolean
}

// Create errors
createInboxError("FILE_NOT_FOUND", { path: "/foo" })

// Check recoverability
if (isRecoverableError(error)) { /* retry */ }
```

---

## Testing Patterns

### Co-located Tests

```
src/inbox/core/
├── engine.ts           # Implementation
└── engine.test.ts      # Tests (26,750 lines - comprehensive)
```

### Test Utilities

```typescript
// From src/testing/utils.ts
const { vaultPath, cleanup } = await createTestVault()
await setupTestVault(vaultPath, {
  includeInbox: true,
  includeProjects: true
})
// ... tests ...
await cleanup()
```

---

## Configuration

### Required Environment

```bash
PARA_VAULT=/path/to/vault  # Required
```

### Engine Config

```typescript
interface InboxEngineConfig {
  vaultPath: string                    // Required
  inboxFolder?: string                 // Default: "00 Inbox"
  attachmentsFolder?: string           // Default: "Attachments"
  templatesFolder?: string             // Default: "Templates"
  llmProvider?: "haiku" | "sonnet"    // Default: "haiku"
  llmModel?: string                    // Optional model override
  autoCommit?: boolean                 // Default: true (NEW)
  concurrency?: {
    pdfExtraction?: number             // Default: 5
    fileIO?: number                    // Default: 3
  }
}
```

**Git Integration:**
- **Auto-commit enabled by default** - Vault changes are committed automatically
- **Git guard** - Scan aborts if uncommitted changes exist in vault (excluding attachments folder)
- **Attachments folder excluded** - Large files don't trigger git guard

---

## Usage Examples

### Basic Workflow

```typescript
import { createInboxEngine } from "./inbox"

// 1. Create engine
const engine = createInboxEngine({
  vaultPath: process.env.PARA_VAULT!
})

// 2. Scan inbox
const suggestions = await engine.scan()

// 3. Interactive approval (CLI)
const approved = await runInteractiveLoop({ engine, suggestions })

// 4. Execute
const results = await engine.execute(approved)

// 5. Display results
displayResults(results)
```

### Custom Workflow

```typescript
// Scan with options
const suggestions = await engine.scan({
  skipRegistry: false,  // Check processed items
  limit: 10             // Max suggestions
})

// Edit suggestion
const updated = await engine.editWithPrompt(
  suggestions[0].id,
  "Use Health area instead"
)

// Execute with options
const results = await engine.execute([updated.id], {
  dryRun: false,
  autoCommit: true
})

// Generate report
const markdown = engine.generateReport(results)
```

---

## Public API Exports (src/inbox/index.ts)

### Types
- All suggestion types (`InboxSuggestion`, `CreateNoteSuggestion`, etc.)
- Configuration types (`InboxEngineConfig`, `ScanOptions`, `ExecuteOptions`)
- Result types (`ExecutionResult`, `ProcessorResult`)
- Registry types (`ProcessedRegistry`, `RegistryMetadata`)
- Error types (`InboxError`, `ErrorCode`, `ErrorCategory`)

### Functions
- **Engine:** `createInboxEngine`
- **Utils:** `createSuggestionId`, `isValidSuggestionId`
- **Type Guards:** `isCreateNoteSuggestion`, `isMoveSuggestion`, etc.
- **UI:** `runInteractiveLoop`, `displayResults`, `formatSuggestion`
- **Registry:** `createRegistry`, `hashFile`
- **Extractors:** `createInboxFile`, `getDefaultRegistry`
- **Classification:** `buildSuggestion`, `buildInboxPrompt`, `extractPdfText`

---

## Architecture Decisions

### Why Sequential Execution?

While the engine supports `concurrency.fileIO` config, execution runs **sequentially** to ensure:
1. **Atomic registry saves** - No race conditions on processed items
2. **Predictable order** - Users see results in order of approval
3. **Error isolation** - Failed suggestions don't block others

Future parallel execution may be supported with transactional registry updates.

### Why SHA256 Hashing?

Registry uses content hashing (not path-based) because:
1. **Rename resilience** - Moving a file doesn't re-process it
2. **Duplicate detection** - Same content in different locations
3. **Idempotency** - Re-running scan won't duplicate suggestions

### Why Heuristics-First Classification?

Changed from LLM-first to heuristics-first for performance and cost:
1. **Performance** - Pattern matching is instant, LLM calls take 2-5s
2. **Cost** - Avoid LLM calls for 80%+ of common documents
3. **Transparency** - Users know when LLM was needed (fallback warnings)
4. **Classifier System** - Modular classifiers with versioned schemas replace hardcoded converters

---

## Dependencies

**Runtime:**
- `@sidequest/core/fs` - Filesystem utilities
- `p-limit` - Concurrency control
- `@inquirer/prompts` - Interactive CLI
- `yaml` - Frontmatter parsing
- `date-fns` - Date handling

**External Tools:**
- `pdf-to-text` - PDF extraction (validated at runtime)

---

## Notes

- Entry point: `src/inbox/index.ts` (barrel exports)
- All tests co-located with source (`*.test.ts`)
- Comprehensive JSDoc on public APIs
- Type-safe discriminated unions for suggestions
- Follows plugin-wide TypeScript strict mode
- No biome.json - inherits from plugin root
