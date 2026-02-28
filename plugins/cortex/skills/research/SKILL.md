---
name: producing-research-documents
description: Produces structured research documents with YAML frontmatter into the Cortex knowledge system. Checks existing cortex knowledge before going external. Delegates to cortex-frontmatter skill for doc structure. Use when the user asks to research a topic, investigate something, or create a research note.
allowed-tools:
  - Bash(cortex *:*)
  - Read
  - Glob
  - Grep
  - Write
  - WebSearch
  - WebFetch
  - Task
---

# Research Skill

You produce structured research documents for the Cortex knowledge system. Your workflow always checks what's already known before going external.

## Workflow

### 1. Confirm scope

Ask the user to confirm:
- **Topic**: What are we researching?
- **Project context**: Is this for a specific project or global knowledge?
- **Depth**: Quick survey or deep dive?

### 2. Check cortex first (the compounding step)

Before any external research, check what cortex already knows:

```bash
cortex search "<topic>" --json
```

Or grep the docs folders directly:

```bash
grep -rl "<topic>" ~/code/my-agent-cortex/docs/ 2>/dev/null
```

If in a project repo, also check:

```bash
grep -rl "<topic>" ./docs/ 2>/dev/null
```

**If related docs found:**
- Read them and summarize: "I found N existing docs on this topic. Here's what we already know..."
- Use existing knowledge as context for new research
- Note what gaps remain

**If nothing found:**
- Say so briefly: "No existing cortex docs on this topic. Starting fresh."

### 3. Dispatch research

Use available tools based on the topic:

| Need | Tool |
|------|------|
| Community opinions, trends | `/newsroom:investigate` via Skill tool |
| Web content at a specific URL | WebFetch |
| General web search | WebSearch |
| Codebase exploration | Grep, Glob, Read |
| Deep multi-source research | Task tool with beat-reporter agent |

**Build on existing knowledge** -- don't repeat what cortex already has. Focus research on gaps and new angles.

### 4. Synthesize and write

Delegate to the **cortex-frontmatter** skill for correct doc structure:

- Use the `research` doc type
- Fill in all sections: Summary, Key Findings, Details, Sources, Open Questions
- Include proper frontmatter with tags, project, and status

**File location:**
- If in a project repo: `./docs/research/YYYY-MM-DD-<slug>.md`
- If no project context: `~/code/my-agent-cortex/docs/research/YYYY-MM-DD-<slug>.md`

### 5. Confirm

Tell the user:
- Where the doc was saved
- Brief summary of what was found
- Any open questions worth pursuing
- Suggest: "Run `/cortex:brainstorm` if you want to explore approaches based on this research."
- Suggest: "Want a visual summary? Run `/cortex:visualize <saved-path>`"

## Example Frontmatter

```yaml
---
created: 2026-02-27
title: "YAML Frontmatter Best Practices"
type: research
tags: [yaml, frontmatter, markdown, metadata]
project: my-agent-cortex
status: draft
---
```

## Key Principles

- **Cortex first, external second** -- always check existing knowledge before going out
- **Build on what exists** -- reference prior docs, don't duplicate findings
- **Sources are mandatory** -- every external claim needs a source link
- **Open questions drive future research** -- always end with what's still unknown
