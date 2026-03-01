# Print Optimization

How to produce Mermaid diagrams that look sharp on A3/A2 paper, viewed from 1-2 meters on a wall.

## Paper Sizes

| Size | Dimensions | Pixels at 300 DPI | Best for |
|------|-----------|-------------------|----------|
| A3 portrait | 297 x 420mm | 3508 x 4961 | Vertical hierarchies, org charts |
| A3 landscape | 420 x 297mm | 4961 x 3508 | Flowcharts, pipelines, sequences |
| A2 portrait | 420 x 594mm | 4961 x 7016 | Complex systems, 15+ nodes |
| A2 landscape | 594 x 420mm | 7016 x 4961 | Wide architectures, timelines |

**Default to A4 landscape.** Use A3 for wall posters. Use A2 only when A3 forces text below 14pt.

## Orientation Guide

| Diagram type | Orientation | Direction |
|-------------|-------------|-----------|
| Flowchart (process) | Landscape | `LR` |
| Flowchart (hierarchy) | Portrait | `TD` |
| Sequence diagram | Landscape | N/A (always horizontal) |
| Mind map | Landscape | N/A (auto-layout) |
| Architecture | Landscape | `LR` or `TB` |
| Gantt chart | Landscape | N/A (always horizontal) |
| State diagram | Either | Depends on state count |
| ER diagram | Landscape | N/A (auto-layout) |

## Font Sizing

Minimums for wall viewing at 1-2 meters:

| Element | Minimum | Recommended | Too small |
|---------|---------|-------------|-----------|
| Node labels | 14pt | 16pt | Below 12pt |
| Edge labels | 12pt | 14pt | Below 10pt |
| Subgraph titles | 16pt | 18pt | Below 14pt |
| Root/title nodes | 18pt | 20pt | Below 16pt |

Set via init directive:

```
%%{init: {'theme': 'neutral', 'themeVariables': {'fontSize': '18px'}}}%%
```

**Tip:** If you're unsure, set `fontSize: '18px'`. It's slightly large on screen but perfect for print.

## mmdc Export Recipes

### Install

```bash
# One-time install (or use bunx for zero-install)
bun add -g @mermaid-js/mermaid-cli
```

### A4 landscape SVG (default)

```bash
bunx --bun @mermaid-js/mermaid-cli mmdc \
  -i diagram.mmd \
  -o diagram.svg \
  -c "$CLAUDE_PLUGIN_ROOT/skills/mermaid-diagrams/references/default-theme.json" \
  -b white \
  -w 3508 \
  -H 2480
```

### A3 landscape SVG (wall poster)

```bash
bunx --bun @mermaid-js/mermaid-cli mmdc \
  -i diagram.mmd \
  -o diagram.svg \
  -c "$CLAUDE_PLUGIN_ROOT/skills/mermaid-diagrams/references/default-theme.json" \
  -b white \
  -w 4961 \
  -H 3508
```

### PDF (for direct printing)

```bash
bunx --bun @mermaid-js/mermaid-cli mmdc \
  -i diagram.mmd \
  -o diagram.pdf \
  -c "$CLAUDE_PLUGIN_ROOT/skills/mermaid-diagrams/references/default-theme.json" \
  -b white \
  -w 3508 \
  -H 2480 \
  --pdfFit
```

`--pdfFit` auto-sizes the PDF page to diagram content. `--scale` only affects PNG -- omit for SVG/PDF.

### A2 portrait SVG (complex diagrams)

```bash
bunx --bun @mermaid-js/mermaid-cli mmdc \
  -i diagram.mmd \
  -o diagram.svg \
  -t neutral \
  -b white \
  -w 4961 \
  -H 7016 \
  --scale 2
```

### High-res PNG (for embedding in documents)

```bash
bunx --bun @mermaid-js/mermaid-cli mmdc \
  -i diagram.mmd \
  -o diagram.png \
  -t neutral \
  -b white \
  -w 1920 \
  --scale 3
```

### With config file

The visualize skill uses [default-theme.json](default-theme.json) for the locked visual identity. Pass it via `-c`:

```bash
bunx --bun @mermaid-js/mermaid-cli mmdc \
  -i diagram.mmd \
  -o diagram.svg \
  -c "$CLAUDE_PLUGIN_ROOT/skills/mermaid-diagrams/references/default-theme.json" \
  -b white \
  -w 3508 \
  -H 2480
```

See [default-theme.md](default-theme.md) for the full config specification.

## mmdc Flag Reference

| Flag | Purpose | Default |
|------|---------|---------|
| `-i` | Input `.mmd` file (or `-` for stdin) | Required |
| `-o` | Output file (`.svg`, `.pdf`, `.png`) | Required |
| `-t` | Theme: `default`, `neutral`, `dark`, `forest` | `default` |
| `-b` | Background color (hex or `transparent`) | `white` |
| `-w` | Width in pixels | `800` |
| `-H` | Height in pixels | auto |
| `--scale` | Resolution multiplier | `1` |
| `-c` | Config JSON file path | none |
| `--pdfFit` | Fit PDF to diagram content | false |
| `-q` | Suppress log output | false |
| `--cssFile` | Custom CSS for additional styling | none |
| `-p` | Puppeteer config file | none |

## Color for Print

### Use neutral theme

The `neutral` theme is purpose-built for printing:
- Black lines on white background
- No colored fills (saves ink)
- Maximum contrast at any size
- Clean, professional appearance

### When you need color

If the diagram requires color differentiation:

1. Use the Wong palette (colorblind-safe):
   - `#0072B2` (blue), `#009E73` (green), `#D55E00` (vermillion), `#E69F00` (orange)
2. Combine color with another differentiator (shape, line style, label prefix)
3. Test in grayscale -- the diagram should still be readable without color
4. Use fills sparingly. Outlined nodes with colored borders print cleaner than filled nodes

### Grayscale palette (B&W printers)

| Use | Background | Border | Text |
|-----|-----------|--------|------|
| Primary node | `#ffffff` | `#333333` | `#000000` |
| Secondary node | `#f0f0f0` | `#666666` | `#000000` |
| Emphasis node | `#d9d9d9` | `#333333` | `#000000` |
| Subgraph bg | `#f7f7f7` | `#cccccc` | `#333333` |

```
classDef primary fill:#fff,color:#000,stroke:#333,stroke-width:2px
classDef secondary fill:#f0f0f0,color:#000,stroke:#666,stroke-width:2px
classDef emphasis fill:#d9d9d9,color:#000,stroke:#333,stroke-width:3px
```

## Node Count Guidelines

| Paper size | Max nodes | Max edges | Max subgraph depth |
|-----------|-----------|-----------|-------------------|
| A3 | 15 | 20 | 2 |
| A2 | 25 | 35 | 2 |

Beyond these limits, split into multiple diagrams with clear linking ("See Diagram 2 for Service Layer detail").

## Printing Tips

- Print at **actual size** (100%), not fit-to-page
- Use **landscape** for flowcharts and sequences
- Use **portrait** for top-down hierarchies
- Mind maps work in either -- choose based on shape
- Laminate if the diagram stays on the wall more than a week
- Always export SVG (scalable, no quality loss) + PDF (convenience for printing)

## MCP Server Warning

The `@lepion/mcp-server-mermaid` `export_diagram_formats` tool produces placeholder/text files instead of real SVG/PDF. **Do not use it for export.** Use `mmdc` CLI as the primary export path.

The MCP server's `validate_diagram_syntax` and `suggest_diagram_improvements` tools work correctly and can be used optionally.
