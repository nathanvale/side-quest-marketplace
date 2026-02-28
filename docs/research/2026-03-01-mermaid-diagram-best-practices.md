---
created: 2026-03-01
title: "Mermaid Diagram Visual Best Practices"
type: research
tags: [mermaid, diagrams, visualization, print, svg, theming, elk, architecture]
project: cortex
status: draft
---

# Mermaid Diagram Visual Best Practices

Research into creating visually attractive, print-ready Mermaid diagrams. Compiled from official docs, community sources, and the newsroom beat report (2024-2026).

## The Power Combo (2025 Community Consensus)

Three settings for polished diagrams:

1. **`look: neo`** -- modern, clean lines with rounded corners (new default since v11)
2. **`theme: base`** -- the ONLY theme that supports deep color customization via themeVariables
3. **`layout: elk`** -- deterministic, compact, handles nested subgraphs well. Replaces dagre which is unpredictable on 15+ node diagrams

## Complete YAML Frontmatter Config

```yaml
---
config:
  look: neo
  theme: base
  layout: elk
  elk:
    mergeEdges: true
    nodePlacementStrategy: BRANDES_KOEPF
    considerModelOrder: true
  flowchart:
    useMaxWidth: false
    htmlLabels: true
    curve: basis
    nodeSpacing: 60
    rankSpacing: 60
    diagramPadding: 20
  themeVariables:
    # Core colors
    primaryColor: "#dbeafe"
    primaryBorderColor: "#1e40af"
    primaryTextColor: "#0f172a"
    secondaryColor: "#f0fdf4"
    secondaryBorderColor: "#166534"
    tertiaryColor: "#fef3c7"
    tertiaryBorderColor: "#92400e"
    # Lines and text
    lineColor: "#334155"
    textColor: "#0f172a"
    # Flowchart
    clusterBkg: "#f8fafc"
    clusterBorder: "#475569"
    edgeLabelBackground: "#ffffff"
    nodeTextColor: "#0f172a"
    # Typography
    fontFamily: "Inter, Helvetica, Arial, sans-serif"
    fontSize: "16px"
---
```

## Theming Rules

- **Only `theme: base` supports full customization.** Other themes (default, neutral, forest, dark) have limited overrides.
- **Hex colors only** in themeVariables -- named colors like `red` are silently ignored.
- **`primaryBorderColor` is auto-derived** from `primaryColor` -- let Mermaid calculate it rather than overriding manually.
- GitHub's Mermaid renderer ignores font family/size customization. `mmdc` CLI respects them (uses Puppeteer with system fonts).

## Layout Engines

### Dagre (Default)

- Hierarchical/layered layout
- Fast, works for simple to medium diagrams
- Unpredictable on large diagrams -- "tiny changes can radically change the whole layout" (Korny, 2025)

### ELK (Eclipse Layout Kernel)

- Much better for complex architecture diagrams with subgraphs
- More sophisticated edge routing, less overlap
- Deterministic -- same input always produces same output
- Supports flowcharts and state diagrams
- Key options: `mergeEdges: true`, `nodePlacementStrategy: BRANDES_KOEPF`
- **Use ELK for anything with 15+ nodes or nested subgraphs**

## Styling Patterns

### classDef (Preferred)

Define once, apply everywhere:

```mermaid
classDef core fill:#dbeafe,stroke:#1e40af,color:#0f172a,stroke-width:2px
classDef skill fill:#f0fdf4,stroke:#166534,color:#0f172a,stroke-width:2px
classDef store fill:#f3e8ff,stroke:#7c3aed,color:#0f172a,stroke-width:2px
classDef ext fill:#fef3c7,stroke:#92400e,color:#0f172a,stroke-width:2px

A[Component]:::core
```

### Subgraph Styling

classDef does NOT apply to subgraphs. Use `style` directive instead:

```
style skills fill:#f0fdf4,stroke:#86efac,stroke-width:1px,stroke-dasharray:5 5,color:#166534
```

### Semantic Color Coding

| Color Family | Hex Fill | Use For |
|-------------|----------|---------|
| Blue | `#dbeafe` / `#1e40af` | Core components |
| Green | `#f0fdf4` / `#166534` | Features/skills |
| Purple | `#f3e8ff` / `#7c3aed` | Data stores |
| Amber | `#fef3c7` / `#92400e` | External systems |
| Slate | `#f8fafc` / `#475569` | Subgraph backgrounds |

## Typography for Print

### Font Recommendations

| Font | Quality | Notes |
|------|---------|-------|
| **Inter** | Excellent | Modern, highly legible, open-source |
| **Helvetica** | Excellent | Classic, universally available on macOS |
| Trebuchet MS (default) | Adequate | Web-safe but less refined |

### Size Minimums for A3 Wall Printing

| Element | Minimum | Recommended |
|---------|---------|-------------|
| Node labels | 14pt | 16pt |
| Edge labels | 12pt | 14pt |
| Subgraph titles | 16pt | 18pt |
| Root/title nodes | 18pt | 20pt |

## mmdc CLI for High-Quality Export

