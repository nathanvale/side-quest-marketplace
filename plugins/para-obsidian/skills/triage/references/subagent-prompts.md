# Subagent Prompts

## Overview

Each subagent handles BOTH enrichment AND analysis for a single inbox item. This keeps enriched content out of the coordinator's context.

**Subagent responsibilities:**
1. Fetch full content (enrich)
2. Analyze and create proposal
3. Create note via `para_create` with `content` parameter (creates + injects Layer 1 + commits in one call)
4. Persist via TaskUpdate

**Coordinator responsibilities:**
1. Scan inbox, create tasks
2. Load vault context (areas/projects) ONCE
3. Spawn subagents with context
4. Present table, handle edits
5. Execute cleanup (delete/archive originals, fallback creation if subagent failed)
6. Verify and stamp critical frontmatter fields from proposals (Phase 2.5 — runs after all subagents complete, before presenting review table)

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

    ## Template Fields (pre-loaded)
    These fields were fetched by the coordinator. Do NOT call para_template_fields — use these directly.

    ### Resource Template
    ${JSON.stringify(templateFields.resource, null, 2)}

    ### Meeting Template (if applicable)
    ${templateFields.meeting ? JSON.stringify(templateFields.meeting, null, 2) : "N/A — only loaded when voice memos are present"}

    **CRITICAL:** Only use areas/projects from the lists above. Never hallucinate names.
    **CRITICAL:** Use validArgs from the template fields above. Do NOT call para_template_fields.
    **MANDATORY:** Pass no_autocommit: true and skip_guard: true to para_create. These flags prevent git guard conflicts and per-item commits during parallel execution. The coordinator handles the bulk commit after all items complete.

    Follow your workflow: read → enrich → analyze → create (with content param for Layer 1, no_autocommit, skip_guard) → persist (verification_status: "pending_coordinator") → return PROPOSAL_JSON. Skip post-creation verification — the coordinator handles it in Phase 2.5.
  `
})
```

The `triage-worker` agent already knows the full workflow (enrichment routing, note creation, Layer 1 injection, proposal fields, persistence, output format). You only need to pass item details and vault context.

---

## Parallel Spawning

**CRITICAL:** To run subagents in parallel, include multiple Task calls in a single message.

```typescript
// Single message with up to 10 Task calls = parallel execution
Task({ subagent_type: "triage-worker", description: "Process: Item 1", ... })
Task({ subagent_type: "triage-worker", description: "Process: Item 2", ... })
Task({ subagent_type: "triage-worker", description: "Process: Item 3", ... })
// ... up to 10 per batch
Task({ subagent_type: "triage-worker", description: "Process: Item 10", ... })
```

**EXCEPTION:** Confluence items must be sequential (single Chrome browser instance). X/Twitter items run in parallel via stateless X-API MCP tools.

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
4. **Confluence is sequential** — single Chrome browser instance. X/Twitter runs in parallel via stateless X-API MCP.
5. **Dual communication** — both TaskUpdate (persistence) AND PROPOSAL_JSON (immediate use)
6. **Single-call creation** — use `para_create` with `content` parameter (creates + injects in one call). During triage, pass `no_autocommit: true` — the coordinator bulk-commits after all workers complete.
7. **Coordinator verifies** — workers set `verification_status: "pending_coordinator"`. The coordinator stamps and verifies critical frontmatter fields from proposals before presenting the review table.
