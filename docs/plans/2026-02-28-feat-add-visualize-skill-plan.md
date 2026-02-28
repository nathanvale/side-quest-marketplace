---
title: "Add Visualize Skill to Cortex Plugin"
type: plan
status: final
created: 2026-02-28
---

# Add Visualize Skill to Cortex Plugin

## Overview

Add a `visualize` skill to the cortex plugin that generates Mermaid diagrams from brainstorms, research, and plans, then exports them as print-ready SVG/PDF for A3/A2 wall printing. Nathan has ADHD and is a visual learner -- walking into the office and seeing a diagram on the wall instantly re-establishes context with zero cognitive ramp-up.

The skill uses the `@lepion/mcp-server-mermaid` MCP server for rendering and export. It integrates with the existing cortex workflow by auto-suggesting a diagram after brainstorms and research (default yes, one click to skip).

> Origin: `docs/brainstorms/2026-02-28-visualize-skill-brainstorm.md`

## Problem Statement / Motivation

As Agent Cortex grows (research, brainstorms, plans, decisions), each piece of knowledge should have a visual companion that can be printed and pinned to the wall. Currently there is no way to generate diagrams from cortex documents. Without this, knowledge stays text-only and requires reading to re-establish context -- a high cognitive cost for ADHD.

## Proposed Solution

Create a new `visualize` skill following the established cortex skill pattern (SKILL.md + references/ for progressive disclosure). The skill delegates to `@lepion/mcp-server-mermaid` MCP tools for rendering. This is the first skill to use the `references/` subdirectory pattern.

### Skill Architecture

```
plugins/cortex/
  commands/
    visualize.md              # /cortex:visualize slash command
  skills/
    visualize/
      SKILL.md                # Main skill (~2,000 tokens, always loaded)
      references/
        diagram-templates.md  # Mermaid templates for each diagram type
        print-guide.md        # A3/A2 sizing, theme selection
```

### Workflow (8 Steps)

1. **Determine context** -- resolve the source document. If invoked with a path/filename argument, use that. If invoked from auto-suggest, the calling skill passes the saved file path as `$ARGUMENTS`. If no argument, check the conversation for the most recently created cortex doc. If still nothing, ask the user.
2. **Confirm and auto-detect** -- read the source doc, auto-detect the diagram type (see table below), and confirm with the user: "I'll generate a [type] diagram for [title]. Continue? Y/n". The user can override the type here.
3. **Generate Mermaid** -- select MCP tool based on source: `create_workflow_diagram` for text-based docs (brainstorms, research, plans), `generate_diagram_from_code` only when the source references a specific codebase and the type is architecture. Reference `diagram-templates.md` for syntax patterns.
4. **Validate** -- `validate_diagram_syntax`. On failure: retry generation once with a modified prompt. If still invalid, save the Mermaid source with a `status: invalid` frontmatter flag and report the error to the user.
5. **Optionally improve** -- `suggest_diagram_improvements` for complex diagrams (more than ~10 nodes)
6. **Export** -- `export_diagram_formats` to SVG + PDF. Reference `print-guide.md` for theme/sizing. On failure: save SVG-only if PDF fails, save Mermaid source-only if both fail. Always report what succeeded.
7. **Save** -- Mermaid source + exports to `docs/diagrams/`. If a file with the same name exists, ask the user: overwrite or create versioned copy (`-v2`, `-v3`).
8. **Confirm** -- show file paths and suggest printing.

## Technical Considerations

### MCP Server Dependency

The `@lepion/mcp-server-mermaid` MCP server provides 6 tools:

| Tool | Purpose | Used in Step |
|------|---------|-------------|
| `create_workflow_diagram` | Text description to diagram | 3 |
| `generate_diagram_from_code` | Code analysis to architecture diagram | 3 |
| `validate_diagram_syntax` | Catch errors before export | 4 |
| `suggest_diagram_improvements` | AI-powered refinement | 5 |
| `export_diagram_formats` | SVG, PNG, PDF, HTML with themes | 6 |
| `analyze_diagram_structure` | Complexity/optimization insights | 5 (optional) |

The MCP server requires Puppeteer for rendering. Todo #016 tracks exploring a lighter CLI alternative long-term.

**MCP Unavailability:** If the MCP server tools are not available, the skill should detect this early (step 3) and show a clear error: "The visualize skill requires the @lepion/mcp-server-mermaid MCP server. Install it in your Claude Code MCP settings to enable diagram generation." The skill saves the Mermaid source file anyway (degraded mode) so the user's work is not lost.

**MCP Tool Selection Rules:**

| MCP Tool | Source Context | When |
|----------|---------------|------|
| `create_workflow_diagram` | Text-based docs | Brainstorms, research, plans, standalone text descriptions |
| `generate_diagram_from_code` | Code analysis | Source explicitly references codebase files AND diagram type is architecture |

### Progressive Disclosure (First Usage in Repo)

