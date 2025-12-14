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
 Extract        LLM detect      Build          User          Create
 content        doc type       suggestions     approve        notes
```

---

## Directory Structure

```
src/inbox/
├── types.ts                   # Core types (39 symbols)
├── index.ts                   # Public API barrel
├── core/                      # Main engine
│   ├── engine.ts              # InboxEngine factory (12 functions)
│   ├── engine-utils.ts        # Title/filename generation
│   ├── operations/            # Execution operations
│   │   ├── execute-suggestion.ts  # Suggestion executor
│   │   └── report.ts          # Markdown report generation
│   ├── staging/               # Temporary file management
│   │   ├── cleanup.ts         # Orphaned staging cleanup
│   │   └── rollback.ts        # Transaction rollback
│   ├── llm/                   # LLM client wrapper
│   │   └── client.ts          # callLLM abstraction
│   └── vault/                 # Vault context
│       └── context.ts         # Projects/areas loader
├── classify/                  # Document classification
│   ├── llm-classifier.ts      # LLM-based detection
│   ├── detection/             # Content processors
│   │   └── pdf-processor.ts  # PDF extraction + heuristics
│   └── converters/            # Type-specific logic
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
│   ├── executor.ts            # Main execution logic
│   ├── note-creator.ts        # Note creation
│   ├── attachment-mover.ts    # Attachment handling
│   └── attachment-linker.ts   # Link insertion
├── registry/                  # Processed items tracking
│   └── processed-registry.ts  # SHA256-based dedup
├── ui/                        # Terminal interaction
│   ├── cli-adapter.ts         # Interactive approval loop
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
- Loads processed registry (SHA256 dedup)
- Finds supported files (.md, .pdf, images)
- Validates dependencies (pdf-to-text for PDFs)
- Builds vault context (projects, areas)
- Processes files in parallel (p-limit concurrency)
- Skips already-processed items
- Returns suggestion array

**execute()** - Apply approved suggestions
- Validates suggestion IDs
- Executes sequentially (atomic registry saves)
- Creates notes with frontmatter
- Moves attachments
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
- `a` - Approve all
- `1,2,5` - Approve specific IDs
- `e3 prompt` - Edit suggestion #3 with prompt
- `s3` - Skip suggestion #3
- `q` - Quit
- `h` or `?` - Help

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
  concurrency?: {
    pdfExtraction?: number             // Default: 5
    fileIO?: number                    // Default: 3
  }
}
```

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

### Why LLM-First Classification?

Heuristics are fallback-only. LLM classification is preferred because:
1. **Semantic understanding** - Understands context, not just patterns
2. **Flexibility** - Handles new document types without code changes
3. **Accuracy** - Higher confidence than regex matching

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
