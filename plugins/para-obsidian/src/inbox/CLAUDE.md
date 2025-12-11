# Inbox Processing Framework

**Security-hardened automation system for processing inbox items with AI-powered metadata extraction**

---

## CRITICAL RULES

**Security First:**
- **NEVER** execute shell commands via string interpolation - use `Bun.spawn` with array args
- **ALWAYS** validate file existence before AND after processing (TOCTOU mitigation)
- **ALWAYS** use atomic writes (temp file + rename) for registry updates
- **ALWAYS** acquire file locks before concurrent operations
- **ALWAYS** validate inputs: SHA256 hashes (64 chars), ISO8601 timestamps, non-empty paths
- **ALWAYS** kill child processes on timeout to prevent zombies
- **ALWAYS** sanitize user prompts to prevent injection attacks

**Architecture:**
- Engine/Interface separation - core logic independent of UI
- Suggestions, not actions - processing returns suggestions only
- Human approval required - nothing executes without consent
- Idempotent processing - SHA256 registry prevents duplicate processing

---

## Quick Reference

**Type:** Module (pure TypeScript) | **Runtime:** Bun | **Language:** TypeScript (strict mode)
**Dependencies:** p-limit (concurrency), nanospinner (progress), @sidequest/core/fs (atomic writes)
**Test Framework:** Bun test (246 tests passing, 10 test files)

### Directory Structure

```
inbox/
├── cli.ts                # Interactive CLI entry point (PARA_VAULT env var required)
├── types.ts              # Core types (InboxSuggestion, InboxEngine, etc.)
├── engine.ts             # Main engine factory (scan/execute/edit/report)
├── registry.ts           # Idempotency tracking (SHA256, file locking, atomic writes)
├── pdf-processor.ts      # PDF extraction + heuristics (security hardened)
├── llm-detection.ts      # AI type detection + field extraction
├── cli-adapter.ts        # Interactive terminal UI (command loop, display)
├── errors.ts             # Error taxonomy (23 error codes)
├── logger.ts             # Structured logging with correlation IDs
├── unique-path.ts        # Path collision detection and resolution
└── [*.test.ts]           # 246 comprehensive tests (10 files)
```

---

## Key Concepts

### Suggestion Format

All operations return **suggestions** - never mutate state directly:

```typescript
interface InboxSuggestion {
  id: string;                    // UUID for tracking
  source: string;                // Original file path
  processor: "attachments" | "notes" | "images";
  confidence: "high" | "medium" | "low";
  action: "create-note" | "move" | "rename" | "link" | "skip";

  // Optional based on action:
  suggestedNoteType?: string;    // invoice, booking, session
  suggestedTitle?: string;
  suggestedDestination?: string; // PARA folder
  suggestedArea?: string;        // [[Area]] wikilink
  suggestedProject?: string;     // [[Project]] wikilink
  extractedFields?: Record<string, unknown>;
  suggestedAttachmentName?: string;
  attachmentLink?: string;
  reason: string;                // Human-readable explanation
}
```

### Engine API

```typescript
const engine = createInboxEngine({ vaultPath: "/path/to/vault" });

// 1. Scan inbox → generate suggestions
const suggestions = await engine.scan();

// 2. Edit suggestion with custom prompt
const updated = await engine.editWithPrompt(
  "abc123",
  "put in Health area instead"
);

// 3. Execute approved suggestions
const results = await engine.execute(["abc123", "def456"]);

// 4. Generate markdown report
const report = engine.generateReport(suggestions);
```

### Confidence Scoring

| Level | Criteria |
|-------|----------|
| **HIGH** | Heuristics AND AI agree + target location exists + template available |
| **MEDIUM** | AI detects type but filename/content ambiguous |
| **LOW** | AI uncertain, content unclear, extraction failed |

### CLI Usage

**Required:** Set `PARA_VAULT` environment variable to your Obsidian vault path.

```bash
# Interactive inbox processor
PARA_VAULT=/path/to/vault bun run src/inbox/cli.ts

# Outputs:
# 1. Scans inbox folder for unprocessed PDFs
# 2. Displays suggestions table (id, confidence, action, title, reason)
# 3. Interactive loop for approval:
#    - 'a' = approve all HIGH confidence
#    - 'e<N>' = edit suggestion with custom prompt
#    - '<N>,<M>' = execute specific suggestions
#    - 'q' = quit
# 4. Generates markdown report on completion
```

**Environment Variables:**
- `PARA_VAULT` (required) — Path to Obsidian vault
- Optional: Override folder names via engine options (default: "00 Inbox", "Attachments", "Templates")

---

## Security Architecture

### P0 Critical Protections

1. **Command Injection Prevention** (`pdf-processor.ts:196`)
   ```typescript
   // ❌ WRONG - vulnerable to injection
   await $`pdftotext ${filePath} -`;

   // ✅ CORRECT - array args prevent shell interpretation
   const proc = Bun.spawn(["pdftotext", filePath, "-"]);
   ```

2. **Atomic Registry Writes** (`registry.ts:373`)
   ```typescript
   // Write to temp file → atomic rename
   await Bun.write(tempPath, JSON.stringify(registry));
   await rename(tempPath, registryPath); // POSIX guarantees atomicity
   ```