```bash
# SVG - screen viewing
bunx --bun @mermaid-js/mermaid-cli mmdc \
  -i diagram.mmd -o diagram.svg -b white -c config.json

# PDF - print quality at effective 300 DPI
bunx --bun @mermaid-js/mermaid-cli mmdc \
  -i diagram.mmd -o diagram.pdf -b white -c config.json -f -s 2

# With CSS injection for font size bumps
bunx --bun @mermaid-js/mermaid-cli mmdc \
  -i diagram.mmd -o diagram.svg -c config.json -C print-overrides.css
```

### Key Flags

| Flag | Purpose | Print Value |
|------|---------|-------------|
| `-s 2` | Device scale factor | Sharp PDF at 300 DPI |
| `-f` | PDF fit to diagram | Always use for print |
| `-b white` | Background color | White for print |
| `-c config.json` | Mermaid config | `useMaxWidth: false` |
| `-C file.css` | CSS injection | Font size overrides |

**Important:** When using frontmatter config, do NOT pass `-t` on CLI -- it overrides frontmatter theme.

### CSS Injection for Print (print-overrides.css)

```css
.node .label { font-size: 18px !important; }
.edgeLabel { font-size: 14px !important; }
.cluster-label { font-size: 20px !important; font-weight: 600 !important; }
.edge-pattern-solid { stroke-width: 2px !important; }
.flowchart-link { stroke-width: 2px !important; }
.cluster rect { stroke-width: 2px !important; }
```

### config.json

```json
{
  "flowchart": {
    "useMaxWidth": false,
    "htmlLabels": true,
    "curve": "basis",
    "nodeSpacing": 60,
    "rankSpacing": 60,
    "diagramPadding": 20
  }
}
```

## Complexity Thresholds (mermaid-sonar)

[mermaid-sonar](https://github.com/iepathos/mermaid-sonar) -- CLI linter with research-backed thresholds from cognitive load studies.

| Metric | Warning Threshold |
|--------|-------------------|
| Nodes (high-density) | 50 |
| Nodes (low-density) | 100 |
| Edges | 100 |
| Graph density | 0.3 |
| Cyclomatic complexity | 15 |
| Branch width | 8 |

**When to split:** >50 nodes in high-density graph, >8 parallel branches, density >0.3, or diagram doesn't fit A3 at readable font sizes.

## What Makes Diagrams Look Good

### Do

- Consistent color families (3-4 colors from same palette)
- Semantic color coding (blue=core, green=features, etc.)
- Generous spacing (`nodeSpacing: 60`, `rankSpacing: 60`)
- `stroke-width: 2px` (default 1px is too thin for print)
- White/light backgrounds on nodes (prints well, accessible)
- Dashed borders for nested subgraphs (`stroke-dasharray: 5 5`)
- `curve: basis` for smooth, polished edges
- Self-explanatory node IDs (`WEBPORTAL` not `A`)
- Node labels 3-5 words max
- Use `<br/>` for line breaks in labels

### Don't

- Dark fills with light text (wastes ink, hard to read)
- More than 4-5 colors (visual noise)
- Default font sizes for wall printing (too small)
- Inline `style` on every node (use `classDef`)
- Deeply nested subgraphs >3 levels
- Edge labels everywhere (clutter -- use sparingly)

## Mermaid v11 Features

- **Three looks:** neo (modern), handDrawn (sketch via RoughJS), classic (legacy)
- **ELK layout engine** now well-supported
- **FontAwesome icons:** `fa:fa-database Database` in node labels
- **New @{} node shape syntax:** `DB@{shape: cyl, label: "Database"}`
- **Architecture diagram type** (v11.1.0+) -- native architecture diagrams

## Sources

- [Mermaid Theme Configuration](https://mermaid.ai/open-source/config/theming.html)
- [Mermaid Layouts - ELK and Dagre](https://mermaid.ai/open-source/config/layouts.html)
- [Introducing New Looks for Mermaid Diagrams](https://mermaid.ai/docs/blog/posts/mermaid-innovation-introducing-new-looks-for-mermaid-diagrams)
- [Mermaid v11 Release](https://mermaid.ai/docs/blog/posts/mermaid-v11)
- [Making Mermaid Sequence Diagrams Prettier](https://notepad.onghu.com/2024/making-mermaid-sequence-diagrams-prettier-part1/)
- [Gordonby/MermaidTheming](https://github.com/Gordonby/MermaidTheming)
- [Revisiting Mermaid.js (Korny, 2025)](https://blog.korny.info/2025/03/14/mermaid-js-revisited)
- [Mastering Mermaid Flowchart Tips](https://www.kallemarjokorpi.fi/blog/mastering-diagramming-as-code-essential-mermaid-flowchart-tips-and-tricks-2/)
- [mermaid-sonar Linter](https://github.com/iepathos/mermaid-sonar)
- [mermaid-cli GitHub](https://github.com/mermaid-js/mermaid-cli)
- [draw.io Mermaid ELK Support](https://www.drawio.com/blog/mermaid-elk-layout)
