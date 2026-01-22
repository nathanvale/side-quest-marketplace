---
name: distill-resource
description: Transform clippings into deeply understood resource notes through AI-guided progressive summarization. Implements BASB Distill phase with Socratic dialogue. Use when processing clippings from inbox, learning from saved content, or creating resource notes from raw captures.
allowed-tools: Read, Edit, AskUserQuestion, mcp__plugin_para-obsidian_para-obsidian__para_read, mcp__plugin_para-obsidian_para-obsidian__para_list, mcp__plugin_para-obsidian_para-obsidian__para_create, mcp__plugin_para-obsidian_para-obsidian__para_delete, mcp__plugin_para-obsidian_para-obsidian__para_frontmatter_get, mcp__plugin_para-obsidian_para-obsidian__para_frontmatter_set, mcp__plugin_para-obsidian_para-obsidian__para_list_areas, mcp__plugin_para-obsidian_para-obsidian__para_list_projects, mcp__plugin_para-obsidian_para-obsidian__para_config, mcp__plugin_para-obsidian_para-obsidian__para_template_fields, mcp__firecrawl__firecrawl_scrape, mcp__youtube-transcript__get_video_info, mcp__youtube-transcript__get_transcript, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__take_snapshot, mcp__chrome-devtools__evaluate_script, WebFetch
---

# Distill Resource

Transform raw clippings into deeply understood resource notes through collaborative learning.

## Core Philosophy

**Distillation and learning are the same act.** This skill makes you (the AI) a learning partner who:
1. Reads and understands the source content deeply
2. Teaches the user through explanation and questioning
3. Guides progressive summarization (Layers 1-4)
4. Creates a resource note that captures genuine understanding

By the time the resource note exists, the user has **internalized** the key insights.

## Critical Rules

1. **ALWAYS fetch full content** - Clipping notes are pointers; fetch the real content
2. **ALWAYS use correct tool for domain** - See Phase 1.2 for mandatory tool selection
3. **NEVER use Firecrawl for X/Twitter** - It will fail; use Chrome DevTools or ask user
4. **Teach, don't summarize** - Explain concepts, ask questions, guide discovery
5. **Layer 4 must be user's words** - Co-create the executive summary through dialogue
6. **Use capture_reason** - If present, acknowledge why they saved this
7. **Delete clippings after distilling** - The clipping is transformed into a resource
8. **Voice transcripts are KEPT** - Link via `source_note`; only web clips are deleted

## Workflow Overview

```
Phase 0: Find Clippings
    ↓
Phase 1: Read & Enrich (ALWAYS fetch full content)
    ↓
Phase 2: Teaching & Understanding
    ↓
Phase 3: Layer 2 - What Resonates?
    ↓
Phase 4: Layer 3 - The Essence
    ↓
Phase 5: Layer 4 - Executive Summary (USER'S WORDS)
    ↓
Phase 6: Connections & Note Creation
```

---

## Phase 0: Find Clippings

Scan inbox for notes with `type: clipping` or `type: transcription` frontmatter.

```
para_list({ path: "00 Inbox", response_format: "json" })
```

For each file, check frontmatter:

```
para_frontmatter_get({ file: "00 Inbox/[filename]", response_format: "json" })
```

**Detection criteria:** `type === "clipping"` OR `type === "transcription"`

Present findings to user:

```
Found 5 items to distill:

1. ✂️📰 Arman Hezarkhani - Claude Code for iMessage
2. ✂️🎬 Matt Pocock - TypeScript 5.5 Tips
3. 🎤 2024-01-22 3-45pm (voice memo)
4. ✂️ Thread by @damianplayer
5. ✂️ Building a Second Brain Overview

Which one shall we start with?
```

---

## Phase 1: Read & Enrich

**ALWAYS fetch full content** from the source URL. The clipping note is just a pointer.

### 1.1 Read Clipping Note

```
para_read({ file: "00 Inbox/[selected clipping]", response_format: "json" })
```

Extract:
- `source` (URL)
- `domain` (for strategy selection)
- `capture_reason` (if present - use in dialogue!)
- Existing content (may be partial)

**Voice memo handling:** If `type: transcription`, the note already contains the transcription. Skip URL fetching - you have the content.

### 1.2 Fetch Full Content - CRITICAL TOOL SELECTION

**Skip enrichment if `type: transcription`** - voice memos already have full content.

For clippings, **YOU MUST select the correct tool based on domain. This is non-negotiable.**

Parse the domain from the source URL first:
```javascript
const url = new URL(source);
const domain = url.hostname.replace('www.', '');
```

#### Tool Selection Decision Tree

