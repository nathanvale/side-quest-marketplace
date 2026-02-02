# Para-Obsidian: The Story Behind the Code

*A deep dive into building an ADHD-friendly knowledge management system*

---

## The Problem We're Actually Solving

Here's the thing about ADHD brains: they're incredible at collecting. We screenshot articles, bookmark videos, record voice memos, save PDFs... and then it all sits there. A digital hoard of "I'll get to this later" that becomes a source of guilt rather than growth.

Para-Obsidian exists because **capture is easy, but processing is hard**. And the gap between "I saved this" and "I learned from this" is where knowledge goes to die.

This project is fundamentally about building a bridge across that gap—one that works *with* how your brain operates rather than fighting against it.

---

## The Architecture: Three Layers of Abstraction

Think of the whole system like a restaurant kitchen:

```
┌─────────────────────────────────────────────────────────────┐
│  REFERENCE SKILLS (The Recipe Books)                        │
│  - para-classifier: "What IS this thing?"                   │
│  - content-sourcing: "How do I get the full content?"       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  WORKER SKILLS (The Line Cooks)                             │
│  - analyze-web: "Here's what this article is about"         │
│  - analyze-voice: "Here's what was said in this recording"  │
│  - analyze-attachment: "Here's what this PDF contains"      │
│  - create-resource: "I'll make the resource note"           │
│  - create-meeting: "I'll make the meeting note"             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR SKILLS (The Head Chef)                        │
│  - triage: "I coordinate the whole kitchen"                 │
│  - daily-review: "I handle end-of-day prep"                 │
└─────────────────────────────────────────────────────────────┘
```

### Why This Separation Matters

**Single Responsibility Principle in Action**

Each worker skill does exactly ONE thing. `analyze-web` doesn't create notes—it returns a proposal. `create-resource` doesn't analyze content—it takes a proposal and makes a note.

This seems like more code, but it's actually less complexity. When something breaks, you know exactly where to look. When you want to reuse functionality, you can grab just the piece you need.

**The Restaurant Analogy Holds Up**

Imagine if your line cook had to also greet customers, take orders, AND wash dishes. Chaos. But if each person has their station, the whole kitchen flows.

The same principle applies here. The triage orchestrator is the expeditor calling orders. The analyzers are prep cooks breaking down ingredients. The creators are plating the final dish.

---

## The Technical Stack (And Why Each Piece)

### Bun (Not Node)

We use Bun as our runtime, and here's why it matters:

1. **Native TypeScript** - No compile step. Write `.ts`, run `.ts`. Cognitive load reduced.
2. **Fast Package Management** - `bun install` is 10-25x faster than npm. Less waiting = less distraction.
3. **Built-in Test Runner** - `bun test` just works. No Jest config files to wrestle with.

For an ADHD developer, every second of waiting is an opportunity for context-switching. Bun respects that.

### MCP (Model Context Protocol)

This is Anthropic's standard for AI-tool communication. Think of it like USB-C for AI:

```typescript
// An MCP tool is defined with a schema
tool("para_create", {
  inputSchema: {
    template: "string",
    title: "string",
    dest: "string",
    args: "object"
  }
})

// Claude calls it like any other function
para_create({ template: "resource", title: "My Note", ... })
```

**Why MCP over raw function calls?**

1. **Discoverability** - Claude can list available tools and understand their parameters
2. **Validation** - Input schemas catch errors before execution
3. **Portability** - Any MCP client can use these tools, not just Claude

### Skills vs Commands vs Hooks

This is confusing at first, so let's break it down:

| Component | When It Runs | What It Does |
|-----------|--------------|--------------|
| **Command** | User types `/para-obsidian:create` | Simple action with clear output |
| **Skill** | Claude loads it for complex tasks | Instructions + context for the AI |
| **Hook** | Automatically on events | Side effects (validation, logging) |

