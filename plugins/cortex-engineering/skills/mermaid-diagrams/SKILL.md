---
name: mermaid-diagrams
description: Expert knowledge for creating print-ready Mermaid diagrams -- syntax, styling, theming, and print optimization. Use when generating or reviewing any Mermaid diagram.
user-invocable: false
---

# Mermaid Diagrams

Background knowledge for producing clean, readable, print-ready Mermaid diagrams. This skill provides the craft -- the **visualize** skill provides the workflow.

**Curated visual identity:** All diagrams use one of three preset configs. Each preset pairs a theme, look mode, and layout engine. See [default-theme.md](references/default-theme.md) for the full specification.

## Quick Start

Minimal correct diagram (Classic preset, the default):

```
flowchart LR
    classDef primary fill:#0072B2,color:#fff,stroke:#005a8c,stroke-width:2px
    classDef success fill:#009E73,color:#fff,stroke:#006B4F,stroke-width:2px
    classDef warning fill:#E69F00,color:#000,stroke:#B37A00,stroke-width:2px

    A[Input]:::primary --> B{Valid?}:::warning
    B -->|Yes| C[Process]:::primary
    B -->|No| D[Error]:::warning
    C --> E[Done]:::success
```

Export with Classic preset (default):

```bash
bunx @mermaid-js/mermaid-cli -i input.mmd -o output.svg \
  -c "$CLAUDE_PLUGIN_ROOT/skills/mermaid-diagrams/references/default-theme.json" \
  -b white
```

## Core Principles

Non-negotiable rules for every diagram:

1. **Max 15 nodes** per diagram. Split into multiple diagrams if larger.
2. **Max 3 shapes** per diagram. More shapes become visual noise.
3. **Use `classDef`, not inline styles.** Keeps diagrams consistent and maintainable.
4. **Use a preset config via `-c` flag** for all visualize-skill output. Never put `%%{init:}%%` directives in generated diagrams -- the config file handles theming. Three presets: `default-theme.json` (Classic), `sketch-theme.json` (Sketch), `blueprint-theme.json` (Blueprint).

## Diagram Type Selection

Pick the right diagram for the job. Default to the simplest type that communicates the idea.

| Diagram | Keyword | Best for |
|---------|---------|----------|
| Flowchart | `flowchart TD` | Processes, workflows, decision trees |
| Sequence | `sequenceDiagram` | Interactions between components/actors over time |
| Mind map | `mindmap` | Brainstorms, topic exploration, hierarchical ideas |
| Class | `classDiagram` | Object models, type hierarchies, interfaces |
| State | `stateDiagram-v2` | Lifecycles, state machines, status transitions |
| ER | `erDiagram` | Data models, database schemas, entity relationships |
| Gantt | `gantt` | Timelines, project schedules, phased plans |
| Pie | `pie` | Proportions, distributions, simple breakdowns |
| Timeline | `timeline` | Chronological events, history, roadmaps |
| Architecture | `architecture-beta` | System components and their connections |
| Block | `block-beta` | Generic block diagrams, layout-driven visuals |
| Quadrant | `quadrantChart` | 2x2 matrices, priority/effort grids |
| Sankey | `sankey-beta` | Flow volumes, resource distribution |
| XY chart | `xychart-beta` | Line/bar charts with axes |
| Treemap | `treemap-beta` | Hierarchical data as nested rectangles |
| Kanban | `kanban` | Board-style task tracking |
| Packet | `packet-beta` | Network packet structures |
| Requirement | `requirementDiagram` | Requirements traceability |
| Radar | `radar-beta` | Multi-axis comparison (v11.6.0+) |
| Git graph | `gitGraph` | Branch/commit visualization |
| C4 Context | `C4Context` | System context (C4 model) |

**Decision heuristic:** If you're unsure, start with `flowchart TD`. It handles 70% of use cases. Upgrade to a specialized type only when the data demands it.

## Core Styling Principles

### 1. Readability first

- Max 15 nodes per diagram. Split into multiple diagrams if larger.
- Max 3-5 main branches for mind maps.
- Keep node labels under 30 characters. Use abbreviations + a legend if needed.
- Prefer `<br/>` over backtick markdown-string syntax for line breaks -- backtick labels cause dagre layout cramping with 10+ nodes.
- Max 2 lines per node label. Move detail to edge labels, legends, or index.md.
- One concept per node. Never combine two ideas.

### 2. Direction matters

