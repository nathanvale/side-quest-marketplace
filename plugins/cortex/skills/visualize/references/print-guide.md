# Print Guide

Guidance for exporting diagrams at A3/A2 paper sizes for wall printing.

## Paper Sizes

| Size | Dimensions | Best for |
|------|-----------|----------|
| A3 | 297 x 420mm (11.7 x 16.5in) | Single diagrams, focused topics |
| A2 | 420 x 594mm (16.5 x 23.4in) | Complex systems, multi-branch mind maps |

**Default to A3.** Use A2 only when the diagram has 15+ nodes or deeply nested branches.

## Theme

Use the **neutral** Mermaid theme for printing. It provides:
- High contrast black lines on white background
- No colored backgrounds that waste ink
- Clear, readable text at all sizes

When calling `export_diagram_formats`, specify:
- Theme: `neutral`
- Background: `white`

## Font Size Minimums

For readability when printed and viewed from 1-2 meters:

| Element | Minimum size |
|---------|-------------|
| Node labels | 14pt |
| Edge labels | 12pt |
| Subgraph titles | 16pt |
| Root/title nodes | 18pt |

## Export Format

| Format | Use for |
|--------|---------|
| SVG | Screen viewing, scaling without quality loss |
| PDF | Printing -- send directly to printer at actual size |

Always export both. SVG is the source of truth for quality; PDF is for convenience.

## Printing Tips

- Print at **actual size** (100%), not fit-to-page
- Use **landscape** orientation for flowcharts and sequences
- Use **portrait** orientation for top-down architecture diagrams
- Mind maps work well in either orientation -- choose based on shape
- Laminate if the diagram will be on the wall for more than a week
