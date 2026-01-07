# Log Triage Implementation Plan

**Goal:** Transform raw daily note log entries (voice memos, URLs, text) into structured notes.

---

## Core Concept: Direct Extraction

```
Log Entry → LLM Extraction → User Confirms → Create Note (meeting/task) → Delete Log Entry
```

**Simple approach:**
1. Voice memo → Extract into meeting note format → Create `type: meeting` directly
2. Text entry → Create task or capture note
3. URL → Skip (use Web Clipper)
4. Delete processed entries from daily note

No intermediate capture notes, no `convert_to` field, no second conversion step.

---

## Phase 1: Skill-Only Approach (Current)

The `/para-obsidian:log-triage` skill provides a conversational interface for processing logs.

### What's Implemented
- `skills/log-triage/SKILL.md` - Skill definition with:
  - Log entry type detection (voice memo 🎤, URL, text)
  - LLM extraction into meeting note format
  - User confirmation before creating
  - Direct creation of meeting/task notes in inbox
  - Raw transcription preserved in note body
  - Delete processed entries from daily note

### How It Works
1. User invokes `/para-obsidian:log-triage [date]`
2. Skill reads daily note's `## Log` section
3. Parses entries by pattern
4. For each entry:
   - **Voice memo**: LLM extracts into meeting format (attendees, notes, action items)
   - **Text**: Propose task or capture note
   - **URL**: Skip, suggest Web Clipper
5. Show extraction, ask user to confirm
6. Create note directly with correct type (`meeting`, `task`, etc.)
7. Delete log entry from daily note

### Output Note Types
| Log Entry | Creates | Type |
|-----------|---------|------|
| 🎤 Voice memo (meeting) | Meeting note with extracted structure | `type: meeting` |
| 🎤 Voice memo (thought) | Capture note | `type: capture` |
| Actionable text | Task note | `type: task` |
| Idea/thought text | Capture note | `type: capture` |
| URL | Nothing (use Web Clipper) | - |

### Limitations
- Requires manual skill invocation
- LLM-dependent extraction (quality varies)
- URLs must use Web Clipper separately

---

## Phase 3: Log Parser Module (Future)

Add a dedicated parser to `src/inbox/logs/` that understands daily note log format.

### New Files
```
src/inbox/
├── logs/
│   ├── parser.ts          # Parse log entries from daily notes
│   ├── types.ts           # LogEntry, LogType, ParsedLog
│   ├── classifier.ts      # Classify entry type (meeting, url, task, thought)
│   ├── extractors/
│   │   ├── voice-memo.ts  # Extract from transcriptions
│   │   ├── url.ts         # Process URLs with Firecrawl
│   │   └── text.ts        # Process simple text entries
│   └── index.ts           # Public exports
```

### Types
```typescript
type LogType = "voice-memo" | "url" | "text";
type LogSubtype = "meeting" | "thought" | "task" | "reminder" | "bookmark" | "resource";

interface LogEntry {
  time: string;           // "9:26 am"
  type: LogType;
  subtype?: LogSubtype;
  raw: string;            // Original text
  content: string;        // Cleaned content
  metadata: {
    hasEmoji: boolean;
    emoji?: string;       // "🎤"
    url?: string;
    wordCount: number;
  };
}

interface ParsedLog {
  date: string;           // "2026-01-06"
  entries: LogEntry[];
  stats: {
    total: number;
    byType: Record<LogType, number>;
  };
}
```

### Parser Logic
```typescript
// Pattern: - [time] - [content]
const LOG_PATTERN = /^- (\d{1,2}:\d{2}\s*[ap]m)\s*-\s*(.+)$/;
const VOICE_MEMO_PATTERN = /^🎤\s*/;
const URL_PATTERN = /https?:\/\/[^\s]+/;

function parseLogEntry(line: string): LogEntry | null {
  const match = line.match(LOG_PATTERN);
  if (!match) return null;

  const [, time, content] = match;
  const isVoiceMemo = VOICE_MEMO_PATTERN.test(content);
  const urlMatch = content.match(URL_PATTERN);

  return {
    time,
    type: isVoiceMemo ? "voice-memo" : urlMatch ? "url" : "text",
    raw: line,
    content: content.replace(VOICE_MEMO_PATTERN, ""),
    metadata: {
      hasEmoji: isVoiceMemo,
      emoji: isVoiceMemo ? "🎤" : undefined,
      url: urlMatch?.[0],
      wordCount: content.split(/\s+/).length,
    },
  };
}
```

