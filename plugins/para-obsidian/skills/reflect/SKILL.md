---
name: reflect
description: Record brain routing corrections with confidence scoring. Use when the brain orchestrator detects a wrong routing decision and needs to log the correction for future learning.
user-invocable: false
allowed-tools: Read, mcp__plugin_para-obsidian_para-obsidian__para_read, mcp__plugin_para-obsidian_para-obsidian__para_insert, mcp__plugin_para-obsidian_para-obsidian__para_replace_section
---

# Reflect — Brain Routing Correction Recorder

Record routing corrections with confidence scoring. Called by the brain orchestrator when Nathan signals a wrong routing decision. Uses the Claude-Reflect pattern: corrections must occur 3+ times before being promoted to active learnings.

## Input

Receive correction context as args:

```
input="<original request>" routed_to="<wrong skill>" correct_skill="<right skill>" reason="<Nathan's words>"
```

Parse these 4 fields from `$ARGUMENTS`.

## Workflow

### Step 1 — Read Current Learnings

```
para_read({ file: "plugins/para-obsidian/skills/brain/references/learnings.md" })
```

Parse the Raw Correction Log table to find existing entries.

### Step 2 — Check for Existing Pattern

Search the Raw Correction Log for a row where `Routed To` matches `routed_to` AND `Correct Skill` matches `correct_skill` AND the `Input Pattern` is semantically similar to the new input.

- **If match found:** Increment the count for that row. Update the `Input Pattern` to be a generalized pattern if the inputs differ slightly (e.g., "process inbox" and "handle my inbox" → "inbox processing requests").
- **If no match:** Add a new row with count = 1 and today's date.

### Step 3 — Update Raw Correction Log

Use `para_replace_section` to update the "Raw Correction Log" section with the modified table:

```
para_replace_section({
  file: "plugins/para-obsidian/skills/brain/references/learnings.md",
  heading: "Raw Correction Log",
  content: "<updated table with all rows>",
  response_format: "json"
})
```

### Step 4 — Promote to Active Learnings (if count >= 3)

If the updated count reaches 3 or higher, also update the "Active Learnings" section by adding a human-readable routing rule:

```
para_replace_section({
  file: "plugins/para-obsidian/skills/brain/references/learnings.md",
  heading: "Active Learnings (count >= 3)",
  content: "<existing rules>\n- When input matches \"<generalized pattern>\", route to `<correct_skill>` (not `<routed_to>`). Reason: <Nathan's reason>.",
  response_format: "json"
})
```

### Step 5 — Confirm

Output a single confirmation line:

```
SKILL_RESULT:{"status":"ok","skill":"reflect","summary":"Recorded correction: <routed_to> → <correct_skill> (count: <N>)"}
```

If count just reached 3, add: `"promoted": true` to the JSON.

## Rules

1. **Never modify anything outside learnings.md** — this skill has a single responsibility.
2. **Semantic matching, not exact** — "process inbox" and "triage my inbox" are the same pattern.
3. **Generalize patterns** — After 2+ similar inputs, generalize the Input Pattern column to a broader description.
4. **Preserve existing entries** — Always read before writing. Never lose existing corrections.
5. **One correction per invocation** — Process exactly one correction, then exit.
