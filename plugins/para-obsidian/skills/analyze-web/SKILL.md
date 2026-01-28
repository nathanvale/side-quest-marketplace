---
name: analyze-web
description: Analyze web clippings, create resource notes with Layer 1 content, and return lightweight proposals. Handles enrichment, analysis, note creation, and Layer 1 injection so content never flows through coordinator. Worker skill for triage orchestrator.
user-invocable: false
allowed-tools: mcp__plugin_para-obsidian_para-obsidian__para_read, mcp__plugin_para-obsidian_para-obsidian__para_fm_get, mcp__plugin_para-obsidian_para-obsidian__para_create, mcp__plugin_para-obsidian_para-obsidian__para_replace_section, mcp__plugin_para-obsidian_para-obsidian__para_delete, mcp__firecrawl__firecrawl_scrape, mcp__youtube-transcript__get_video_info, mcp__youtube-transcript__get_transcript, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__take_snapshot, WebFetch
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

Return a JSON proposal (note: the resource is already created):

```json
{
  "file": "00 Inbox/✂️ Article Title.md",
  "type": "clipping",
  "proposed_title": "Meaningful Title Without Emoji",
  "proposed_template": "resource",
  "summary": "2-3 sentence summary of core content",
  "categorization_hints": [
    "First key insight",
    "Second key insight",
    "Third key insight"
  ],
  "suggested_areas": ["[[🌱 Area Name]]"],
  "suggested_projects": ["[[🎯 Project Name]]"],
  "resource_type": "article|tutorial|reference|thread",
  "source_format": "article|video|thread|document",
  "author": "Author Name (if found)",
  "confidence": "high|medium|low",
  "notes": "Any special considerations",
  "created": "03 Resources/Meaningful Title.md",
  "layer1_injected": true
}
```

## Workflow

### Step 1: Read Clipping

```
para_read({ file: "[input file]", response_format: "json" })
para_fm_get({ file: "[input file]", response_format: "json" })
```

Extract:
- `source` (URL)
- `domain`
- `capture_reason` (if present)
- Existing content

### Step 2: Fetch Full Content

**CRITICAL: Select tool based on domain.**

See @plugins/para-obsidian/references/content-sourcing/url-routing.md for full routing logic.

| Domain | Tool | Reference |
|--------|------|-----------|
| `x.com`, `twitter.com` | Chrome DevTools | @plugins/para-obsidian/references/content-sourcing/x-twitter.md |
| `youtube.com`, `youtu.be` | YouTube Transcript MCP | @plugins/para-obsidian/references/content-sourcing/youtube.md |
| Everything else | Firecrawl | @plugins/para-obsidian/references/content-sourcing/firecrawl.md |

#### For X/Twitter
```
mcp__chrome-devtools__navigate_page({ url: "[source]" })
mcp__chrome-devtools__take_snapshot()
```

If Chrome DevTools unavailable, note in `notes` field and follow user-assisted fallback in x-twitter.md.

#### For YouTube
```
mcp__youtube-transcript__get_video_info({ url: "[source]" })
mcp__youtube-transcript__get_transcript({ url: "[source]" })
```

#### For Other URLs
```
mcp__firecrawl__firecrawl_scrape({
  url: "[source]",
  formats: ["markdown"],
  onlyMainContent: true
})
```

### Step 3: Analyze Content

Determine:
1. **Template**: Is this learning material (`resource`) or reference (`gift`, `booking`, etc.)?
2. **Resource type**: `article`, `tutorial`, `reference`, `thread`, `issue`, `idea`
3. **Source format**: `video`, `article`, `thread`, `document`
4. **Categorization hints**: 3 bullets for organizing (NOT deep learning - use /para-obsidian:distill-resource)
5. **Connections**: Which areas/projects does this relate to?

### Step 4: Create Resource & Inject Layer 1

**This is where content stays isolated.** Create the resource note AND populate Layer 1 before returning the lightweight proposal.

#### 4.1 Create Resource Note

```
para_create({
  template: "resource",
  title: proposed_title,
  dest: "03 Resources",
  args: {
    summary: summary,
    source: source_url,
    resource_type: resource_type,
    source_format: source_format,
    areas: suggested_areas[0],
    projects: suggested_projects[0] || null,
    author: author || null,
    distilled: "false"
  },
  response_format: "json"
})
```

Store the `created` file path from the response.

#### 4.2 Format & Truncate Layer 1 Content

See @references/layer1-formatting.md for detailed patterns.

| Source | Strategy | Target |
|--------|----------|--------|
| Article | First 3 paragraphs + H2/H3 headings + conclusion | 2-3k tokens |
| YouTube | Sample ~10% of segments with timestamps | 2-3k tokens |
| Thread | Full content (usually short) | Keep all |

**Format as:**
```markdown
### Overview
[Opening content]

### Key Sections
- **[Heading]**: [Key point]
...

### Conclusion
[Closing content]

---
*Truncated from full content. Use /distill-resource for deeper analysis.*
```

#### 4.3 Inject Layer 1

```
para_replace_section({
  file: createdFilePath,
  heading: "Layer 1: Captured Notes",
  content: formattedLayer1Content,
  response_format: "json"
})
```

**If injection fails:** Set `layer1_injected: false` and continue. The resource still exists - user can add content during distillation.

#### 4.4 Delete Original Clipping

```
para_delete({ file: originalFile, confirm: true, response_format: "json" })
```

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
  "suggested_areas": ["[[🌱 AI Practice]]"],
  "suggested_projects": ["[[🎯 TypeScript Migration]]"],
  "resource_type": "tutorial",
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
| `para_create` fails | Return error, do not proceed with Layer 1 |
| `para_replace_section` fails | Set `layer1_injected: false`, continue with proposal |
| `para_delete` fails | Note in `notes` field, resource still created |
| Content empty/unparseable | Set `layer1_injected: false`, note reason |

**Soft failure philosophy:** Resource creation is primary. Layer 1 injection is enhancement. Don't block resource creation if Layer 1 fails.
