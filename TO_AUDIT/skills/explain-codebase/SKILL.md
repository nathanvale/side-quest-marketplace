---
name: explain-codebase
description: Generate an engaging, deep-dive explanation document (FOR_[NAME].md) that explains a codebase or domain in plain language with analogies, lessons learned, and practical wisdom.
user-invocable: true
allowed-tools: Task, Read, Glob, Grep, Write, AskUserQuestion
---

# Explain Codebase

Generate a **FOR_[NAME].md** document that explains a codebase, project, or domain in an engaging, memorable way.

## What Makes This Different

This isn't documentation. Documentation tells you *what* exists. This tells you:
- **Why** decisions were made
- **How** the pieces connect
- **What** you'll wish you knew sooner
- **Where** the dragons live (and how to avoid them)

The output should read like a senior engineer explaining the project over coffee, not like a README.

---

## Input Detection

Check `$ARGUMENTS`:

| Input | Action |
|-------|--------|
| Empty | Analyze current working directory |
| Path | Analyze specified directory |
| `--name <name>` | Use custom name for FOR_[NAME].md |
| `--domain <topic>` | Focus on specific domain/subsystem |
| `--depth shallow|medium|deep` | Control exploration depth (default: medium) |

---

## Phase 1: Gather Context

### 1.1 Ask Initial Questions

Use `AskUserQuestion` to understand scope:

```
What should I focus on?

Options:
1. Full codebase overview (architecture, patterns, lessons)
2. Specific subsystem or feature
3. Recent changes and their rationale
4. Onboarding guide for new contributors
```

### 1.2 Explore the Codebase

Use the Explore agent to understand structure:

```typescript
Task({
  subagent_type: "Explore",
  description: "Map codebase architecture",
  prompt: `
    Explore this codebase and identify:
    1. Main entry points
    2. Core abstractions and patterns
    3. Directory structure philosophy
    4. Key configuration files
    5. Test patterns
    6. External dependencies and why they're used

    Return a structured summary, not raw file listings.
  `
})
```

### 1.3 Find the Interesting Bits

Look for:
- **CLAUDE.md / README.md** - Existing documentation to build on
- **CHANGELOG.md** - History of decisions and pivots
- **package.json / Cargo.toml / etc** - Dependencies tell stories
- **Test files** - Show how things are meant to be used
- **Config files** - Reveal hidden assumptions
- **Comments with "TODO", "HACK", "FIXME"** - Where the bodies are buried

```typescript
Grep({ pattern: "TODO|HACK|FIXME|XXX|NOTE:", output_mode: "content" })
```

---

## Phase 2: Identify the Story

Every codebase has a narrative. Find it.

### 2.1 The Problem Statement

What pain does this code solve? Not the feature list—the actual human frustration it addresses.

**Bad:** "This is a task management CLI"
**Good:** "This exists because every task app assumes you'll check it daily, but ADHD brains don't work that way"

### 2.2 The Key Decisions

What architectural choices were made and why? Look for:
- Why this language/framework?
- Why this folder structure?
- Why these abstractions?
- What was tried and abandoned?

### 2.3 The Lessons Learned

What would someone wish they knew before diving in? This includes:
- Non-obvious gotchas
- Performance cliffs
- Security considerations
- "It looks simple but actually..."

---

## Phase 3: Structure the Document

Use this template structure, adapting sections as needed:

```markdown
# [Project Name]: The Story Behind the Code

*[One-line hook that makes someone want to read more]*

---

## The Problem We're Actually Solving

[Start with the human problem, not the technical solution]

---

## The Architecture: [Memorable Analogy]

[Use an analogy that makes the structure intuitive]
[Include ASCII diagrams where helpful]

### Why This Separation Matters

[Explain the reasoning, not just the structure]

---

## The Technical Stack (And Why Each Piece)

### [Technology 1]

[What it is, why we chose it, what we'd lose without it]

### [Technology 2]

[Same pattern - every tool earns its place]

---

## [Core Feature/System Deep Dive]

[Pick the most interesting/complex part and explain it thoroughly]

### The Problem It Solves

[Specific pain point]

### The Solution

[How it works, with code examples where helpful]

### Why This Approach

[Alternative approaches considered and rejected]

---

## Bugs We Hit (And How We Fixed Them)

### Bug #1: [Descriptive Name]

**Symptom:** [What you saw]
**Root Cause:** [What was actually wrong]
**Fix:** [What we did]
**Lesson:** [What to remember]

[Repeat for significant bugs]

---

## Best Practices Embedded in This Codebase

### 1. [Practice Name]

[Explain the practice and show an example from the code]

[Repeat for 3-5 key practices]

---

## How Good Engineers Think

[Meta-lessons about engineering mindset learned from this project]

---

## What's Next

[Future directions this architecture enables]

---

## Final Thoughts

[Wrap up with the core insight or philosophy]

---

*— [Sign-off that fits the project's personality]*
```