| Direction | Code | When to use |
|-----------|------|-------------|
| Top-down | `TD` or `TB` | Hierarchies, org charts, inheritance |
| Left-right | `LR` | Pipelines, sequences, timelines |
| Right-left | `RL` | Reverse flows, rollback processes |
| Bottom-up | `BT` | Dependency trees (leaf to root) |

### 3. Grouping with subgraphs

Use `subgraph` to visually cluster related nodes. Label every subgraph. Keep nesting to 2 levels max -- deeper nesting kills readability at print scale.

```
subgraph "API Layer"
    A[REST Controller] --> B[Service]
    B --> C[Repository]
end
```

### 4. Edge labels

Label every edge that isn't self-explanatory. Use `-->|label|` syntax. Keep labels to 1-3 words.

## Theme Configuration

### Init directive

Place at the top of any diagram to configure theme and variables:

```
%%{init: {'theme': 'neutral'}}%%
flowchart TD
    A --> B
```

### Built-in themes

| Theme | Use for |
|-------|---------|
| `base` | **Default choice.** Blank slate with custom `themeVariables`. Used by `default-theme.json`. |
| `neutral` | Black on white, high contrast, no colored fills. Good for B&W printing. |
| `default` | Screen viewing. Mermaid's standard blue palette |
| `dark` | Dark backgrounds. Inverted colors |
| `forest` | Green palette. Good for environmental/organic topics |