This is the first cortex skill to use the `references/` pattern described in the project CLAUDE.md. The main SKILL.md stays under ~2,000 tokens (always loaded). Reference files are loaded only when specific diagram types or print options are needed:

- `diagram-templates.md` -- loaded when generating diagrams (contains Mermaid syntax templates for architecture, mind map, flowchart)
- `print-guide.md` -- loaded when export/print is requested (A3/A2 sizing, theme recommendations)

### Auto-Suggest Integration

The brainstorm and research skills both end with a "Confirm" step (step 5) that suggests next actions. The plan adds a visualize suggestion to both, **passing the saved file path as the argument** so the visualize skill has explicit context:

- Research step 5: "Want a visual summary? Run `/cortex:visualize <saved-path>`"
- Brainstorm step 5: "Want a diagram of this? Run `/cortex:visualize <saved-path>`"

**"Defaults to yes" means:** Ask a single yes/no question and wait for a response. Do not begin generating until the user confirms. One word ("no" or "skip") to decline.

### Diagram Type Auto-Detection

| Source Document | Default Diagram Type | Rationale |
|----------------|---------------------|-----------|
| Brainstorm | Mind map | Shows how topics and approaches connect |
| Research | Mind map | Visualizes findings and relationships |
| Plan / architecture | Architecture (C4/component) | Shows system structure |
| Process / workflow | Flowchart / sequence | Shows step-by-step flow |
| Standalone (no context) | Ask user | No signal to auto-detect |

### Output Location

All diagrams live in `docs/diagrams/` in the repo:

```
docs/diagrams/
  2026-02-28-visualize-skill-architecture.md    # Mermaid source (diffable, versioned)
  2026-02-28-visualize-skill-architecture.svg   # For screen viewing
  2026-02-28-visualize-skill-architecture.pdf   # For A3/A2 printing
```

The `.md` file contains the Mermaid source wrapped in a code fence, plus frontmatter linking back to the source document.

### Cortex-Frontmatter Extension

Two additions to the cortex-frontmatter skill:

**1. New `diagram` doc type** with section structure:

```markdown
## Source
Link to the brainstorm/research/plan that this diagram visualizes.

## Diagram
The Mermaid source in a fenced code block.

## Export Notes
Theme used, paper size, any rendering notes.
```

Frontmatter for diagram docs:
```yaml
---
created: 2026-02-28
title: "Visualize Skill Architecture"
type: diagram
tags: [architecture, cortex, mermaid]
project: my-agent-cortex
status: draft
source: docs/brainstorms/2026-02-28-visualize-skill-brainstorm.md
---
```

The `source` field links back to the origin document, creating a bidirectional connection.

**2. Optional `diagram` field on all doc types (deferred to post-v1)** -- source documents could reference their visual companion via a `diagram:` frontmatter field. Deferred because it requires the skill to edit source docs (potentially in other repos), adding complexity. For v1, the `source` field on diagram docs provides the link in one direction.

## Acceptance Criteria

- [x] `plugins/cortex/skills/visualize/SKILL.md` created via `/compound-engineering:create-agent-skills` with 8-step workflow, correct frontmatter (`name`, `description`, `allowed-tools`)
- [x] `plugins/cortex/skills/visualize/references/diagram-templates.md` exists with Mermaid templates for architecture, mind map, and flowchart types
- [x] `plugins/cortex/skills/visualize/references/print-guide.md` exists with A3/A2 sizing guidance and theme recommendations
- [x] `plugins/cortex/commands/visualize.md` exists with correct frontmatter (`name`, `description`, `allowed-tools`, `argument-hint`) and delegates to the skill
- [x] `plugins/cortex/.claude-plugin/plugin.json` updated: `skills` array includes `"./skills/visualize"`, `commands` array includes `"./commands/visualize.md"`
- [x] Research skill step 5 updated to suggest `/cortex:visualize`
- [x] Brainstorm skill step 5 updated to suggest `/cortex:visualize`
- [x] Cortex-frontmatter skill updated with `diagram` doc type (section structure + frontmatter), `source` field, and file location mapping
- [x] `docs/diagrams/` directory exists (can be empty with .gitkeep)
- [x] `bun run validate` passes (Biome + tsc + marketplace validation)
- [ ] `/cortex:visualize` slash command works end-to-end: generates Mermaid, validates, exports to SVG + PDF, saves to `docs/diagrams/`

## Implementation Order

### Phase 1: Create Skill via `/compound-engineering:create-agent-skills`

**IMPORTANT:** Use the `/compound-engineering:create-agent-skills` skill to create the visualize skill and command. This skill is the expert authoring tool for Claude Code skills -- it knows the official spec, best practices, templates, and produces properly structured output. Do NOT hand-write SKILL.md files from scratch.