**Skills are the interesting one.** They're not code—they're markdown files that tell Claude how to behave. The `triage` skill is 500+ lines of instructions that turn Claude into an inbox-processing specialist.

---

## The Unified Triage Architecture

This is the crown jewel. Let me walk you through the problem it solves.

### The Context Pollution Problem

Imagine processing 50 inbox items. Each one might have:
- A 10,000 token YouTube transcript
- A 5,000 token article body
- A 2,000 token Twitter thread

If all that content flows through one Claude conversation, you hit 200k tokens and everything slows down. Worse, Claude starts forgetting earlier context.

### The Solution: Isolated Subagents

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         COORDINATOR (Clean Context)                      │
│  Only sees: file paths, proposals, user decisions                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │ Subagent  │   │ Subagent  │   │ Subagent  │
            │ (YouTube) │   │ (Article) │   │ (Twitter) │
            │           │   │           │   │           │
            │ 15k tokens│   │ 8k tokens │   │ 4k tokens │
            └───────────┘   └───────────┘   └───────────┘
```

Each subagent gets fresh 200k context. It:
1. Fetches the full content (enrichment)
2. Analyzes it (classification)
3. Saves the proposal to task metadata
4. Dies (context garbage collected)

The coordinator never sees the transcript. It only sees: "This is a tutorial video about TypeScript, belongs in AI Practice area."

### Crash Resilience: The Task System

Here's a pattern worth remembering: **persist early, persist often**.

```typescript
// Subagent saves its work immediately
TaskUpdate({
  taskId: "triage:123",
  status: "in_progress",
  metadata: {
    proposal: {
      title: "TypeScript 5.5 Features",
      area: "[[🌱 AI Practice]]",
      resourceType: "video"
    }
  }
})
```

If your session crashes at item 23 of 50:
- Items 1-22: proposals saved in task metadata ✓
- Items 23-50: still pending, will be reprocessed

When you run `/triage` again, it detects the existing session and offers to resume. No work lost.

---

## The Rename Decision: distill-* → analyze-*

We renamed three skills:
- `distill-web` → `analyze-web`
- `distill-voice` → `analyze-voice`
- `distill-attachment` → `analyze-attachment`

**Why?** Because "distill" was causing confusion.

There's already a `distill-resource` skill that does **progressive summarization**—taking a resource note through multiple passes to extract deeper insights. That's actual distillation.

The `distill-web` skill was just analyzing raw content and returning a proposal. That's analysis, not distillation. The name was a lie.

**Lesson: Names are API.** When someone reads `distill-web`, they should know what it does without reading the code. If they have to read the code, the name failed.

---

## Voice Memos: The Hardest Problem

Voice memos are the trickiest content type, and understanding why teaches you a lot about AI classification.

### The Ambiguity Problem

Consider this transcription:
> "So we need to figure out the auth flow before the sprint ends. Sarah said she'd look at the JWT approach. I think we should also consider OAuth for the external API..."

Is this:
1. **A meeting** (sprint planning with Sarah)?
2. **An idea** (you thinking out loud about auth)?
3. **A capture** (quick reminder to yourself)?

Without seeing faces or hearing tone, it's genuinely unclear.

### The Solution: Probabilistic Classification

```typescript
// analyze-voice returns a proposal with confidence level
{
  proposed_template: "meeting",
  meeting_type: "planning",
  confidence: "medium",  // Key indicator!
  notes: "Detected multiple speakers discussing sprint work"
}
```

When confidence is low, the triage coordinator can:
1. Ask you to clarify
2. Show multiple interpretation options
3. Default to the safest choice (capture)

**Lesson: Don't pretend certainty you don't have.** It's better to say "I'm 60% sure this is a meeting" than to silently classify it wrong.

### iOS Voice Memos vs VTT Files

Here's a subtle distinction that took a while to get right:

| Source | Typical Content | Default Assumption |
|--------|-----------------|-------------------|
| iOS Voice Memo | Ideas, reminders, thinking out loud | Resource (idea) or Capture |
| Teams/Zoom VTT | Actual meetings with multiple people | Meeting |

When you record a voice memo on your phone, you're usually alone. When you have a VTT file, it's from a video call with others.

The `triage` orchestrator now checks the file extension and adjusts its classification bias accordingly.

---

## Bugs We Hit (And How We Fixed Them)

### Bug #1: The 64-Character Tool Name Limit

**Symptom:** MCP tools failing with cryptic errors.

**Root Cause:** Claude Code auto-prefixes tool names with `mcp__plugin_<plugin>_<server>__`. If you named your tool `mcp__para-obsidian_para-obsidian__para_frontmatter_validate`, the final name would be double-prefixed and exceed 64 characters.

**Fix:** Use short names in source code. `para_fm_validate`, not `para_frontmatter_validate`. Let Claude Code add its prefix.

**Lesson:** Always understand the transformation pipeline. Your code isn't the final artifact—it gets wrapped, prefixed, transformed. Know what happens after you write it.

### Bug #2: Frontmatter vs Content Injection

**Symptom:** Dataview queries not finding resource summaries.

**Root Cause:** We were using `content: { "Summary": "..." }` to inject content into notes. But the resource template uses Dataview to render frontmatter:

```markdown
## Summary
`= this.summary`
```

If `summary` is in frontmatter, Dataview displays it. If it's injected into the body, Dataview can't query it.

**Fix:** ALL data goes in `args` (frontmatter), NEVER in `content`. The template decides how to render it.

```typescript
// Wrong
para_create({
  template: "resource",
  content: { "Summary": "This article explains..." }  // ❌
})

