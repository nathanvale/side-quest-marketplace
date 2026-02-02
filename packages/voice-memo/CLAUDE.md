# Voice Memo

**Generic audio transcription library** - Scan, transcribe, and track Apple Voice Memos with state management.

---

## Quick Reference

**Type:** Standalone Package (Library)
**Language:** TypeScript (strict mode)
**Runtime:** Bun
**Test Framework:** Bun test (`*.test.ts` alongside source)
**Linter:** Biome (inherits from monorepo root)

---

## Features

- **Scanner** - Find Apple Voice Memos in iCloud directory
- **Transcriber** - Transcribe audio using parakeet-mlx or whisper CLI
- **State Management** - Track processed memos to avoid re-processing
- **Formatter** - Generic timestamp formatting (12-hour format)

**Note:** This package provides generic transcription only. For Obsidian note creation, use `para-obsidian` which builds on this package.

---

## Commands

```bash
bun test                     # Run all tests
bun typecheck                # TypeScript type checking
```

---

## Directory Structure

```
packages/voice-memo/
├── src/
│   ├── index.ts             # Barrel export
│   ├── scanner.ts           # Apple Voice Memos scanner
│   ├── scanner.test.ts
│   ├── transcriber.ts       # parakeet-mlx/whisper wrapper
│   ├── transcriber.test.ts
│   ├── state.ts             # Processed memo tracking
│   ├── state.test.ts
│   ├── formatter.ts         # Generic timestamp formatting
│   └── formatter.test.ts
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Barrel export with all public APIs |
| `src/scanner.ts` | Apple Voice Memos discovery and validation |
| `src/transcriber.ts` | Audio transcription with parakeet-mlx/whisper |
| `src/state.ts` | JSON state file for tracking processed memos |
| `src/formatter.ts` | Generic timestamp formatting |

---

## Architecture

### Module Overview

| Module | Purpose |
|--------|---------|
| **scanner** | Find `.m4a` files matching Apple Voice Memo patterns, validate filenames |
| **transcriber** | Shell out to parakeet-mlx or whisper CLI for transcription |
| **state** | Load/save JSON state file, mark memos as processed/skipped |
| **formatter** | Format timestamps (12-hour format), filename-safe time strings |

### Design Philosophy

This package is a **generic transcription library** with no knowledge of Obsidian or note formats. It provides:

1. **Audio → Text conversion** via external transcriber tools
2. **State tracking** to avoid re-processing
3. **Generic formatting** for timestamps

Application-specific concerns (note creation, LLM cleanup, frontmatter) belong in consumer packages like `para-obsidian`.

---

## Usage Examples

### Scanning for Voice Memos

```typescript
import { scanVoiceMemos } from "@sidequest/voice-memo";

const memos = await scanVoiceMemos({
  directory: "~/Library/Mobile Documents/com~apple~CloudDocs/Voice Memos",
  extensions: [".m4a"],
});
// Returns: VoiceMemo[]
```

### Transcribing Audio

```typescript
import { transcribeVoiceMemo, checkParakeetMlx } from "@sidequest/voice-memo";

// Check if transcriber is available
const available = await checkParakeetMlx();

// Transcribe
const result = await transcribeVoiceMemo("/path/to/memo.m4a");
// Returns: { text: string, success: boolean, error?: string }
```

### State Management

```typescript
import { loadVoiceState, saveVoiceState, markAsProcessed, isProcessed } from "@sidequest/voice-memo";

const state = loadVoiceState("~/.para/voice-state.json");

if (!isProcessed(state, "memo.m4a")) {
  // Process the memo...
  const newState = markAsProcessed(state, "memo.m4a", {
    processedAt: new Date().toISOString(),
    transcription: "...",
    dailyNote: "2025-01-15",
  });
  saveVoiceState("~/.para/voice-state.json", newState);
}
```

### Formatting

```typescript
import { formatTimestamp, formatFilenameTime } from "@sidequest/voice-memo";

const date = new Date();
formatTimestamp(date);      // "2:45 pm"
formatFilenameTime(date);   // "2-45pm"
```

---

## API Reference

### Scanner

```typescript
// Find voice memos in directory
scanVoiceMemos(options: ScanOptions): Promise<VoiceMemo[]>

// Parse timestamp from Apple Voice Memo filename
parseVoiceMemoTimestamp(filename: string): VoiceMemoTimestamp | null

// Check if filename is safe (no path traversal)
isSafeFilename(filename: string): boolean
```

### Transcriber

```typescript
// Transcribe audio file
transcribeVoiceMemo(path: string): Promise<TranscriptionResult>

// Check tool availability
checkParakeetMlx(): Promise<boolean>
checkWhisperCli(): Promise<boolean>
checkFfmpeg(): Promise<boolean>
isFfmpegAvailable(): Promise<boolean>
isParakeetMlxAvailable(): Promise<boolean>
```

### State

```typescript
// Load/save state file
loadVoiceState(path: string): VoiceState
saveVoiceState(path: string, state: VoiceState): void

// Track processing status
isProcessed(state: VoiceState, filename: string): boolean
markAsProcessed(state: VoiceState, filename: string, metadata: ProcessedMemoMetadata): VoiceState
markAsSkipped(state: VoiceState, filename: string, metadata: SkippedMemoMetadata): VoiceState
```

### Formatter

```typescript
// Format time for display
formatTimestamp(date: Date): string  // "2:45 pm"

// Format time for filenames
formatFilenameTime(date: Date): string  // "2-45pm"

// Re-export from core
dedupeConsecutiveLines(text: string): string
```

---

## Dependencies

**Runtime:**
- `@side-quest/core` - Shared utilities (workspace dependency)
  - `@side-quest/core/formatters` - Text deduplication

**External Tools (optional):**
- `parakeet-mlx` - Fast local transcription (preferred)
- `whisper-cli` - Fallback transcription

---

## Testing

- **Pattern:** `*.test.ts` alongside source files
- **Framework:** Bun test native
- **Tests:** 40 tests across 4 files

```bash
bun test                     # All tests
bun test src/scanner         # Scanner tests only
bun test --watch             # Watch mode
```

---

## Integration with para-obsidian

The `para-obsidian` plugin builds on this package for voice memo processing:

```typescript
// para-obsidian/src/voice/index.ts
// Re-exports generic utilities from voice-memo
export {
  scanVoiceMemos,
  transcribeVoiceMemo,
  loadVoiceState,
  saveVoiceState,
  formatTimestamp,
  formatFilenameTime,
  // ... etc
} from "@sidequest/voice-memo";

// Adds Obsidian-specific functionality
export { createVoiceMemoNote, processWithLLM } from "./note-creator.js";
export { formatLogEntry, formatWikilinkLogEntry } from "./formatter.js";
```

**Separation of concerns:**
- `voice-memo`: Generic transcription (scan → transcribe → state)
- `para-obsidian`: Obsidian integration (note creation, LLM cleanup, formatting)

---

## Notes

- Inherits TypeScript config from monorepo root
- Inherits Biome config from monorepo root
- Uses `workspace:*` protocol for `@side-quest/core`
- No direct dependencies on para-obsidian (fully decoupled)
- No LLM dependencies - pure audio transcription
