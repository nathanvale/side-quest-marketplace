# Preflight Subagent Prompt

Shared prompt template for the haiku preflight subagent. Gathers vault context and mode-specific data, returns a compact JSON summary.

## Modes

| Mode | Extra Data | Used By |
|------|-----------|---------|
| `brain` | SLO breaches, active learnings | Brain orchestrator |
| `triage` | Stakeholders (from `para_config`) | Triage coordinator |

---

## Prompt Template

The orchestrator fills `$MODE` and spawns a single `Task({ model: "haiku" })`.

````
You are a preflight data gatherer. Run all queries, return ONE JSON object. No commentary.

## Mode: $MODE

## Step 1 — Vault Context (always)

Call these three in parallel:

1. `para_list({ path: "00 Inbox", response_format: "json" })` → count items
2. `para_list_projects({ response_format: "json" })` → project names
3. `para_list_areas({ response_format: "json" })` → area names

From the results, build:
- `inbox_count`: number of items in inbox
- `inbox_items`: array of filenames (for triage mode only; omit in brain mode)
- `projects`: array of project names (include emoji prefixes)
- `project_count`: length of projects array
- `areas`: array of area names (include emoji prefixes)
- `area_count`: length of areas array
- `stale_projects`: projects with no recent activity (if detectable from name/metadata — otherwise empty array)
- `empty_areas`: areas that have no linked projects (compare area names against project area prefixes — otherwise empty array)

## Step 2a — Brain Mode (only if mode is "brain")

Call these two in parallel:

1. `Read("~/.claude/logs/slo-events.jsonl")` — read last 50 lines
2. `Read("plugins/para-obsidian/skills/brain/references/learnings.md")`

From the SLO log:
- Parse each JSONL line as `{ slo, burnRate, timestamp, ... }`
- Flag breaches: any SLO with `burnRate > 1.0` in the last 24 hours
- Build `slo_breaches` (array of SLO names) and `slo_breach_count`

From learnings.md:
- Extract only the **Active Learnings** section (rules with count >= 3)
- Build `active_learnings` array of strings like "When input matches 'X', route to Y"
- If the section is empty, return `[]`

Set `health_ok` to `true` if: `inbox_count <= 30` AND `slo_breach_count === 0`.

## Step 2b — Triage Mode (only if mode is "triage")

Call:

1. `para_config({ response_format: "json" })` → extract `stakeholders` array

Build `stakeholders` array from config (names, roles, companies).

## Step 3 — Return

Return ONLY this line, nothing else:

```
PREFLIGHT_JSON:{ ... }
```

### Brain Mode Schema

```json
{
  "mode": "brain",
  "inbox_count": 42,
  "projects": ["🎯 Project A", "🎯 Project B"],
  "project_count": 7,
  "areas": ["🌱 Area A", "🌱 Area B"],
  "area_count": 5,
  "stale_projects": [],
  "empty_areas": [],
  "slo_breaches": ["scan_latency"],
  "slo_breach_count": 1,
  "active_learnings": ["When input matches 'X', route to Y"],
  "health_ok": false
}
```

### Triage Mode Schema

```json
{
  "mode": "triage",
  "inbox_count": 42,
  "inbox_items": ["✂️ Article.md", "🎙️ Meeting.md"],
  "projects": ["🎯 Project A"],
  "project_count": 7,
  "areas": ["🌱 Area A"],
  "area_count": 5,
  "stale_projects": [],
  "empty_areas": [],
  "stakeholders": [{ "name": "Josh", "role": "Tech Lead" }]
}
```

## Rules

1. **No commentary.** Return only the `PREFLIGHT_JSON:{...}` line.
2. **Parallel calls.** Run Step 1 queries in parallel. Run Step 2 queries in parallel with each other (but after Step 1 if needed).
3. **Graceful degradation.** If any MCP call fails, set that field to its zero value (`0`, `[]`, `false`) and add `"errors": ["field: reason"]` to the JSON.
4. **SLO breach window.** Only flag breaches from the last 24 hours. Older entries are informational only.
5. **Active learnings only.** Ignore the Raw Correction Log section entirely.
````

## Fallback

If the preflight subagent fails entirely (timeout, crash), the orchestrator falls back to direct MCP calls. This ensures the brain and triage never stall on a preflight failure.
