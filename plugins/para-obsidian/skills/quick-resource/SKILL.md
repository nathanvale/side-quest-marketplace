---
name: quick-resource
description: Create a resource note from any URL with automatic enrichment and Layer 1 content. Composable with conversation context. Single-URL counterpart to triage batch processing.
argument-hint: "<url> [--area '[[Area]]'] [--project '[[Project]]'] [--title 'Title']"
user-invocable: true
allowed-tools: AskUserQuestion, ToolSearch, WebFetch, mcp__plugin_para-obsidian_para-obsidian__para_create, mcp__plugin_para-obsidian_para-obsidian__para_replace_section, mcp__plugin_para-obsidian_para-obsidian__para_commit, mcp__plugin_para-obsidian_para-obsidian__para_list_areas, mcp__plugin_para-obsidian_para-obsidian__para_list_projects, mcp__plugin_para-obsidian_para-obsidian__para_fm_set, mcp__firecrawl__firecrawl_scrape, mcp__youtube-transcript__get_video_info, mcp__youtube-transcript__get_transcript, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__take_snapshot
---

# Quick Resource

Create a resource note from any URL in one invocation. Enriches content, classifies it, injects Layer 1, and commits to vault.

**Key design:** Runs inline (not as subagent), so it naturally has access to everything discussed in the current session. If you already fetched a YouTube transcript or scraped an article earlier in the conversation, reuse that content instead of fetching again.

## Input

Parse from skill arguments:

| Argument | Required | Example |
|----------|----------|---------|
| URL | Yes | `https://youtube.com/watch?v=abc123` |
| `--area` | No | `--area '[[🌱 AI Practice]]'` |
| `--project` | No | `--project '[[🎯 Claude Code Mastery]]'` |
| `--title` | No | `--title 'Custom Title Here'` |

## Workflow

### Phase 1: Input & Context

1. **Parse arguments** - Extract URL and optional flags (`--area`, `--project`, `--title`)
2. **Check conversation context** - Before fetching, check if URL content already exists in the conversation (e.g., YouTube transcript already pulled, Firecrawl already scraped, user-provided notes). Use existing content first.
3. **Load vault context** if `--area` or `--project` not provided:

```
para_list_areas({ response_format: "json" })
para_list_projects({ response_format: "json" })
```

### Phase 2: Enrich

**Select tool based on domain.** See @references/content-sourcing/url-routing.md for full routing logic.

| Domain | Tool | Reference |
|--------|------|-----------|
| `x.com`, `twitter.com` | Chrome DevTools | @references/content-sourcing/x-twitter.md |
| `youtube.com`, `youtu.be` | YouTube Transcript MCP | @references/content-sourcing/youtube.md |
| Everything else | Firecrawl | @references/content-sourcing/firecrawl.md |

**Skip enrichment** if content already exists in conversation context.

#### YouTube
```
mcp__youtube-transcript__get_video_info({ url: "[url]" })
mcp__youtube-transcript__get_transcript({ url: "[url]" })
```

#### X/Twitter
```
mcp__chrome-devtools__navigate_page({ url: "[url]" })
mcp__chrome-devtools__take_snapshot()
```

If Chrome DevTools unavailable, note in proposal and follow user-assisted fallback in x-twitter.md.

#### Other URLs
```
mcp__firecrawl__firecrawl_scrape({
  url: "[url]",
  formats: ["markdown"],
  onlyMainContent: true
})
```

**Fallback chain:** If Firecrawl fails or is unavailable, use `WebFetch` as fallback.

### Phase 3: Classify & Format

#### 3.1 Classify Content

Using @../para-classifier/references/classification-decision-tree.md, determine:

1. **Resource type**: `article`, `tutorial`, `reference`, `thread`, `video`, `idea`
2. **Source format**: `article`, `video`, `thread`, `document`
3. **Author** (if discoverable from content)
4. **Summary**: 2-3 sentences capturing the core value

#### 3.2 Map Emoji Prefix

Using @../para-classifier/references/emoji-mapping.md, determine the emoji prefix for the note title based on `source_format`:

| Source Format | Prefix |
|---------------|--------|
| video | `📺 ` |
| thread | `🧵 ` |
| article | (none - default resource) |
| document | `📄 ` |

#### 3.3 Suggest Area & Project

If not provided via flags:
- Match content against available areas and projects
- Prefer the most specific match
- If no confident match, suggest the most likely candidate

#### 3.4 Format Layer 1 Content

Using @../analyze-web/references/layer1-formatting.md:

| Source | Strategy | Target |
|--------|----------|--------|
| Article | First 3 paragraphs + H2/H3 headings + conclusion | 2-3k tokens |
| YouTube | Sample ~10% of segments with timestamps | 2-3k tokens |
| Thread | Full content (usually short) | Keep all |

### Phase 4: Propose & Confirm

Present a concise proposal to the user:

```
Resource Proposal:
  Title:    [emoji] [proposed title]
  Type:     [resource_type] ([source_format])
  Area:     [[🌱 Area Name]]
  Project:  [[🎯 Project Name]] (or "none")
  Author:   [author or "unknown"]
  Summary:  [2-3 sentence summary]

Layer 1 preview:
  [first ~200 chars of formatted Layer 1 content...]

Accept / Edit / Cancel?
```

Use AskUserQuestion with options:
- **Accept** - Create as proposed
- **Edit** - Let user modify title, area, or project before creation
- **Cancel** - Abort without creating anything

If user chooses **Edit**, ask which fields to change and re-present the updated proposal.

### Phase 5: Create & Commit

#### 5.1 Create Resource Note

Using the frontmatter-only pattern from @../create-resource/SKILL.md:

```
para_create({
  template: "resource",
  title: proposed_title,
  dest: "03 Resources",
  args: {
    summary: summary,
    source: url,
    resource_type: resource_type,
    source_format: source_format,
    areas: suggested_area,
    projects: suggested_project || null,
    author: author || null,
    distilled: "false"
  },
  response_format: "json"
})
```

Store the `created` file path from the response.

#### 5.2 Inject Layer 1 Content

```
para_replace_section({
  file: createdFilePath,
  heading: "Layer 1: Captured Notes",
  content: formattedLayer1Content,
  response_format: "json"
})
```

**If injection fails:** Continue without Layer 1. The resource still exists - user can add content later via `/para-obsidian:distill-resource`.

#### 5.3 Commit to Vault

```
para_commit({
  message: "Add resource: [title]",
  response_format: "json"
})
```

#### 5.4 Report Success

```
Created: 03 Resources/[Title].md
  Area:     [[🌱 Area Name]]
  Project:  [[🎯 Project Name]]
  Layer 1:  ✓ injected (or "⚠ skipped - [reason]")
  Commit:   ✓ committed (or "⚠ skipped - [reason]")

Use /para-obsidian:distill-resource to deepen with progressive summarization.
```

## Error Handling

| Scenario | Action |
|----------|--------|
| URL unreachable | Try fallback chain (Firecrawl → WebFetch). If all fail, report error. |
| Content empty/unparseable | Report to user, suggest `/para-obsidian:clip` as fallback |
| `para_create` fails | Report error, do not proceed |
| `para_replace_section` fails | Set Layer 1 status to skipped, continue with commit |
| `para_commit` fails | Note in report, resource still exists |
| User cancels | Clean exit, no changes made |

**Soft failure philosophy:** Resource creation is primary. Layer 1 injection and commit are enhancements. Don't block resource creation if downstream steps fail.

## Examples

### YouTube Video
```
/para-obsidian:quick-resource https://www.youtube.com/watch?v=ey4u7OUAF3c
```

### Article with Flags
```
/para-obsidian:quick-resource https://kentcdodds.com/blog/aha-programming --area '[[🌱 AI Practice]]' --title 'AHA Programming'
```

### X/Twitter Thread
```
/para-obsidian:quick-resource https://x.com/housecor/status/1234567890
```

### URL from Conversation
```
User: [earlier in conversation, already scraped an article via Firecrawl]
User: /para-obsidian:quick-resource https://already-scraped-url.com/article
→ Skill reuses existing content from conversation context
```