1. **Invoke `/compound-engineering:create-agent-skills`** and select "Create new skill"

   Provide this context so the skill can ask targeted questions:

   - **Skill name:** `visualize-cortex-knowledge`
   - **Purpose:** Generates Mermaid diagrams from Cortex documents and exports to print-ready SVG/PDF for A3/A2 wall printing
   - **Plugin location:** `plugins/cortex/skills/visualize/` (inside the cortex plugin, not a standalone skill)
   - **Complexity:** Complex (has a multi-step workflow + references/ subdirectory)
   - **MCP dependency:** Uses `@lepion/mcp-server-mermaid` (6 tools: `create_workflow_diagram`, `generate_diagram_from_code`, `validate_diagram_syntax`, `suggest_diagram_improvements`, `export_diagram_formats`, `analyze_diagram_structure`)
   - **Workflow:** The 8-step workflow defined in this plan (determine context, confirm/auto-detect type, generate, validate, improve, export, save, confirm)
   - **Auto-detection table:** Brainstorm/research -> mind map, plan/architecture -> C4, process -> flowchart, standalone -> ask user
   - **Error handling:** Validation retry once then save-as-invalid, export fallback (SVG-only then source-only), MCP unavailability detection with clear error message
   - **References needed:** `diagram-templates.md` (Mermaid syntax templates per type), `print-guide.md` (A3/A2 sizing, themes)

   The skill will produce:
   - `plugins/cortex/skills/visualize/SKILL.md` -- properly structured with XML tags, frontmatter, workflow steps
   - `plugins/cortex/skills/visualize/references/diagram-templates.md`
   - `plugins/cortex/skills/visualize/references/print-guide.md`

2. **Invoke `/compound-engineering:create-agent-skills`** again and select "Create new command"

   Provide this context:
   - **Command name:** `visualize`
   - **Plugin:** cortex (the command goes in `plugins/cortex/commands/visualize.md`)
   - **Delegates to:** `visualize-cortex-knowledge` skill
   - **Argument hint:** `"<topic or doc>"`
   - **Allowed tools:** `Bash(cortex *:*), Read, Glob, Grep, Write, Task`

### Phase 2: Registration

3. **Update `plugins/cortex/.claude-plugin/plugin.json`**

   Add to `skills` array:
   ```json
   "./skills/visualize"
   ```

   Add to `commands` array:
   ```json
   "./commands/visualize.md"
   ```

   Bump version `0.1.0` -> `0.2.0` (minor bump -- new user-facing capability).

### Phase 3: Integration

4. **Update research skill step 5** (`plugins/cortex/skills/research/SKILL.md`)

   Add to the Confirm step:
   ```markdown
   - Suggest: "Want a visual summary? Run `/cortex:visualize`"
   ```

5. **Update brainstorm skill step 5** (`plugins/cortex/skills/brainstorm/SKILL.md`)

   Add to the Confirm step:
   ```markdown
   - Suggest: "Want a diagram of this? Run `/cortex:visualize`"
   ```

6. **Update cortex-frontmatter skill** (`plugins/cortex/skills/cortex-frontmatter/SKILL.md`)

   Add `diagram` doc type with section structure (Source, Diagram, Export Notes) and `source` frontmatter field.

   Add `diagram` type mapping to the File Location table:
   ```
   diagram -> docs/diagrams/
   ```

7. **Create `docs/diagrams/.gitkeep`** to establish the output directory

### Phase 4: Validation

8. **Run `bun run validate`** to confirm everything passes
9. **Manual smoke test** -- run `/cortex:visualize` on the brainstorm doc itself to verify the full pipeline

## Verification

- `bun run validate` passes clean
- `plugins/cortex/.claude-plugin/plugin.json` has 4 skills and 4 commands
- Running `/cortex:visualize "visualize skill architecture"` produces:
  - A Mermaid `.md` file in `docs/diagrams/`
  - An `.svg` export alongside it
  - A `.pdf` export alongside it
- Running `/cortex:brainstorm` and completing it shows the visualize suggestion at step 5
- Running `/cortex:research` and completing it shows the visualize suggestion at step 5

## Sources

- **Origin brainstorm:** [docs/brainstorms/2026-02-28-visualize-skill-brainstorm.md](docs/brainstorms/2026-02-28-visualize-skill-brainstorm.md) -- key decisions: Approach A (Skill + MCP Server), auto-suggest with default yes, three diagram types, output to docs/diagrams/
- **Deferred todo:** [todos/016-deferred-p3-custom-mermaid-cli.md](todos/016-deferred-p3-custom-mermaid-cli.md) -- explore custom CLI to replace MCP dependency long-term
- **Existing skill patterns:** `plugins/cortex/skills/research/SKILL.md`, `plugins/cortex/skills/brainstorm/SKILL.md`
- **Progressive disclosure pattern:** `.claude/CLAUDE.md` -- references/ subdirectory for conditional context
- **MCP server:** `@lepion/mcp-server-mermaid` -- 6 tools for Mermaid rendering and export
