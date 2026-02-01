---
name: analyze-web
description: Analyze web clippings, create resource notes with Layer 1 content, and return lightweight proposals. Handles enrichment, analysis, note creation, and Layer 1 injection so content never flows through coordinator. Worker skill for triage orchestrator.
user-invocable: false
---

# Analyze Web Clipping

Analyze a single web clipping, **create the resource note with Layer 1 content**, and return a lightweight proposal.

**Key design:** This skill creates the resource note AND populates Layer 1 before returning. The full content stays in subagent context - only the proposal flows back to the coordinator.

## Input

You receive:
- `file`: Path to clipping in inbox (e.g., `00 Inbox/✂️ Article Title.md`)
- `areas`: Available areas in vault
- `projects`: Available projects in vault

## Output

Return a JSON proposal per @plugins/para-obsidian/skills/triage/references/proposal-schema.md.

**Key:** Use `area` (single wikilink), `project` (single wikilink or null), `resourceType` (camelCase). Include `file`, `type: "clipping"`, `created`, and `layer1_injected` alongside the standard proposal fields.

## Workflow

### Step 1: Read Clipping

```
para_read({ file: "[input file]", response_format: "json" })
```

Extract frontmatter fields (`source`, `domain`, `capture_reason`, pre-filled `areas`/`projects`) from the YAML header in the `para_read` response. Do NOT call `para_fm_get` separately — `para_read` returns the full file including frontmatter.

Also extract existing body content.

### Step 2: Fetch Full Content

**CRITICAL: Select tool based on domain.**

See @plugins/para-obsidian/skills/triage/references/enrichment-strategies.md for the canonical routing table and tool selection.

See @plugins/para-obsidian/references/content-sourcing/url-routing.md for detailed per-domain patterns (X/Twitter, YouTube, Firecrawl).

### Step 3: Analyze Content

Determine:
1. **Template**: Is this learning material (`resource`) or reference (`gift`, `booking`, etc.)?
2. **Resource type**: `article`, `tutorial`, `reference`, `thread`, `issue`, `idea`
3. **Source format**: `video`, `article`, `thread`, `document`
4. **Categorization hints**: 3 bullets for organizing (NOT deep learning - use /para-obsidian:distill-resource)
5. **Connections**: Which areas/projects does this relate to?

### Step 4: Create Resource & Inject Layer 1 (Single Call)

**This is where content stays isolated.** Use `para_create` with the `content` parameter to create the note AND inject Layer 1 in a single tool call:

```
para_create({
  template: "resource",
  title: proposed_title,
  args: { ...fields from validArgs },
  content: {
    "<content-target-heading>": formattedLayerOneContent
  },
  response_format: "json"
})
```

The `content` parameter maps heading names to body content. The CLI internally creates the note, injects content into the matching section, and auto-commits — all in one invocation. No separate `para_commit` or `para_replace_section` calls needed.

**Content target heading:** Use `creation_meta.contentTargets[0]` from template fields (typically `"Layer 1: Captured Notes"`). If template fields were pre-loaded in the prompt context (triage mode), use those directly.

See @references/layer1-formatting.md for Layer 1 content formatting patterns (articles, YouTube, threads).

**If `para_create` fails:** Set `created: null`, `layer1_injected: null`, and continue with the proposal. The `content` parameter failure is atomic — no partial state.

### Step 5: Return Proposal

Return the lightweight JSON proposal. The resource is already created with Layer 1 populated.

```json
{
  "file": "00 Inbox/✂️ Original.md",
  "type": "clipping",
  "proposed_title": "Title",
  "proposed_template": "resource",
  "summary": "...",
  "created": "03 Resources/Title.md",
  "layer1_injected": true,
  ...
}
```

The coordinator receives only this ~500 byte proposal, not the 10-20k token content.

## Template Routing

| Content Type | Template | Resource Type |
|--------------|----------|---------------|
| Tutorial/how-to | resource | tutorial |
| News/opinion | resource | article |
| Twitter thread | resource | thread |
| API docs | resource | reference |
| GitHub issue | resource | issue |
| Product page | gift | - |
| Booking confirmation | booking | - |
| Flight/hotel | booking | - |

## Confidence Levels

| Level | Meaning |
|-------|---------|
| `high` | Clear content, obvious categorization |
| `medium` | Reasonable guess, user may want to adjust |
| `low` | Ambiguous content, multiple valid interpretations |

## Example Output

```json
{
  "file": "00 Inbox/✂️ Matt Pocock TypeScript Tips.md",
  "type": "clipping",
  "proposed_title": "TypeScript 5.5 Inference Improvements",
  "proposed_template": "resource",
  "summary": "Matt Pocock explains new type inference features in TypeScript 5.5, focusing on const type parameters and improved narrowing in control flow.",
  "categorization_hints": [
    "Const type parameters preserve literal types without 'as const'",
    "Control flow analysis now narrows in more cases",
    "New 'satisfies' patterns for type-safe object literals"
  ],
  "area": "[[🌱 AI Practice]]",
  "project": "[[🎯 TypeScript Migration]]",
  "resourceType": "tutorial",
  "source_format": "thread",
  "author": "Matt Pocock",
  "confidence": "high",
  "notes": null,
  "created": "03 Resources/TypeScript 5.5 Inference Improvements.md",
  "layer1_injected": true
}
```

## Error Handling

| Scenario | Action |
|----------|--------|
| `para_create` (with `content`) fails | Set `created: null`, `layer1_injected: null`, return error proposal |
| Content empty/unparseable | Create note without `content` parameter, set `layer1_injected: false` |

**Atomic creation:** When using the `content` parameter, creation and injection are a single atomic operation. If it fails, there's no partial state to clean up.
