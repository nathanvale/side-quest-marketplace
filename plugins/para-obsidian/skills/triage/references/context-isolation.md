# Context Isolation Rules

## Core Principle

**The orchestrator MUST NOT read content.** All content reading happens in subagents.

---

## What Flows Through Coordinator (ALLOWED)

- File paths and names (~50 bytes each)
- Frontmatter metadata via `para_fm_get` (~200 bytes)
- Proposals from subagent **response text** (~500 bytes)
- **Total for 50 items: ~40k tokens**

## What NEVER Flows Through Coordinator (FORBIDDEN)

- Transcription text (`para_read`) - 10k+ tokens each
- YouTube transcripts - 20k+ tokens each
- Article content (Firecrawl) - 5k+ tokens each
- **If leaked: 50 items = 500k+ tokens = context overflow**

## Why This Matters

```
Without isolation:  50 items × 10k avg = 500k tokens (OVERFLOW)
With isolation:     50 items × 0.5k avg = 25k tokens (FITS)
```

---

## Common Mistakes (AVOID THESE)

1. **Reading file to "verify" subagent work** - WRONG
   ```typescript
   // ❌ Fills coordinator context with 10k+ tokens
   para_read({ file: "00 Inbox/🎤 Voice memo.md" })
   ```

2. **Re-reading after subagent returns** - WRONG
   ```typescript
   // ❌ Subagent already analyzed this - trust its output
   const result = await Task({ ... });
   para_read({ file }); // WHY? You have the proposal!
   ```

3. **Trying to get metadata from TaskList** - WRONG
   ```typescript
   // ❌ TaskList doesn't return metadata
   const tasks = TaskList();
   const proposal = tasks[0].metadata?.proposal; // undefined!
   ```

---

## Correct Patterns

1. **Use subagent response text** - Subagents return `PROPOSAL_JSON:{...}`
2. **Trust the subagent** - If it says "Sprint Planning", it read the content
3. **On resume only** - Use TaskGet loop to retrieve persisted proposals

**If you're tempted to call `para_read` - STOP.**
Spawn a subagent instead. That's what Phase 2 is for.
