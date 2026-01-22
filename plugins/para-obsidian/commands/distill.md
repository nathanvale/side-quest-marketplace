---
description: Transform clippings and voice memos into resource notes with AI-guided progressive summarization
argument-hint: "[filename]"
---

# Distill Clippings

Transform clippings and voice memos from your inbox into deeply understood resource notes through a collaborative learning dialogue.

## Usage

```
/para-obsidian:distill                    # Process all clippings/transcriptions in inbox
/para-obsidian:distill "✂️ Article.md"   # Process specific clipping
/para-obsidian:distill "🎤 2024-01-22 3-45pm.md"  # Process voice memo
```

## What This Does

1. **Finds clippings** - Scans inbox for `type: clipping` or `type: transcription`
2. **Enriches content** - Fetches full content (web clips) or uses existing (voice memos)
3. **Learning dialogue** - AI teaches you the content through Socratic questioning
4. **Progressive summarization** - Collaboratively apply Layers 1-4
5. **Creates resource** - Creates a new resource note with insights and connections
6. **Handles originals** - Voice memos KEPT (linked via `source_note`), web clips DELETED

## Instructions

When invoked, load the `distill-resource` skill:

```
@plugins/para-obsidian/skills/distill-resource/SKILL.md
```

The skill guides you through the full workflow:

1. **Phase 0**: Scan inbox for `type: clipping` or `type: transcription`
2. **Phase 1**: Read clipping, fetch full content (skip for voice memos)
3. **Phase 2**: Teach the user - explain key concepts, ask what drew them to it
4. **Phase 3**: Layer 2 - Present bold-worthy passages, ask what resonates
5. **Phase 4**: Layer 3 - Distill to essence, confirm with user
6. **Phase 5**: Layer 4 - Co-create executive summary in user's words
7. **Phase 6**: Suggest connections (areas/projects), create resource note

## Example Session

```
User: /para-obsidian:distill

AI: Found 3 items to distill:
    1. ✂️ Arman Hezarkhani - Claude Code for iMessage (clipping)
    2. ✂️ Matt Pocock - TypeScript 5.5 Tips (clipping)
    3. 🎤 2024-01-22 3-45pm (voice memo)

    Which one shall we start with?

User: Start with the first one

AI: [Fetches full article content via Firecrawl]

    This article is about running Claude Code inside iMessage using
    a Shortcuts automation. The key insight is that...

    What drew you to clip this? What aspect interests you most?

[Dialogue continues through progressive summarization layers]

AI: Created: 📚 Claude Code iMessage Integration.md → 03 Resources
    Deleted: ✂️ Arman Hezarkhani - Claude Code for iMessage.md

    2 items remaining. Next one, or done for now?
```

## Capture Types

| Type | Icon | Content Location | After Distill |
|------|------|------------------|---------------|
| `clipping` | ✂️ | Fetch from `source` URL | DELETE original |
| `transcription` | 🎤 | Already in note | KEEP, link via `source_note` |

## Philosophy

This command implements the "D" in CODE (Capture → Organize → **Distill** → Express) from Tiago Forte's Building a Second Brain methodology.

The insight: **Distillation and learning should be the same act.** The moment of distillation is the moment of understanding. By the time the resource is created, you've internalized the key insights.