3. **File Locking** (`registry.ts:162`)
   ```typescript
   // Acquire lock → do work → release lock (finally block)
   await acquireLock(lockPath);
   try {
     // ... registry operations
   } finally {
     releaseLock(lockPath);
   }
   ```

4. **TOCTOU Mitigation** (`pdf-processor.ts:209`, `pdf-processor.ts:273`)
   ```typescript
   // Check file exists BEFORE extraction
   if (!existsSync(filePath)) throw error;

   // ... extract text ...

   // Verify file UNCHANGED after extraction
   const postStats = await stat(filePath);
   if (postStats.mtimeMs !== preStats.mtimeMs) throw error;
   ```

5. **Process Lifecycle** (`pdf-processor.ts:231`)
   ```typescript
   const timeout = setTimeout(() => {
     proc.kill(); // Prevent zombie process
     reject(new Error("Timeout"));
   }, 30000);

   // Clear timeout on success
   clearTimeout(timeout);
   ```

6. **Prompt Injection Sanitization** (`cli-adapter.ts:461`)
   ```typescript
   function sanitizePrompt(input: string): string {
     return input.replace(/[\x00-\x1F\x7F]/g, ""); // Strip control chars
   }
   ```

7. **Rollback on Failure** (`engine.ts:359`)
   ```typescript
   // Delete orphaned note if attachment move fails
   if (existsSync(notePath)) {
     fs.unlinkSync(notePath);
   }
   ```

### P1 High Priority Protections

- **Empty cache validation** - Warn when execute() called without scan()
- **Registry input validation** - 64-char SHA256, ISO8601 timestamps, non-empty paths
- **OOM protection** - `MAX_EXTRACTED_TEXT = 10MB` limit on PDF text
- **Heuristic false positive penalty** - Require strong signals for HIGH confidence
- **Stable ID lookups** - CLI uses ID-based mapping, not array indices

---

## Error Taxonomy

23 error codes across 7 categories:

| Category | Example Codes | Recoverable? |
|----------|---------------|--------------|
| **dependency** | `DEP_PDFTOTEXT_MISSING`, `DEP_LLM_UNAVAILABLE` | No |
| **extraction** | `EXT_PDF_CORRUPT`, `EXT_PDF_EMPTY`, `EXT_PDF_TOO_LARGE` | No |
| **detection** | `DET_TYPE_UNKNOWN`, `DET_FIELDS_INCOMPLETE` | No |
| **validation** | `VAL_AREA_NOT_FOUND`, `VAL_TEMPLATE_MISSING` | No |
| **execution** | `EXE_NOTE_CREATE_FAILED`, `EXE_ATTACHMENT_MOVE_FAILED` | No |
| **registry** | `REG_READ_FAILED`, `REG_WRITE_FAILED`, `REG_CORRUPT` | Yes |
| **user** | `USR_INVALID_COMMAND`, `USR_EDIT_PROMPT_EMPTY` | Yes |

See `errors.ts` for full taxonomy and user-facing messages.

---

## Logging & Observability

### Structured Logging

```typescript
import { inboxLogger, pdfLogger, llmLogger, executeLogger } from "./logger";

const cid = crypto.randomUUID().slice(0, 8);
inboxLogger.info`Scan started items=${count} ${cid}`;
pdfLogger.debug`Extracting ${filePath} ${cid}`;
llmLogger.info`Detection complete type=${type} confidence=${conf} ${cid}`;
executeLogger.info`Note created path=${notePath} ${cid}`;
```

**Log location:** `~/.claude/logs/para-obsidian.jsonl`

### Key Metrics

| Metric | Purpose |
|--------|---------|
| `scan.duration_ms` | Overall scan performance |
| `pdf.extraction_duration_ms` | pdftotext latency |
| `llm.call_duration_ms` | LLM API latency |
| `llm.calls_per_scan` | Cost tracking |
| `execute.success_rate` | Reliability |

---

## Testing

```bash
bun test src/inbox/                     # All inbox tests (246)
bun test src/inbox/registry.test.ts     # Registry tests
bun test src/inbox/pdf-processor.test.ts # PDF processing tests
bun test src/inbox/engine.test.ts       # Engine integration tests
bun test src/inbox/cli-adapter.test.ts  # CLI UX tests
```

**Coverage (246 tests across 10 files):**
- Registry: Atomic writes, locking, validation, idempotency
- PDF: Extraction, heuristics, TOCTOU, timeout handling
- Engine: Scan, execute, edit, rollback on failure
- CLI: Command parsing, display, prompt sanitization
- Errors: All 23 error codes, recovery strategies
- Logging: Correlation IDs, subsystem loggers
- Types: Data structure validation
- LLM Detection: Response parsing, field extraction
- Unique Path: Path collision handling

---

## Dependencies

- **p-limit** — Controlled concurrency (prevent API rate limits, OOM)
- **nanospinner** — Progress indicators for CLI
- **@sidequest/core/fs** — Atomic write utilities (`moveFile`, temp patterns)

