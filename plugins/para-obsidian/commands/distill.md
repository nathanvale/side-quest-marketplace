---
name: distill
description: Distill clippings into resource notes with AI-guided progressive summarization
argument-hint: "[optional: specific clipping filename]"
disable-model-invocation: true
---

# Distill Clippings

Transform raw clippings from your inbox into deeply understood resource notes through a collaborative learning dialogue.

## Usage

```
/para-obsidian:distill                    # Process all clippings in inbox
/para-obsidian:distill "✂️ Article.md"   # Process specific clipping
```

## What This Does

1. **Finds clippings** - Scans inbox for notes with `type: clipping`
2. **Enriches content** - ALWAYS fetches full content from source URL
3. **Learning dialogue** - AI teaches you the content through Socratic questioning
4. **Progressive summarization** - Collaboratively apply Layers 1-4
5. **Creates resource** - Generates a resource note with your insights
6. **Cleans up** - Deletes the original clipping (it's been transformed)

## Instructions

When invoked, load the `distill-resource` skill:

```
@plugins/para-obsidian/skills/distill-resource/SKILL.md
```

The skill guides you through the full workflow:

1. **Phase 0**: Scan inbox for `type: clipping` notes
2. **Phase 1**: Read clipping, fetch full content via enrichment strategy
3. **Phase 2**: Teach the user - explain key concepts, ask what drew them to it
4. **Phase 3**: Layer 2 - Present bold-worthy passages, ask what resonates
5. **Phase 4**: Layer 3 - Distill to essence, confirm with user
6. **Phase 5**: Layer 4 - Co-create executive summary in user's words
7. **Phase 6**: Suggest connections, create resource, delete clipping

## Example Session

```
User: /para-obsidian:distill

AI: Found 3 clippings to distill:
    1. ✂️📰 Arman Hezarkhani - Claude Code for iMessage
    2. ✂️🎬 Matt Pocock - TypeScript 5.5 Tips
    3. ✂️ Thread by @damianplayer

    Which one shall we start with?

User: Start with the first one

AI: [Fetches full article content via Firecrawl]

    This article is about running Claude Code inside iMessage using
    a Shortcuts automation. The key insight is that...

    What drew you to clip this? What aspect interests you most?

[Dialogue continues through progressive summarization layers]

AI: Created: 📦 Claude Code iMessage Integration.md
    Deleted: ✂️📰 Arman Hezarkhani - Claude Code for iMessage.md

    Next clipping, or done for now?
```

## Philosophy

This command implements the "D" in CODE (Capture → Organize → **Distill** → Express) from Tiago Forte's Building a Second Brain methodology.

The insight: **Distillation and learning should be the same act.** The moment of distillation is the moment of understanding. By the time the resource note is created, you've internalized the key insights.