### CLI Command
```bash
para logs parse [--date YYYY-MM-DD]     # Parse log entries
para logs suggest [--date YYYY-MM-DD]   # Generate suggestions
para logs execute [--date YYYY-MM-DD]   # Execute approved suggestions
```

---

## Phase 4: Voice Memo Classifier (Future)

Add a classifier to the existing classifier registry for voice memo content.

### New Classifier
```typescript
// src/inbox/classify/classifiers/definitions/voice-memo.ts
export const voiceMemoClassifier: InboxConverter = {
  schemaVersion: 1,
  id: "voice-memo",
  displayName: "Voice Memo",
  enabled: true,
  priority: 95,

  heuristics: {
    filenamePatterns: [],  // Not file-based
    contentMarkers: [
      // Meeting indicators
      { pattern: "nice to meet you", weight: 0.8 },
      { pattern: "I'll send you", weight: 0.6 },
      { pattern: "action item", weight: 0.9 },
      { pattern: "meeting", weight: 0.5 },
      { pattern: "team", weight: 0.4 },
      // Task indicators
      { pattern: "remind me to", weight: 0.9 },
      { pattern: "I need to", weight: 0.7 },
      { pattern: "don't forget", weight: 0.8 },
    ],
    threshold: 0.4,
  },

  fields: [
    { name: "title", type: "string", requirement: "required" },
    { name: "type", type: "string", requirement: "required" },  // meeting/thought/task
    { name: "attendees", type: "string", requirement: "optional" },
    { name: "action_items", type: "string", requirement: "optional" },
    { name: "key_points", type: "string", requirement: "optional" },
    { name: "project", type: "string", requirement: "optional" },
    { name: "area", type: "string", requirement: "optional" },
  ],
};
```

### LLM Extraction Schema (OpenAI Structured Outputs)
```json
{
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "content_type": {
      "type": "string",
      "enum": ["meeting", "thought", "task", "reminder"]
    },
    "attendees": {
      "type": "array",
      "items": { "type": "string" }
    },
    "action_items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "owner": { "type": ["string", "null"] },
          "due_date": { "type": ["string", "null"] }
        },
        "required": ["description"]
      }
    },
    "key_points": {
      "type": "array",
      "items": { "type": "string" }
    },
    "project_hint": { "type": ["string", "null"] },
    "area_hint": { "type": ["string", "null"] }
  },
  "required": ["title", "content_type"]
}
```

---

## Phase 5: Enrichment Strategy (Future)

Add enrichment strategy for voice memos, similar to YouTube/bookmark strategies.

### Voice Memo Strategy
```typescript
// src/inbox/enrich/strategies/voice-memo-strategy.ts
export const voiceMemoStrategy: EnrichmentStrategy = {
  id: "voice-memo",
  name: "Voice Memo Enrichment",
  priority: 80,

  canEnrich(ctx): EnrichmentEligibility {
    // Check if content looks like a voice memo transcription
    const hasVoiceMemoMarker = ctx.content.startsWith("🎤");
    const isLongForm = ctx.content.length > 500;

    return {
      eligible: hasVoiceMemoMarker || isLongForm,
      reason: hasVoiceMemoMarker ? "Voice memo marker detected" : "Long-form content",
    };
  },

  async enrich(ctx, options): Promise<EnrichmentResult> {
    // Use LLM to extract structured data
    const extraction = await extractVoiceMemoContent(ctx.content, options);

    return {
      enriched: true,
      strategyId: "voice-memo",
      data: extraction,
    };
  },
};
```

