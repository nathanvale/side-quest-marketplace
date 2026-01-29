# Subagent Prompts

## Overview

Each subagent handles BOTH enrichment AND analysis for a single inbox item. This keeps enriched content out of the coordinator's context.

**Subagent responsibilities:**
1. Fetch full content (enrich)
2. Analyze and create proposal
3. Create note via para_create
4. Inject Layer 1 content via para_replace_section
5. Persist via TaskUpdate

**Coordinator responsibilities:**
1. Scan inbox, create tasks
2. Load vault context (areas/projects) ONCE
3. Spawn subagents with context
4. Present table, handle edits
5. Execute cleanup (delete/archive originals, fallback creation if subagent failed)

---

## Spawning Triage Workers

Use the `triage-worker` agent (defined in `agents/triage-worker.md`). The agent defaults to `model: haiku` with preloaded skills: `para-classifier`, `analyze-web`, `analyze-voice`, `analyze-attachment`.

**Model override:** Use `sonnet` for transcriptions/VTTs (ambiguous content needs stronger judgment). Pass `model: "sonnet"` in the Task call — this overrides the agent's default haiku.

```typescript
Task({
  subagent_type: "triage-worker",
  model: itemType === "transcription" ? "sonnet" : undefined,
  description: "Process: ${title}",
  prompt: `
    You are processing a single inbox item: enrich, analyze, and persist.

    ## Item Details
    Task ID: ${taskId}
    File: ${file}
    Source URL: ${sourceUrl}
    Source Type: ${sourceType}

    ## Vault Context (pre-loaded - use these, don't fetch)

    ### Areas
    ${JSON.stringify(areas, null, 2)}

    ### Projects
    ${JSON.stringify(projects, null, 2)}

    ### Stakeholders
    ${JSON.stringify(stakeholders, null, 2)}

    **CRITICAL:** Only use areas/projects from the lists above. Never hallucinate names.

    Follow your workflow: read → enrich → analyze → create → inject Layer 1 → commit → persist → return PROPOSAL_JSON.
  `
})
```

The `triage-worker` agent already knows the full workflow (enrichment routing, note creation, Layer 1 injection, proposal fields, persistence, output format). You only need to pass item details and vault context.

---

## Parallel Spawning

**CRITICAL:** To run subagents in parallel, include multiple Task calls in a single message.

```typescript
// Single message with 5 Task calls = parallel execution
Task({ subagent_type: "triage-worker", description: "Process: Item 1", ... })
Task({ subagent_type: "triage-worker", description: "Process: Item 2", ... })
Task({ subagent_type: "triage-worker", description: "Process: Item 3", ... })
Task({ subagent_type: "triage-worker", description: "Process: Item 4", ... })
Task({ subagent_type: "triage-worker", description: "Process: Item 5", ... })
```

**EXCEPTION:** X/Twitter items must be sequential (single Chrome browser instance).

---

## Parsing Proposals

Subagents return structured text with `PROPOSAL_JSON:` prefix. Parse in coordinator:

```typescript
const match = subagentResponse.match(/PROPOSAL_JSON:(\{.*\})/);
const proposal = JSON.parse(match[1]);
```

On resume, use TaskGet loop instead (see [task-patterns.md](task-patterns.md)).

---

## Proposal Schema

See @plugins/para-obsidian/skills/triage/references/proposal-schema.md for the canonical TypeScript interface, field name conventions, confidence levels, and TaskUpdate metadata format.

---

## para_create Format

**CRITICAL:** Different templates use different field names. See the **content-processing** skill (preloaded into triage-worker) for the canonical `para_create` examples per template (resource, meeting, invoice).

**Key differences:**
- **Resources** use `areas`/`projects` (PLURAL) — YAML arrays supporting single or multiple wikilinks
  - Single: `areas: "[[🌱 Area]]"` (backward-compatible string)
  - Multiple: `areas: '["[[🌱 Area 1]]", "[[🌱 Area 2]]"]'` (JSON array string, parsed by `tryParseJsonArray()`)
- **Meetings** use `area`/`project` (SINGULAR) — and pass body via `content` parameter
- **Invoices** use `area` (SINGULAR) — plus `invoice_date`, `provider`, `amount`, etc.
- **NEVER pass null values in `args`** — omit the key entirely. `area: null` becomes `"[[null]]"` in frontmatter.

---

## Coordinator Context Loading

The coordinator loads vault context ONCE in Phase 1 and passes it to every subagent:

```typescript
const areas = await para_list_areas({ response_format: "json" });
const projects = await para_list_projects({ response_format: "json" });
const config = await para_config({ response_format: "json" });
const stakeholders = config.stakeholders || [];
```

This saves 50 items × 3 tool calls = 150 tool calls and ensures consistent context across all subagents.

---

## Best Practices

1. **Subagents enrich their own content** — keeps coordinator context clean
2. **Pass vault context from coordinator** — saves tool calls
3. **Use `triage-worker` agent** — dedicated agent with MCP tools, model set to haiku
4. **X/Twitter is sequential** — single Chrome browser instance
5. **Dual communication** — both TaskUpdate (persistence) AND PROPOSAL_JSON (immediate use)
6. **Commit after creation** — call `para_commit` after `para_create` (vault needs clean tree)
