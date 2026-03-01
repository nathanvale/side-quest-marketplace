---
name: design-system
description: Design system foundations for visual artifacts -- 8px grid spacing, typography scales, color contrast, border weights, vertical rhythm, and colorblind-safe palettes. Use when creating or modifying diagram theme configs, styling presets, SVG exports, or any visual design decisions. Provides concrete token values that snap to an 8px baseline grid.
user-invocable: false
---

# Design System

Foundational design tokens and rules for visual artifacts -- diagrams, charts, presentations, and print exports. Every spacing, typography, and sizing value snaps to an 8px baseline grid (with 4px half-steps for fine adjustments).

## Core Principles

### The 8px Grid

All spatial values are multiples of 8. Use 4px only for sub-component adjustments (icon gaps, type alignment). This creates visual rhythm, reduces decision fatigue, and ensures pixel-perfect rendering on 1x, 1.5x, 2x, and 3x displays.

```
4 -- 8 -- 16 -- 24 -- 32 -- 48 -- 64 -- 80 -- 96
```

### Contrast First

Every color pairing must meet WCAG AA minimum: 4.5:1 for text, 3:1 for borders and graphical objects. Use the Okabe-Ito palette for colorblind safety.

### Borders Are Not Spacing

Stroke widths use their own 1-3px scale. The 8px grid applies to layout spacing only.

## Spacing Scale

| Token | px | Use |
|---|---|---|
| `xs` | 8 | Icon-to-text gaps, tight internal spacing |
| `sm` | 16 | Node padding, compact element spacing |
| `md` | 24 | Comfortable padding, sub-section spacing |
| `lg` | 32 | Diagram margins, section separation |
| `xl` | 48 | Node spacing (compact layouts) |
| `2xl` | 64 | Node spacing (standard layouts) |
| `3xl` | 80 | Node/rank spacing (spacious layouts) |
| `4xl` | 96 | Page-level spacing |

**When to use 4px:** Only for within-component micro-adjustments -- never for layout spacing between elements.

## Typography Scale

Font sizes can be any value -- only line heights and outer spacing must snap to the grid. Line heights use a 4px sub-grid (like Material Design 3).

| Role | Size | Line Height | Weight | Use |
|---|---|---|---|---|
| Caption | 12px | 16px | 400 | Labels, annotations, footnotes |
| Small | 14px | 20px | 400-500 | Edge labels, secondary text |
| Base | 16px | 24px | 400 | Node text, body content |
| Large | 18px | 24px | 600-700 | Subgraph titles, emphasis |
| Heading | 20px | 28px | 600-700 | Diagram titles |
| Display | 24px | 32px | 700 | Hero headings, covers |

**Font stack:** `Inter, Helvetica, Arial, sans-serif`

**Weight rules:** 400 (body), 500 (labels/emphasis), 600-700 (titles/headings)

## Border and Stroke Scale

Borders do NOT follow the 8px grid -- they use their own low-pixel scale. Above 4px, borders transition into spacing territory.

| Level | Value | Use |
|---|---|---|
| Hairline | 1px | Subtle dividers, decorative borders |
| Default | 1px | Standard node borders |
| Medium | 2px | Selected/active states, emphasis, focus rings |
| Heavy | 3px | Strong emphasis, primary nodes |

**Border radius:** 0 (sharp), 2px (subtle), 4px (rounded), 8px (pill-like)

**Icon stroke:** 2px standard (Material Design convention). Use 1.5px for tight spaces as optical correction.

## Color Contrast Requirements

WCAG compliance for diagram elements:

| Element | Against | Minimum (AA) | Recommended (AAA) |
|---|---|---|---|
| Text on colored node fill | Fill color | 4.5:1 | 7:1 |
| Large text (>=18px bold) on fill | Fill color | 3:1 | 4.5:1 |
| Node border on background | Background | 3:1 | 4.5:1 |
| Adjacent colored regions | Each other | 3:1 | 4.5:1 |
| Lines/edges | Background | 3:1 | 4.5:1 |

## Colorblind-Safe Palette (Okabe-Ito)

The gold standard for categorical color -- works for protanopia, deuteranopia, AND tritanopia. Each color has distinct luminance, so the palette works in grayscale too.

| Name | Hex | Use |
|---|---|---|
| Blue | `#0072B2` | Primary nodes, main flow |
| Sky Blue | `#56B4E9` | Info, secondary nodes |
| Bluish Green | `#009E73` | Success, completed states |
| Orange | `#E69F00` | Warning, caution states |
| Yellow | `#F0E442` | Highlight, attention |
| Vermillion | `#D55E00` | Error, danger |
| Reddish Purple | `#CC79A7` | Accent, special emphasis |
| Black | `#000000` | Text, borders |

**Max colors per diagram:** 6 categorical colors. Beyond 8, use shapes/patterns/labels instead.

**Safest pairs:** Blue + Orange, Blue + Yellow, Purple + Yellow.

**Avoid:** Red + Green, Green + Brown, Blue + Purple.

## Quality Checklist

When applying the design system, verify:

- [ ] All spacing values are multiples of 8 (or 4 for micro-adjustments)
- [ ] Line heights snap to the 4px sub-grid (16, 20, 24, 28, 32)
- [ ] Text on colored fills meets 4.5:1 contrast (AA)
- [ ] Borders and graphical objects meet 3:1 contrast (AA)
- [ ] No more than 6 categorical colors per diagram
- [ ] No red+green, green+brown, or blue+purple color pairs
- [ ] Stroke widths use 1px (default), 2px (emphasis), or 3px (heavy) -- not 8px grid values
- [ ] Font weights follow hierarchy: 400 body, 500 labels, 600-700 titles

## References

- [color-contrast.md](references/color-contrast.md) -- Full color system: semantic roles, M3 color architecture, IBM Carbon data viz palette, palette construction rules
- [mermaid-tokens.md](references/mermaid-tokens.md) -- Mapping design tokens to Mermaid config properties with concrete preset examples
- [research-sources.md](references/research-sources.md) -- Full research data with sources from Material Design, IBM Carbon, Atlassian, GitLab Pajamas, USWDS, and academic references