**Use `base` with `default-theme.json` for all visualize skill output.** The `neutral` theme silently ignores `themeVariables` (GitHub #4264), so `base` is the only option for custom palettes.

### Custom theme variables

Override specific colors via `themeVariables` in the init directive:

```
%%{init: {'theme': 'base', 'themeVariables': {
    'primaryColor': '#4a90d9',
    'primaryTextColor': '#ffffff',
    'primaryBorderColor': '#2c5f8a',
    'lineColor': '#333333',
    'secondaryColor': '#f0f4f8',
    'tertiaryColor': '#e8e8e8',
    'fontSize': '16px'
}}}%%
```

**Important:** Mermaid only recognizes hex colors (`#4a90d9`), not color names (`blue`).

## Node Shapes

Flowcharts support many shapes. Use them semantically:

| Shape | Syntax | Semantic meaning |
|-------|--------|-----------------|
| Rectangle | `[text]` | Process, action, step |
| Rounded | `(text)` | Start/end, terminal |
| Stadium | `([text])` | Start/end (alternative) |
| Diamond | `{text}` | Decision, condition |
| Hexagon | `{{text}}` | Preparation, setup |
| Circle | `((text))` | Connector, junction |
| Cylinder | `[(text)]` | Database, data store |
| Parallelogram | `[/text/]` | Input/output |
| Subroutine | `[[text]]` | Predefined process, function call |
| Trapezoid | `[/text\]` | Manual operation |
| Double circle | `(((text)))` | Double-click event, emphasis |

**Rule of thumb:** Use max 3 different shapes per diagram. More than that and the visual language becomes noise.

## Print-Safe Color Palette

When color is needed on print diagrams, use this accessible palette. Based on the Wong palette (Nature Methods, 2011) -- the standard for colorblind-safe scientific visualization. All colors maintain WCAG AA contrast against white.

| Role | Hex | classDef name | Usage |
|------|-----|--------------|-------|
| Primary | `#0072B2` | `primary` | Main nodes, primary flow |
| Info | `#56B4E9` | `info` | Information, notes |
| Success | `#009E73` | `success` | Success states, completed |
| Warning | `#E69F00` | `warning` | Warnings, decision points (dark text) |
| Danger | `#D55E00` | `danger` | Error states, failures |
| Highlight | `#F0E442` | `highlight` | Emphasis, callouts |
| Accent | `#CC79A7` | `accent` | Tertiary accent |

The full classDef block is in [default-theme.md](references/default-theme.md). Apply with `:::`:

```
classDef primary fill:#0072B2,color:#fff,stroke:#005a8c
classDef secondary fill:#009E73,color:#fff,stroke:#007a5a
classDef accent fill:#E69F00,color:#000,stroke:#b87d00

A[Start]:::primary --> B{Check}:::accent
B -->|Pass| C[Done]:::secondary
```

## Font Sizing for Print

These minimums ensure readability at 1-2 meters viewing distance on A3/A2 paper:

| Element | Minimum |
|---------|---------|
| Node labels | 14pt |
| Edge labels | 12pt |
| Subgraph titles | 16pt |
| Root/title nodes | 18pt |

Set via init directive:

```
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '16px'}}}%%
```

## Export with mmdc CLI

The `@mermaid-js/mermaid-cli` (`mmdc`) is the primary export path. Use with `-c <preset>-theme.json` for the curated visual identity. The MCP server's `export_diagram_formats` produces placeholder files -- do not use it for export.

### Basic export

```bash
bunx @mermaid-js/mermaid-cli -i input.mmd -o output.svg \
  -c "$CLAUDE_PLUGIN_ROOT/skills/mermaid-diagrams/references/default-theme.json" \
  -b white
```

### Key flags

| Flag | Purpose | Default |
|------|---------|---------|
| `-i` | Input file | (required) |
| `-o` | Output file (.svg, .pdf, .png) | (required) |
| `-t` | Theme | `default` |
| `-b` | Background color | `white` |
| `-w` | Width in pixels | `800` |
| `-H` | Height in pixels | auto |
| `--scale` | Scale factor | `1` |
| `-c` | Config JSON file | none |

### Print-ready export

```bash
# A4 landscape SVG (default)
bunx @mermaid-js/mermaid-cli -i input.mmd -o diagram.svg \
  -c "$CLAUDE_PLUGIN_ROOT/skills/mermaid-diagrams/references/default-theme.json" \
  -b white -w 3508 -H 2480

# A3 landscape SVG (wall poster)
bunx @mermaid-js/mermaid-cli -i input.mmd -o diagram.svg \
  -c "$CLAUDE_PLUGIN_ROOT/skills/mermaid-diagrams/references/default-theme.json" \
  -b white -w 4961 -H 3508

# PDF for direct printing (add --pdfFit)
bunx @mermaid-js/mermaid-cli -i input.mmd -o diagram.pdf \
  -c "$CLAUDE_PLUGIN_ROOT/skills/mermaid-diagrams/references/default-theme.json" \
  -b white -w 3508 -H 2480 --pdfFit
```

A4 landscape = 3508 x 2480px at 300 DPI. A3 landscape = 4961 x 3508px.

## Quality Checklist

Verify before finalizing any diagram:

- [ ] Max 15 nodes
- [ ] Labels under 30 characters
- [ ] Node labels max 2 lines, using `<br/>` (not backtick syntax)
- [ ] Max 3 different shapes
- [ ] All non-obvious edges labeled
- [ ] Subgraph nesting max 2 levels
- [ ] Font size >= 14pt for nodes
- [ ] Color + shape together (not color alone)
- [ ] No `%%{init:}%%` in visualize-skill output

## Anti-Patterns

| Don't | Do instead |
|-------|------------|
| 20+ nodes in one diagram | Split into 2-3 focused diagrams |
| Crossing edges everywhere | Restructure node order to minimize crossings |
| Rainbow colors | Max 3-4 colors with semantic meaning |
| Tiny text with `fontSize: '10px'` | Minimum 14pt for nodes, 12pt for edges |
| Unlabeled edges | Label every non-obvious connection |
| Deep subgraph nesting (3+) | Flatten to max 2 levels |
| Color as only differentiator | Combine color with shape or label prefix |
| `default` theme for print | Use `neutral` -- saves ink, better contrast |
| Inline styles on every node | Use `classDef` for consistent, reusable styles |
| Giant node labels | 30 chars max, use abbreviations + legend |
| Backtick markdown-string labels | `<br/>` for line breaks (dagre calculates width correctly) |

## Done When

The diagram is complete when every item in the Quality Checklist above passes and the exported file (SVG/PDF/PNG) renders correctly at the target paper size.

## Reference Files

For comprehensive details, see:
- [default-theme.md](references/default-theme.md) - Curated visual identity, preset classDef blocks, type detection, export commands
- [default-theme.json](references/default-theme.json) - Classic preset config (pass via `-c`)
- [sketch-theme.json](references/sketch-theme.json) - Sketch preset config (hand-drawn, warm tones)
- [blueprint-theme.json](references/blueprint-theme.json) - Blueprint preset config (monochrome, ELK layout)
- [syntax-reference.md](references/syntax-reference.md) - Full syntax for all diagram types
- [styling-patterns.md](references/styling-patterns.md) - Themes, classDef, custom variables
- [print-optimization.md](references/print-optimization.md) - Paper sizes, mmdc CLI, export recipes
- [config-engineering.md](references/config-engineering.md) - Config tuning, layout workarounds, known Mermaid bugs