// Right
para_create({
  template: "resource",
  args: { summary: "This article explains..." }  // ✓
})
```

**Lesson:** Understand your downstream consumers. The code that writes data must know how the code that reads data expects it.

### Bug #3: X/Twitter Sequential Constraint (Resolved)

**Symptom:** Twitter enrichment failing randomly.

**Root Cause:** Chrome DevTools (our old tool for scraping Twitter) used a single browser instance. Spawning 5 subagents that all navigate Chrome simultaneously caused state corruption.

**Original Fix:** Process Twitter items sequentially, after all parallel items complete.

**Permanent Fix:** Migrated Twitter enrichment from Chrome DevTools to stateless X-API MCP tools (`x_get_tweet`, `x_get_thread`). These are stateless API calls with no shared browser state, so Twitter items now parallelize freely alongside YouTube and articles. The sequential constraint only remains for Confluence (which still needs Chrome DevTools for authenticated access).

**Lesson:** Not everything can be parallelized. Know your resource constraints and design around them.

---

## Best Practices Embedded in This Codebase

### 1. Progressive Disclosure in Skills

Skills are markdown files, but they're structured like documentation:

```markdown
# Main Workflow
Brief overview of what to do.

## References
Load as needed based on input type or errors:
- [vtt-conversion.md](references/vtt-conversion.md) — Only load for VTT files
- [error-handling.md](references/error-handling.md) — Only load when errors occur
```

Claude doesn't read everything upfront. It loads references when relevant. This keeps context clean and responses focused.

### 2. Frontmatter as Contract

Every note type has required frontmatter fields. These are contracts between producers and consumers:

```yaml
# resource template contract
type: resource          # Required
summary: string         # Required
source: url|wikilink    # Required
resource_type: enum     # Required
areas: wikilink         # Required
distilled: boolean      # Required
```

When you violate the contract, validation fails immediately. No silent corruption.

### 3. The Task System as State Machine

Tasks have three states: `pending` → `in_progress` → `completed`

```
         TaskCreate
              │
              ▼
        ┌─────────┐
        │ pending │
        └────┬────┘
             │ Subagent: TaskUpdate(in_progress)
             ▼
        ┌─────────────┐
        │ in_progress │  ← Proposal saved in metadata
        └──────┬──────┘
               │ Coordinator: para_create, TaskUpdate(completed)
               ▼
        ┌───────────┐
        │ completed │
        └───────────┘
