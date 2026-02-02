# Content Sourcing Reference

Canonical documentation for fetching content from URLs across triage, distill-resource, and distill-web skills.

## Purpose

Consumer skills embed these references in subagent prompts via `@reference` syntax to provide consistent content fetching patterns without duplicating documentation.

## When to Use

| Scenario | Start With |
|----------|------------|
| Determining which tool for a URL | `url-routing.md` |
| Fetching YouTube transcripts | `youtube.md` |
| Fetching X/Twitter threads | `x-twitter.md` |
| Fetching articles, GitHub, docs | `firecrawl.md` |
| Orchestrating batch execution | `parallelization.md` |

## Files

| File | Purpose |
|------|---------|
| `url-routing.md` | Domain detection → tool selection (single source of truth) |
| `youtube.md` | YouTube Transcript MCP patterns and error handling |
| `x-twitter.md` | X-API MCP tools + user-assisted fallback |
| `firecrawl.md` | General web scraping for articles, GitHub, docs |
| `parallelization.md` | Batch execution rules, sequential constraints |

## How Consumers Reference

In subagent prompts or skill SKILL.md files:

```markdown
## Content Sourcing

For enrichment patterns, see:
@plugins/para-obsidian/references/content-sourcing/url-routing.md

Based on source type, follow the appropriate guide:
- YouTube: @plugins/para-obsidian/references/content-sourcing/youtube.md
- X/Twitter: @plugins/para-obsidian/references/content-sourcing/x-twitter.md
- Other: @plugins/para-obsidian/references/content-sourcing/firecrawl.md
```

## Design Rationale

These are **reference files**, not skills, because:
1. No invocation overhead (no SKILL.md frontmatter)
2. Pure documentation (no action implied)
3. `references/` is the established pattern in this codebase
4. No tool declarations needed
