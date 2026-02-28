---
created: 2026-02-28
title: Visualize Skill - Diagrams for Wall Printing
type: brainstorm
tags: [cortex, mermaid, diagrams, adhd, visual-learning]
project: cortex-plugin
status: draft
---

# Visualize Skill - Diagrams for Wall Printing

## Context

Nathan has ADHD and is a visual learner. Walking into the office and seeing an A3/A2 diagram on the wall instantly re-establishes context -- no cognitive ramp-up. As Agent Cortex grows (research, brainstorms, plans, decisions), each piece of knowledge should have a visual companion that can be printed and pinned.

This is core to the compounding knowledge thesis: the diagrams evolve alongside the knowledge base. They're not throwaway -- they're living visual summaries.

## Questions Explored

1. **What triggers diagram creation?** Both on-demand (`/cortex:visualize`) and auto-suggested at the end of brainstorms/research. Auto-suggest defaults to yes but can be skipped.

2. **What diagram types?** All three depending on context:
   - Architecture (C4/component) -- after building something
   - Mind maps -- after researching, showing how topics connect
   - Flowcharts/sequences -- when explaining workflows or processes

3. **Where do diagrams live?** `docs/diagrams/` in the repo, committed to git. Mermaid source is diffable and versioned. Exported SVG/PDF alongside for printing.

4. **How are they rendered?** The `@lepion/mcp-server-mermaid` MCP server provides 6 tools:
   - `create_workflow_diagram` -- text description to diagram
   - `generate_diagram_from_code` -- code analysis to architecture diagram
   - `validate_diagram_syntax` -- catch errors before export
   - `export_diagram_formats` -- SVG, PNG, PDF, HTML with themes
   - `suggest_diagram_improvements` -- AI-powered refinement
   - `analyze_diagram_structure` -- complexity/optimization insights

## Approaches Considered

### A: Skill + MCP Server (Chosen)

Full pipeline leveraging `@lepion/mcp-server-mermaid`. The skill generates Mermaid, validates, and exports to PDF/SVG for wall printing. Auto-suggests after brainstorms.

### B: Skill Only, No MCP

Mermaid source files only, view in GitHub/VS Code. Manual printing. Rejected because wall printing is non-negotiable.

### C: Hybrid

Write Mermaid now, optional MCP later. Rejected -- the PDF/SVG export is the whole point.

## Key Decisions

- **Approach A (Skill + MCP Server):** The MCP server gives us the rendering pipeline we need for print-ready output.
- **Auto-suggest with default yes:** After brainstorms/research, suggest a diagram with recommended type. One click to skip, zero friction to accept.
- **Three diagram types:** Architecture, mind map, flowchart -- auto-detected from context.
- **Output location:** `docs/diagrams/YYYY-MM-DD-<topic>.md` (Mermaid source) + `.svg`/`.pdf` exports.
- **Custom CLI deferred:** Todo #016 tracks exploring a direct Mermaid API CLI tool to replace MCP dependency long-term.

## Skill Architecture

```
plugins/cortex/
  commands/
    visualize.md              # /cortex:visualize slash command
  skills/
    visualize/
      SKILL.md                # Main skill (always loaded)
      references/
        diagram-templates.md  # Mermaid templates for each type
        print-guide.md        # A3/A2 sizing, theme selection
```

### Workflow

1. **Determine context** -- what was just created? (brainstorm, research, plan, or standalone)
2. **Auto-detect diagram type** -- architecture for code/plans, mind map for research, flowchart for processes
3. **Generate Mermaid** -- using MCP `create_workflow_diagram` or `generate_diagram_from_code`
4. **Validate** -- `validate_diagram_syntax`
5. **Optionally improve** -- `suggest_diagram_improvements` for complex diagrams
6. **Export** -- `export_diagram_formats` to SVG + PDF
7. **Save** -- Mermaid source + exports to `docs/diagrams/`
8. **Confirm** -- show file paths, suggest printing

## Open Questions

- Should diagrams link back to their source doc? (e.g., brainstorm references the diagram, diagram references the brainstorm)
- What Mermaid theme works best for A3 printing? (neutral or default likely -- needs testing)
- Should we add a `diagram` frontmatter field to source docs pointing to their visual companion?

## Next Steps

-> `/workflows:plan` to design the implementation