```
Is type "transcription"?
├─ YES → Skip enrichment (content is in the note)
│
Is domain x.com or twitter.com?
├─ YES → Use Chrome DevTools (Step A)
│        ├─ Tool available? → Fetch content
│        └─ Tool unavailable? → Ask user (Step D)
│        **NEVER use Firecrawl for X/Twitter - it will always fail**
│
Is domain youtube.com or youtu.be?
├─ YES → Use YouTube Transcript MCP (Step B)
│
Everything else?
└─ YES → Use Firecrawl (Step C)
```

#### Step A: X/Twitter (Chrome DevTools) - TRY THIS FIRST FOR x.com/twitter.com

**NEVER use Firecrawl for X/Twitter URLs. It is blocked and will fail.**

```
mcp__chrome-devtools__navigate_page({ url: "[source URL]" })
```

Wait for page load, then:

```
mcp__chrome-devtools__take_snapshot()
```

If Chrome DevTools tools are **not available** (tool not found error), go directly to **Step D** (User Fallback).

#### Step B: YouTube (Transcript MCP)

```
mcp__youtube-transcript__get_video_info({ url: "[source URL]" })
mcp__youtube-transcript__get_transcript({ url: "[source URL]" })
```

If transcript unavailable, use video description and note limitation.

#### Step C: All Other URLs (Firecrawl)

```
mcp__firecrawl__firecrawl_scrape({
  url: "[source URL]",
  formats: ["markdown"],
  onlyMainContent: true
})
```

If Firecrawl fails, fall back to WebFetch.

#### Step D: User Fallback (X/Twitter when Chrome DevTools unavailable)

When Chrome DevTools MCP is not available for X/Twitter:

1. Parse URL for username: `https://x.com/[username]/status/[id]`
2. Check if clipping already has content
3. Ask user:

```
I can't fetch X/Twitter content directly (Chrome DevTools MCP isn't available in this session).

**Tweet by @[username]:** [source URL]

Could you help? Either:
1. **Paste the tweet text** here
2. **Summarize what it's about** from memory
3. **Skip this clipping** and move to the next one

What would you prefer?
```

See `./references/enrichment-strategies.md` for additional details on each strategy.

### 1.3 Understand the Content

Before proceeding, you (the AI) must deeply understand:
- The main argument or thesis
- Key concepts and how they connect
- Why this matters (the "so what?")
- Potential applications or implications

---

## Phase 2: Teaching & Understanding

Now **teach** the user about what you found. This is Socratic dialogue, not a data dump.

### Opening (Acknowledge capture_reason if present)

If the clipping has `capture_reason`:

```
I see you captured this because "[capture_reason]". Let me explain what I found...
```

If no capture_reason:

```
I've read through this [article/video/thread]. Here's what it's about...
```

### Explain the Core Concepts

- **What is this about?** (2-3 sentences)
- **What's the key argument?** (main thesis)
- **Why does it matter?** (implications)

### Invite Engagement

```
What drew you to clip this? What aspect interests you most?
```

Wait for user response. Their answer guides the rest of the dialogue.

---

## Phase 3: Layer 2 - What Resonates?

Present the passages you found most important and ask what resonates with THEM.

### Present Bold-Worthy Passages

```
I found these passages particularly important:

1. "[Quote A]" - This captures the core mechanism because...

2. "[Quote B]" - This is significant because...

3. "[Quote C]" - This challenges the common assumption that...

What resonates with YOU? Anything I missed that struck you?
```

### Collaborate on Selection

User might:
- Agree with your selections
- Add their own passages
- Shift focus to different aspects

Honor their input - this is THEIR learning, not yours.

---

## Phase 4: Layer 3 - The Essence

Distill to the absolute core. Confirm with user.

### Present Distilled Essence

```
Of everything we've discussed, the absolute essence is:

[1-2 sentence distillation capturing the core insight]

Does that capture it? Or is the core something else for you?
```

### Iterate if Needed

User might refine or redirect. The goal is arriving at THEIR understanding of the essence, not imposing yours.

---

## Phase 5: Layer 4 - Executive Summary

**CRITICAL:** Layer 4 must be in the USER'S OWN WORDS.

### Propose Takeaways

```
Let's agree on 3-5 things to remember. I propose:

1. [Takeaway based on dialogue]
2. [Takeaway based on dialogue]
3. [Takeaway based on dialogue]

How would YOU phrase these? What's missing? What would you add?
```

### Co-Create the Summary

User will:
- Rephrase in their own words
- Add or remove items
- Prioritize differently

Incorporate their language. The final summary should feel like THEIR words, not yours.

---

## Phase 6: Connections & Note Creation

### 6.1 Check for Pre-filled Connections

