---
name: visualize-cortex-knowledge
description: Generates Mermaid diagrams from Cortex documents and exports to print-ready SVG/PDF for A3/A2 wall printing. Auto-detects diagram type from source context. Uses @lepion/mcp-server-mermaid MCP tools. Use when the user wants to visualize, diagram, or create a visual summary of knowledge.
allowed-tools:
  - Bash(cortex *:*)
  - Read
  - Glob
  - Grep
  - Write
  - Task
---

# Visualize Skill

You generate Mermaid diagrams from Cortex documents and export them as print-ready SVG/PDF. Diagrams are living visual summaries that evolve alongside the knowledge base -- not throwaway artifacts.

## Workflow

### 1. Determine context

Resolve the source document:

1. If invoked with a path/filename argument (`$ARGUMENTS`), use that
2. If no argument, check the conversation for the most recently created cortex doc
3. If still nothing, ask the user what to visualize

Read the source document to understand its content and type.

### 2. Confirm and auto-detect type

Auto-detect the diagram type from the source doc's `type` frontmatter field:

| Source Type | Default Diagram | Rationale |
|-------------|----------------|-----------|
| `brainstorm` | Mind map | Shows how topics and approaches connect |
| `research` | Mind map | Visualizes findings and relationships |
| `plan` | Architecture (C4) | Shows system structure |
| `decision` | Flowchart | Shows decision flow and consequences |
| Standalone / unknown | Ask user | No signal to auto-detect |

Confirm with the user before generating:

> "I'll generate a **[type]** diagram for **[title]**. Continue? (Y/n, or specify a different type)"

### 3. Generate Mermaid

**Check MCP availability first.** If `@lepion/mcp-server-mermaid` tools are not available, show:

> "The visualize skill requires the @lepion/mcp-server-mermaid MCP server. Install it in your Claude Code MCP settings to enable diagram generation."

In degraded mode (no MCP), generate the Mermaid source manually and save it -- the user can render it later.

**MCP tool selection:**

| MCP Tool | When to use |
|----------|------------|
| `create_workflow_diagram` | Text-based docs: brainstorms, research, plans, standalone descriptions |
| `generate_diagram_from_code` | Source references specific codebase files AND diagram type is architecture |

Reference [diagram-templates.md](references/diagram-templates.md) for Mermaid syntax patterns per diagram type.

### 4. Validate

Run `validate_diagram_syntax` on the generated Mermaid.

**On failure:**
1. Retry generation once with a modified prompt
2. If still invalid, save the Mermaid source with `status: invalid` in frontmatter
3. Report the validation error to the user

### 5. Optionally improve

For complex diagrams (more than ~10 nodes), run `suggest_diagram_improvements` to refine layout and clarity. Skip for simple diagrams.

### 6. Export

Run `export_diagram_formats` to produce SVG + PDF.

Reference [print-guide.md](references/print-guide.md) for theme and sizing guidance.

**Fallback chain:**
1. SVG + PDF both succeed -- save both
2. PDF fails -- save SVG only, report the issue
3. Both fail -- save Mermaid source only, report the issue

Always report what succeeded and what failed.

### 7. Save

Save all outputs to `docs/diagrams/`:

```
docs/diagrams/
  YYYY-MM-DD-<topic>.md    # Mermaid source with frontmatter
  YYYY-MM-DD-<topic>.svg   # Screen viewing
  YYYY-MM-DD-<topic>.pdf   # A3/A2 printing
```

If a file with the same name exists, ask the user: overwrite or create a versioned copy (`-v2`, `-v3`).

Delegate to the **cortex-frontmatter** skill for correct doc structure. Use the `diagram` doc type with `source` field linking back to the origin document.

### 8. Confirm

Tell the user:
- File paths for all saved outputs (source, SVG, PDF)
- Suggest printing: "Print the PDF at A3 or A2 for your wall."

## Example Frontmatter

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

## Key Principles

- **Visual context is instant** -- diagrams on the wall mean zero cognitive ramp-up
- **Knowledge compounds** -- diagrams evolve alongside research and brainstorms
- **Graceful degradation** -- always save the Mermaid source, even if export fails
- **Confirm before generating** -- ask the user, don't assume the diagram type
- **Follow cortex patterns** -- delegate to cortex-frontmatter for doc structure
