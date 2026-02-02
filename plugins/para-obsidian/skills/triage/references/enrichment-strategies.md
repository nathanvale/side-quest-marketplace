# Enrichment Strategies

> **Canonical source** for enrichment routing. Other files (SKILL.md, triage-worker.md) reference this document rather than duplicating the routing table.

## Overview

Clippings are **stubs** - they contain URLs but not full content. Enrichment fetches the actual content before analysis.

**Key insight:** Each subagent enriches its own item. This keeps enriched content out of the coordinator's context.

---

## Content Sourcing Reference

For detailed tool selection and patterns, see the shared content sourcing documentation:

- **URL Routing:** @plugins/para-obsidian/references/content-sourcing/url-routing.md
- **YouTube:** @plugins/para-obsidian/references/content-sourcing/youtube.md
- **X/Twitter:** @plugins/para-obsidian/references/content-sourcing/x-twitter.md
- **Firecrawl:** @plugins/para-obsidian/references/content-sourcing/firecrawl.md
- **Parallelization:** @plugins/para-obsidian/references/content-sourcing/parallelization.md

---

## Quick Reference

| Source | Detection | Tool | Parallel? |
|--------|-----------|------|-----------|
| YouTube | `youtube.com` domain | youtube-transcript MCP | ✅ Yes |
| Public Articles | Default for clippings | Firecrawl | ✅ Yes |
| GitHub | `github.com` domain | Firecrawl | ✅ Yes |
| X/Twitter | `x.com` or `twitter.com` | X-API MCP | ✅ Yes |
| Confluence | `atlassian.net` domain | Chrome DevTools | ❌ No |
| Voice Memo | `type === "transcription"` | None | N/A |
| Attachment | PDF/DOCX | None | N/A |

---

## MANDATORY: X/Twitter Requires X-API Enrichment

**X/Twitter clippings from Web Clipper contain ONLY a stub.** The visible content is NOT the full thread.

You MUST:
1. Parse the `tweet_id` from the source URL (`x.com/<user>/status/<tweet_id>`)
2. Load X-API tools via `ToolSearch({ query: "x-api tweet" })`
3. Fetch the tweet via `x_get_tweet({ tweet_id })` — works for any age tweet
4. Optionally fetch thread via `x_get_thread({ tweet_id })` — replies limited to 7-day window

**Never skip this step. Never analyze X/Twitter based solely on clipping file content.**

See @plugins/para-obsidian/references/content-sourcing/x-twitter.md for full patterns.

---

## Subagent Enrichment Architecture

Each subagent enriches its OWN item. The coordinator does NOT fetch content.

### Why Subagent Enrichment?

| Approach | Coordinator Context | Problem |
|----------|---------------------|---------|
| Coordinator enriches | 50 transcripts × 10k = 500k tokens | Context pollution |
| Subagent enriches | Only small task metadata | Clean context |

### Coordinator Groups Items

```typescript
const parallelItems = [];     // YouTube, Firecrawl, X-API - spawn in batches of 10
const sequentialItems = [];   // Chrome DevTools (Confluence only) - spawn one at a time

for (const item of inboxItems) {
  if (item.sourceType === 'youtube' || item.sourceType === 'article' || item.sourceType === 'twitter') {
    parallelItems.push(item);
  } else if (item.sourceType === 'confluence') {
    sequentialItems.push(item);
  } else {
    parallelItems.push(item);  // Voice/attachment - no enrichment needed
  }
}
```

The enriched content stays in the subagent's context - never flows back to coordinator.

See @plugins/para-obsidian/references/content-sourcing/parallelization.md for batch execution patterns.

---

## Source Detection

Detect source type from clipping frontmatter or URL:

```typescript
function detectSourceType(item: InboxItem): string {
  const url = item.source || '';

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube';
  }
  if (url.includes('x.com') || url.includes('twitter.com')) {
    return 'twitter';
  }
  if (url.includes('github.com')) {
    return 'github';
  }
  if (url.includes('atlassian.net') || url.includes('confluence')) {
    return 'confluence';
  }
  if (item.type === 'transcription') {
    return 'voice';
  }
  if (item.type === 'attachment') {
    return 'attachment';
  }

  // Default: treat as public article
  return 'article';
}
```

See @plugins/para-obsidian/references/content-sourcing/url-routing.md for the canonical routing table.

---

## Enrichment Failed: Next Steps

When enrichment fails for an item:

1. **Task metadata updated** with `enrichmentFailed: true`
2. **Item remains in pending** (not marked in_progress)
3. **Table shows warning** for failed items
4. **User decides**: retry, delete, or skip

This ensures no item is silently dropped - user always has visibility into failures.

---

## Enrichment Constraints

| Source | Parallel? | Reason |
|--------|-----------|--------|
| YouTube | ✅ Yes | Stateless API |
| Firecrawl | ✅ Yes | Batch API |
| X-API (X/Twitter) | ✅ Yes | Stateless API |
| Chrome DevTools (Confluence) | ❌ No | Single browser instance (Chrome DevTools MCP limitation) |

---

## Voice Memo Special Cases

Voice memos are the most ambiguous content type:

| Pattern | proposed_template | meeting_type |
|---------|-------------------|--------------|
| Multiple speakers + status updates | meeting | standup |
| Two people + career topics | meeting | 1on1 |
| Sprint planning discussion | meeting | planning |
| Single speaker thinking aloud | resource (idea) | null |
| Quick reminder | capture | null |
| Teams VTT file | meeting | (inferred) |

**Key insight:** Personal voice memos (iOS) vs Teams VTTs have different contexts. iOS is usually ideas/reminders. VTTs are usually meetings.