---

## Phase 4: Write with Engagement

### Use These Techniques

**1. Analogies Over Abstractions**

Instead of:
> "The event system uses a pub-sub pattern with topic-based routing"

Write:
> "Think of it like a newspaper. Publishers write articles, subscribers pick which sections they care about. The event bus is the printing press—it doesn't care what's in the message, just where it needs to go."

**2. Show the Evolution**

Instead of:
> "We use worker threads for CPU-intensive tasks"

Write:
> "Version 1 was single-threaded. Then we hit a wall processing 10,000 records—users stared at a frozen screen for 30 seconds. Worker threads turned that into a 3-second background job. The code is uglier, but the UX is worth it."

**3. Honest About Trade-offs**

Instead of:
> "The system is highly scalable"

Write:
> "It scales horizontally, but there's a catch: every new instance needs 2GB RAM for the in-memory cache. At 10 instances, you're paying for 20GB of RAM that's 80% duplicate data. We accept this because cold-start latency matters more than memory cost—for now."

**4. Name the Dragons**

Instead of:
> "Be careful with the date handling code"

Write:
> "The `parseDate()` function looks innocent. It has eaten three afternoons of my life. The issue: it silently coerces invalid dates to the Unix epoch instead of throwing. If you see January 1, 1970 in your output, check your inputs."

---

## Phase 5: Validate and Polish

### 5.1 Check for Completeness

Does the document answer:
- [ ] What does this project do?
- [ ] Why does it exist?
- [ ] How is it structured?
- [ ] What technologies and why?
- [ ] Where are the gotchas?
- [ ] What can I learn from it?

### 5.2 Check for Engagement

Does the document:
- [ ] Have a hook in the first paragraph?
- [ ] Use at least 3 analogies?
- [ ] Include specific examples/code snippets?
- [ ] Tell stories, not just state facts?
- [ ] Have personality (not corporate-speak)?

### 5.3 Write the File

```typescript
Write({
  file_path: "[project_root]/FOR_[NAME].md",
  content: generatedDocument
})
```

---

## Output Calibration

### Depth Levels

**Shallow (5-10 min read):**
- Problem statement
- High-level architecture
- Key technologies
- 2-3 main lessons

**Medium (15-20 min read):**
- All of shallow
- One deep-dive section
- 3-5 bugs/gotchas
- Best practices
- Engineering philosophy

**Deep (30+ min read):**
- All of medium
- Multiple deep-dives
- Comprehensive bug history
- Future roadmap
- Cross-references to related systems

---

## Special Cases

### For Libraries/Packages

Focus on:
- API design decisions
- Usage patterns (show real examples)
- Performance characteristics
- Migration guides if there are breaking versions

### For Infrastructure/DevOps

Focus on:
- Failure modes and recovery
- Scaling characteristics
- Cost implications
- Operational runbooks (in narrative form)

### For Data Systems

Focus on:
- Data flow diagrams
- Consistency guarantees (and where they break)
- Schema evolution strategy
- Query patterns that perform well vs poorly

---

## Example Invocations

```bash
# Full codebase explanation for yourself
/explain-codebase

# Explain a specific subsystem
/explain-codebase --domain "authentication"

# Create onboarding doc for a teammate
/explain-codebase --name "Sarah" --depth deep

# Explain an external project you're learning
/explain-codebase ~/code/some-open-source-project
```

---

## References

Load these as needed for specific domains:

- [writing-techniques.md](references/writing-techniques.md) — Engagement patterns
- [architecture-patterns.md](references/architecture-patterns.md) — Common patterns to recognize
- [analogy-bank.md](references/analogy-bank.md) — Ready-to-use analogies for common concepts