First, check if the source note already has `areas` or `projects` filled in (from Phase 1 frontmatter):

```
para_frontmatter_get({ file: "00 Inbox/[selected note]", response_format: "json" })
```

If `areas` and/or `projects` arrays are non-empty, **use those directly** and skip to 6.3.

**Example pre-filled transcription frontmatter:**
```yaml
type: transcription
areas:
  - "[[🌱 Work]]"
  - "[[🌱 AI Practice]]"
projects:
  - "[[🎯 Oil Team Migration]]"
```

This speeds up distillation when users pre-fill connections in Obsidian before running `/distill`.

### 6.2 Suggest Connections (if not pre-filled)

Only if `areas` and `projects` are empty, fetch vault context and suggest:

```
para_list_areas({ response_format: "json" })
para_list_projects({ response_format: "json" })
```

Based on the dialogue, suggest relevant connections:

```
This connects to:
- [[🌱 AI Practice]] - The automation patterns could enhance your AI workflows
- [[🎯 Home Automation]] - The productivity principles apply to this project

Does that feel right? Any other connections?
```

### 6.3 Determine Resource Type

Ask the user what type of resource this is:

```
What type of resource is this?
- meeting (voice memo from a meeting)
- tutorial (how-to content)
- reference (documentation, specs)
- article (blog post, news)
- research (papers, studies)
- issue (bug report, ticket)
- decision (architecture decision)
- idea (brainstorm, concept)
- recipe (step-by-step process)
- conversation (chat, interview)
- how-to (practical guide)
```

### 6.4 Create Resource Note

```
para_create({
  template: "resource",
  title: "[Concise, meaningful title]",
  dest: "03 Resources",
  args: {
    "resource_type": "[from dialogue]",
    "source": "[URL or [[🎤 note link]]]"
  },
  content: {
    "Summary": "[2-3 sentences from Phase 2]",
    "Key Insights": "[Bullet points from dialogue]",
    "Notable Quotes": "[Bold-worthy passages from Phase 3]",
    "Layer 1: Captured Notes": "[Raw quote/passage that captures the core - from Notable Quotes]",
    "Layer 2: Bold Passages": "[Key insights with **bold** markers on important phrases]",
    "Layer 3: Highlighted Core": "[1-2 sentence essence with ==highlight== on the core insight]",
    "Executive Summary": "[USER'S takeaways from Phase 5]"
  },
  response_format: "json"
})
```

### 6.5 Handle Original Note

**For voice transcripts (`type: transcription`):**
- KEEP the original transcription note
- The new resource links to it via `source`

**For web clippings (`type: clipping`):**
- DELETE the original clipping after successful resource creation

```
para_delete({
  file: "00 Inbox/[original clipping]",
  confirm: true,
  response_format: "json"
})
```

### 6.6 Offer Next or Done

```
Created: 📚 [Resource Title].md → 03 Resources
[Kept/Deleted]: [Original note status]

[Count] items remaining. Next one, or done for now?
```

---

## Dialogue Examples

See `./references/progressive-summarization.md` for detailed dialogue patterns for each layer.

---

## Error Handling

| Error | Recovery |
|-------|----------|
| Content fetch fails | Use existing clipping content, note limitations |
| No source URL | Ask user to provide context manually |
| Chrome DevTools unavailable | **See below** - graceful user-assisted fallback |
| YouTube transcript unavailable | Use video description, note limitation |
| Resource creation fails | Show error, don't delete clipping |

### Twitter/X.com Without Chrome DevTools

Chrome DevTools MCP may not be configured in all sessions. When X/Twitter content can't be fetched:

1. **Parse the URL** to extract username and tweet ID
2. **Check existing clipping content** - it may have partial text already
3. **Ask the user** with clear options:

```
I can't fetch X/Twitter content directly (Chrome DevTools MCP isn't available).

**Tweet by @[username]:** [source URL]

Could you help? Either:
1. **Paste the tweet text** here
2. **Summarize what it's about** from memory
3. **Skip this clipping** and move to the next one

What would you prefer?
```

4. **Proceed normally** once user provides content - the distillation dialogue works the same way

### Voice Memo Processing

Voice memos (`type: transcription`) are handled differently:

1. **Content is already in the note** - no URL fetching needed
2. **Original transcript is KEPT** - it's the source material
3. **New resource is created** with `source_note` linking back
4. **Both notes exist** - transcript for reference, resource for learning

---

## References

Load these as needed:

- **Enrichment strategies**: `./references/enrichment-strategies.md` - Domain-specific content fetching
- **Progressive summarization**: `./references/progressive-summarization.md` - Layer 1-4 dialogue patterns