**External requirements:**
- `pdftotext` CLI (brew install poppler) - checked at runtime
- LLM provider (haiku by default, configurable)

---

## Code Conventions

**TypeScript:** Strict mode, functional style, explicit error handling
**Security:** Input validation before ALL operations
**Concurrency:** p-limit for controlled parallelism (3 LLM calls, 5 PDF extractions max)
**Errors:** Use `createInboxError()` factory, include `cid` in context
**Logging:** Correlation ID in every log message, structured JSON output
**Testing:** testHash() helper for registry tests (64-char SHA256 compliance)

---

## Common Patterns

### Registry Operations

```typescript
// Always: load → check → mark → save
const registry = createRegistry(vaultPath);
await registry.load();

const hash = await hashFile(filePath);
if (!registry.isProcessed(hash)) {
  // Process file...
  registry.markProcessed({
    sourceHash: hash,
    sourcePath: filePath,
    processedAt: new Date().toISOString(),
    createdNote: notePath,
  });
  await registry.save();
}
```

### PDF Processing with TOCTOU Protection

```typescript
// Pre-check
const preStats = await stat(filePath);

// Extract
const text = await extractPdfText(filePath, cid);

// Post-verify
const postStats = await stat(filePath);
if (postStats.mtimeMs !== preStats.mtimeMs) {
  throw createInboxError("EXT_PDF_TOCTOU", { cid, source: filePath });
}
```

### CLI Interactive Loop

```typescript
// Display → Parse command → Execute → Update display
while (true) {
  console.log(formatSuggestionsTable(suggestions));
  const cmd = await getUserInput();

  if (cmd === 'a') { /* approve all */ }
  else if (cmd.match(/^e(\d+)/)) { /* edit with prompt */ }
  else if (cmd === 'q') { break; }

  // Update suggestions display after each operation
}
```

---

## Performance Characteristics

| Operation | Typical Time | Notes |
|-----------|--------------|-------|
| Scan (10 PDFs) | ~15-30s | Depends on LLM latency (3 concurrent) |
| PDF extraction | ~500-2000ms | Per file, depends on size |
| LLM detection | ~1-3s | Per file (haiku model) |
| Execute (10 items) | ~2-5s | File I/O bound (10 concurrent) |
| Registry load | ~10-50ms | Depends on size (1000 items = ~50ms) |

**Concurrency limits:**
- PDF extraction: 5 concurrent (CPU-bound)
- LLM calls: 3 concurrent (API rate limits)
- File I/O: 10 concurrent (disk is fast)

---

## Future Enhancements

- **Markdown processor** - Route inbox markdown by frontmatter
- **Image processor** - OCR via Gemini vision
- **CI/Nightly mode** - Auto-execute HIGH confidence, queue MEDIUM/LOW
- **Multi-turn sessions** - Resume edit-with-prompt conversations
- **Batch operations** - Process multiple items with shared context

---

## Development Workflow

**Testing:** Full test suite validates all critical patterns:
```bash
bun test plugins/para-obsidian/src/inbox/     # Run all 246 tests
bun --filter para-obsidian test               # Run entire plugin tests
```

**Debugging Suggestions:** Enable correlation ID logging:
```bash
PARA_VAULT=/path/to/vault bun run src/inbox/cli.ts 2>&1 | \
  grep -E "cid|error|TOCTOU"
```

**Adding New File Processors:**
1. Create `new-processor.ts` extending `Processor` interface
2. Implement `process()` returning suggestions
3. Add tests in `new-processor.test.ts`
4. Register in `engine.ts` processor queue
5. Update this CLAUDE.md with new processor details

---

## Implementation Checklist

When building inbox processors, ensure:

- [ ] Engine/interface separation (UI-agnostic core)
- [ ] Suggestion-based returns (never mutate directly)
- [ ] Command injection prevention (array args only)
- [ ] TOCTOU protection (stat before AND after)
- [ ] Atomic writes (temp file + rename)
- [ ] File locking for concurrent access
- [ ] Process timeout handling (kill zombies)
- [ ] Prompt sanitization (strip control chars)
- [ ] Rollback on failure (delete orphans)
- [ ] Confidence scoring (HIGH/MEDIUM/LOW)
- [ ] SHA256 idempotency (content-based)
- [ ] Error taxonomy (structured codes)
- [ ] Correlation ID logging (debugging)
- [ ] Interactive CLI (display → parse → execute)
- [ ] Comprehensive tests (security, TOCTOU, idempotency)

---

## Notes

- Engine is UI-agnostic - same core powers CLI, web app, API
- Suggestions are immutable - editWithPrompt returns NEW suggestion
- Registry uses SHA256 content hashing - filename changes don't break idempotency
- File locks use `.lock` suffix with stale detection (30s timeout)
- All errors include correlation IDs for debugging
- Test suite uses `testHash()` helper to generate valid 64-char SHA256s
- Security fixes implemented: 7 P0 critical + 8 P1 high priority
- `unique-path.ts` handles filename collisions with `.1`, `.2` suffixes before extensions
- CLI uses nanospinner for progress feedback with stage tracking (hash → extract → llm → done)