```

State machines make debugging trivial. "What state is it in?" tells you exactly what happened and what should happen next.

### 4. Worker Skills as Pure Functions

Analyzer skills are essentially pure functions:

```
Input: { file, areas, projects }
Output: { proposal }
Side effects: None (besides reading the file)
```

Creator skills have controlled side effects:

```
Input: { proposal }
Output: { success, created_path }
Side effects: Creates file, possibly deletes/archives original
```

Separating analysis (pure) from creation (side effects) makes testing much easier.

---

## How Good Engineers Think

### Start with the Problem, Not the Solution

We didn't start with "let's build a three-tier skill system." We started with "processing 50 inbox items pollutes context and crashes."

The architecture emerged from constraints:
- Context limit → Subagents with isolated context
- Crash risk → Task-based persistence
- Code complexity → Single-responsibility workers

### Make the Implicit Explicit

Voice memo classification was working "most of the time." But "most of the time" is a bug waiting to happen.

We made it explicit:
1. Document the ambiguity (voice memos are hard)
2. Add confidence levels (medium/low flags uncertainty)
3. Handle the edge cases (iOS vs VTT default assumptions)

Now when classification fails, we know why and can improve it.

### Optimize for Change, Not Performance

This codebase isn't optimized for speed. It's optimized for understanding and modification.

Skills are verbose markdown, not terse JSON. Workers have clear boundaries, not clever optimizations. Task metadata is human-readable.

When you come back in 6 months (and you will), you'll thank yourself.

---

## The ADHD-Friendly Design Philosophy

Everything in this project serves one goal: **reduce friction between capture and learning**.

### Batch Processing Over Continuous Monitoring

ADHD brains struggle with interruption. So we don't process items as they arrive. We let them pile up, then batch-process with full focus.

```
Monday-Friday: Capture freely, don't think about it
Saturday: /triage → 50 items → 1 hour → done
```

### Single-Table Review

Instead of reviewing each item individually (context-switch, decision, context-switch, decision...), we show everything in one table:

```
| #  | Title                    | Area       | Type  |
|----|--------------------------|------------|-------|
| 1  | TypeScript 5.5 Features  | AI Practice| video |
| 2  | Pizza Moncur Restaurant  | Home       | ref   |
| 3  | Sprint 42 Planning       | Work       | meet  |

A = accept all, E 2,3 = edit, D = delete, Q = quit
```

One decision: "A" for accept all. 50 items processed. Dopamine hit. Done.

### Resume Capability

If you get distracted mid-triage (it happens), your progress is saved. Run `/triage` again and pick up where you left off.

No "start over from scratch" punishment. The system forgives interruption.

---

## What's Next

This architecture enables some interesting future work:

1. **iOS Shortcut Integration** - Capture voice memo → auto-transcribe → drops in inbox → triage processes it
2. **Smart Scheduling** - Process high-priority items first based on area/project urgency
3. **Learning Verification** - After distillation, quiz yourself on key points
4. **Cross-Note Linking** - Automatically link related resources across the vault

The modular architecture means each of these can be built as new worker skills without touching the core triage logic.

---

## Final Thoughts

Building para-obsidian taught me something important: **the best systems work with human nature, not against it**.

ADHD isn't a bug—it's a different operating system. Para-obsidian is an app designed for that OS. It expects hyperfocus sessions, forgives interruption, celebrates batch processing, and makes the "later" pile less scary.

If you're building tools for yourself, start by observing how you actually work. Not how you wish you worked. Not how productivity gurus say you should work. How you *actually* work.

Then build the bridge from there.

---

*— Built with ADHD, for ADHD, by someone who has 47 browser tabs open right now*
