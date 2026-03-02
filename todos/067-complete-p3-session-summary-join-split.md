---
status: complete
priority: p3
issue_id: "067"
tags: [code-review, performance]
dependencies: []
---

## Problem Statement

`session-summary.ts` joins all text content into one huge string then immediately splits it into sentences. This creates a large intermediate string allocation for no benefit.

## Findings

- `session-summary.ts` lines 133-137: `textContent.join('\n').split(/[.!?\n]+/)`
- Joins all content into one string, then splits again
- For a 5MB transcript, this creates ~5MB of unnecessary heap allocation

## Proposed Solutions

Process `textContent` array directly without joining:
```typescript
const sentences: string[] = []
for (const text of textContent) {
    for (const sentence of text.split(/[.!?\n]+/)) {
        const trimmed = sentence.trim()
        if (trimmed.length > 10) sentences.push(trimmed)
    }
}
```

## Technical Details

- **File**: `plugins/git/hooks/session-summary.ts` lines 133-137

## Acceptance Criteria

- No intermediate join string created
- Same sentences extracted
- All tests pass
