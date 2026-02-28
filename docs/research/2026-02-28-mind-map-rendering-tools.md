---
created: 2026-02-28
title: "Beautiful Mind Map Rendering Tools"
type: research
tags: [mermaid, markmap, mind-map, pdf-export, visualisation, plantuml, graphviz]
project: side-quest-marketplace
status: draft
---

## Summary

Researched programmatic tools for rendering beautiful mind maps from AI-generated content, with export to SVG + PDF for A3 wall printing. Mermaid's mindmap type is fundamentally limited in visual quality. Markmap is the clear winner for mind maps specifically, while Mermaid remains the best choice for flowcharts, sequences, and architecture diagrams.

## Key Findings

- **Mermaid mindmaps are visually limited by design** -- no per-branch colouring (open issue #5156, 36 upvotes, unimplemented), no individual node styling, still marked "experimental." The plain output is a renderer limitation, not a configuration gap.
- **Markmap produces the most beautiful mind maps** -- curved Bezier branch connectors, automatic colour differentiation per branch, clean modern aesthetic. Input is standard markdown headings, the simplest format for an AI to generate.
- **Markmap CLI only outputs HTML natively** -- SVG/PDF export requires Puppeteer. A Markmap MCP server (`@isdmx/markmap-mcp-server`) exists that handles SVG/PNG/JPG export. Community tool `md2mm-svg` wraps markmap + Puppeteer for SVG.
- **PlantUML has the best styling control** -- CSS-like selectors, depth-based styling, per-branch colours. But requires Java runtime and looks "technical documentation" rather than beautiful.
- **The MCP Mermaid server (`@lepion/mcp-server-mermaid`) export tool writes placeholder files** -- it doesn't await Mermaid's async render before firing Puppeteer's `page.pdf()`. Use `mmdc` CLI directly instead.
- **`mmdc` (Mermaid CLI) v11.12.0** is the standard stack for Mermaid export. Uses Puppeteer/Chromium under the hood. SVG and PDF are native output formats.
- **For PDF quality tuning**, use `deviceScaleFactor: 2` for crisper output and CSS variables (`--mermaid-bg-color`, `--mermaid-edge-color`) for colour customisation.

## Details

### Mermaid Mindmap Limitations

The `mindmap` diagram type supports theme variables (`primaryColor`, `secondaryColor`, `tertiaryColor`) via the `base` theme, node shapes (`(( ))` circle, `( )` rounded, `[ ]` square, `{{ }}` hexagon), and Font Awesome icons. However:

- `cScale0` through `cScale11` variables (used in pie/journey charts) do NOT apply to mindmaps
- No CSS class support on mindmap nodes (unlike flowcharts where `style A fill:#f00` works)
- No gradients, shadows, or curved branch styles
- No layout control (branch direction, spacing, side placement)

### Markmap -- The Recommended Alternative

Input is standard markdown:

```markdown
# Cortex
## Architecture
### Two-Layer Structure
- Shared/Global ~/cortex/docs
- Project ~/code/project/docs
### No Database
- In-memory index
## Three Interfaces
### MCP Server
### CLI
### Skills
```

Export pipeline options:

| Method | Output | Notes |
|--------|--------|-------|
| `markmap-cli` | HTML | Native, interactive (zoom/pan/collapse) |
| `@isdmx/markmap-mcp-server` | SVG, PNG, JPG | MCP server for Claude Code |
| `md2mm-svg` | SVG | Markmap + Puppeteer wrapper |
| Custom Puppeteer script | PDF | `page.pdf({ format: 'A3', landscape: true, printBackground: true })` |

### PlantUML Mind Maps

Supports CSS-like depth-based styling:

```plantuml
<style>
mindmapDiagram {
  :depth(1) { BackgroundColor YellowGreen }
  :depth(2) { BackgroundColor Thistle }
}
</style>
```

Fully headless CLI (`java -jar plantuml.jar -tsvg input.puml`), native SVG/PDF/PNG/EPS output. Main downside: Java dependency and "technical documentation" aesthetic.

### Graphviz

Powerful but verbose DOT language. Best layout engines for mind maps: `twopi` (radial) and `dot` (hierarchical). Has a WASM port (`@hpcc-js/wasm-graphviz`) for zero native deps. Fastest of all options but requires significant manual effort to make beautiful.

### Comparative Matrix

| Tool | Visual Beauty | Headless CLI | SVG | PDF | Input Format | Dependencies |
|------|-------------|-------------|-----|-----|-------------|-------------|
| Mermaid | Plain | Yes (mmdc) | Yes | Yes | Custom DSL | Node.js + Puppeteer |
| Markmap | Excellent | Partial | Via workaround | Via workaround | Markdown | Node.js + Puppeteer |
| PlantUML | Good | Yes (native) | Yes | Yes | PlantUML DSL | Java |
| Graphviz | Fair | Yes (native) | Yes | Yes | DOT language | C binary or WASM |

### Recommended Tool Split

| Diagram Type | Tool | Why |
|---|---|---|
| Mind maps | Markmap | Beautiful output, markdown input, auto-colours per branch |
| Flowcharts | Mermaid | Mature, well-styled, good edge labels |
| Sequence diagrams | Mermaid | Best-in-class for interaction diagrams |
| Architecture (C4) | Mermaid | Subgraph support, good for component layouts |

### Community Context (from newsroom research)

- SVG is the preferred format for living documentation; PDF is for archival/sharing/printing
- LLM-generated Mermaid commonly needs human review for layout density and syntax errors
- Race conditions in Puppeteer-based PDF export are a known class of bugs -- always await Mermaid render completion before `page.pdf()`
- `veelenga/claude-mermaid` is a more mature MCP server alternative (SVG live preview, static PDF export)

## Sources

- [Mermaid mindmap syntax](https://mermaid.js.org/syntax/mindmap.html) -- still marked experimental
- [Mermaid per-branch colouring issue #5156](https://github.com/mermaid-js/mermaid/issues/5156) -- 36 upvotes, unimplemented
- [Mermaid theme configuration](https://mermaid.js.org/config/theming.html) -- themeVariables docs
- [Markmap website](https://markmap.js.org/) -- markdown to mind map
- [Markmap SVG export issue #66](https://github.com/markmap/markmap/issues/66) -- open since 2021
- [Markmap MCP server (isdmx)](https://github.com/isdmx/markmap-mcp-server) -- SVG/PNG/JPG export
- [md2mm-svg](https://github.com/googol4u/md2mm-svg) -- markmap + Puppeteer SVG export
- [PlantUML mindmap syntax](https://plantuml.com/mindmap-diagram) -- CSS-like styling
- [mermaid-js/mermaid-cli](https://github.com/mermaid-js/mermaid-cli) -- mmdc v11.12.0, 4.2k stars
- [SysReptor PDF race condition #439](https://github.com/Syslifters/sysreptor/issues/439) -- Mermaid render timing bug
- [veelenga/claude-mermaid](https://github.com/veelenga/claude-mermaid) -- alternative MCP server
- [Customising Mermaid fonts and colours](https://dev.to/leonards/customising-mermaid-diagram-font-and-colors-4pm9) -- CSS variable reference
- [Automate diagrams with LLMs + CI/CD](https://cosmo-edge.com/automate-technical-diagrams-llm-mermaid-plantuml-cicd/) -- community workflows

## Open Questions

- Should the visualize skill auto-detect "mind map" requests and route to Markmap instead of Mermaid?
- Is the Markmap MCP server (`@isdmx/markmap-mcp-server`) stable enough for production use?
- For PDF export from Markmap, is a custom Puppeteer script needed or can we reuse `mmdc`-style tooling?
- Should we support both Mermaid mindmaps (for quick/simple) and Markmap (for beautiful/print)?