---

## Phase 6: Automation Hooks (Future)

### SessionStart Hook
Auto-detect unprocessed logs when starting a session:

```typescript
// hooks/session-start.ts
const dailyNote = getTodaysDailyNote();
const logs = parseLogEntries(dailyNote);
const unprocessed = logs.filter(e => !e.raw.startsWith("- ✅"));

if (unprocessed.length > 0) {
  console.log(`📋 ${unprocessed.length} unprocessed log entries found`);
  console.log(`Run /para-obsidian:log-triage to process them`);
}
```

### Scheduled Processing
Future: Background job to process logs at end of day.

---

## Integration Points

### With Existing Inbox Pipeline
- Log entries can generate `InboxSuggestion` objects
- Use existing `execute()` flow for note creation
- Leverage classifier registry for type detection
- Use enrichment pipeline for URL content

### With Templates
- Voice memos → `capture` template (with `convert_to: meeting`)
- URLs → Web Clipper flow (clipping → bookmark)
- Tasks → `capture` template (with `convert_to: task`)
- Thoughts → `capture` template (no conversion)

### With Routing
- Created notes land in `00 Inbox`
- Existing routing module moves to PARA destinations
- Area/project links in frontmatter guide routing

### With `para migrate` / Inbox Processor
- `convert_to` field signals target type
- Inbox processor runs capture-to-X converters
- Similar to existing clipping → bookmark flow

---

## Migration Path

### Current State
- No log processing capability
- Manual note creation from logs
- Voice memos stay as raw text in daily notes

### Phase 1 (Now)
- `/para-obsidian:log-triage` skill available
- Creates capture notes with `convert_to` field
- Raw transcription preserved in note body
- Manual skill invocation required

### Phase 2 (Future)
- Capture-to-X converters in inbox pipeline
- `para convert` CLI command
- Automatic conversion via `para scan`

### Phase 3-4 (Future)
- Log parser module for batch processing
- Voice memo classifier in registry
- Structured extraction without full LLM

### Phase 5-6 (Future)
- Enrichment pipeline integration
- Session hooks for daily reminders
- Background processing capability

---

## Success Metrics

1. **Extraction Quality**
   - Action items correctly identified (>80%)
   - Attendees correctly extracted (>90%)
   - Appropriate note type selected (>85%)

2. **User Experience**
   - Time to process 5 logs < 3 minutes
   - Confirmation before creating notes
   - Clear summary of what was created

3. **System Health**
   - SLO: 95% log parsing succeeds
   - SLO: 90% LLM extractions within 10s
   - No duplicate notes created

---

## Resolved Decisions

1. **Meeting Note Template** ✅
   - Use `capture` with `convert_to: meeting`
   - Existing `meeting.md` template is the target
   - Conversion happens via inbox processor (Phase 2)

2. **Task Extraction Granularity** ✅
   - Embed checkboxes in capture note (action items section)
   - User can manually create individual task notes if needed
   - Or wait for Phase 2 converters to extract tasks

3. **URL Handling** ✅
   - URLs go through Web Clipper flow, not this skill
   - Skill focuses on voice memos and text entries

4. **Raw Content Preservation** ✅
   - Always preserve raw transcription in note body
   - Extracted structure at top, raw below

## Open Questions

1. **Processed Entry Marking**
   - Add ✅ prefix in daily note?
   - Or track in a separate registry?

2. **Multi-Day Processing**
   - Support batch processing of historical logs?
   - Or focus on current day only?

3. **Converter Strategy**
   - Update note in place (change type, restructure)?
   - Or create new note + archive original?

---

## Next Steps

1. **Test the skill** - Try `/para-obsidian:log-triage` on today's logs
2. **Iterate on extraction** - Refine what gets extracted from voice memos
3. **Gather feedback** - Does the capture → convert flow work?
4. **Plan Phase 2** - Build capture-to-meeting converter
