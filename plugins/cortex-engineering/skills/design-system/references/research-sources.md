# Research Sources

Full source data for the design system tokens. Compiled from Firecrawl scrapes of official design system documentation.

## Contents

- [Spacing Systems](#spacing-systems) -- IBM Carbon, Atlassian, GitLab Pajamas, Material Design, Tailwind
- [Typography](#typography) -- IBM Carbon, Ant Design, Material Design 3, 8px grid typography
- [Border and Stroke Systems](#border-and-stroke-systems) -- Atlassian, USWDS, Material Design
- [Icon Sizing](#icon-sizing) -- Standard sizes, touch targets
- [Elevation and Shadow](#elevation-and-shadow) -- USWDS, Material Design 3
- [Color](#color) -- IBM Carbon data viz, Okabe-Ito, vertical rhythm, accessibility

## Spacing Systems

### IBM Carbon (8px base, geometric progression)

Source: https://carbondesignsystem.com/elements/spacing/overview/

| Token | px | Use |
|---|---|---|
| `$spacing-01` | 2 | Micro adjustment |
| `$spacing-02` | 4 | Component internals |
| `$spacing-03` | 8 | Base unit |
| `$spacing-04` | 12 | Compact padding |
| `$spacing-05` | 16 | Standard padding |
| `$spacing-06` | 24 | Section spacing |
| `$spacing-07` | 32 | Group separation |
| `$spacing-08` | 40 | Layout spacing |
| `$spacing-09` | 48 | Major section breaks |
| `$spacing-10` | 64 | Large layout |
| `$spacing-11` | 80 | XL layout |
| `$spacing-12` | 96 | XXL layout |
| `$spacing-13` | 160 | Page-level |

### Atlassian Design (8px base, multiplier scale)

Source: https://atlassian.design/foundations/spacing

| Token | Multiplier | px | Category |
|---|---|---|---|
| `space.025` | 0.25x | 2 | Small (0-8px) |
| `space.050` | 0.5x | 4 | Small |
| `space.075` | 0.75x | 6 | Small |
| `space.100` | 1x | 8 | Small (base) |
| `space.150` | 1.5x | 12 | Medium (12-24px) |
| `space.200` | 2x | 16 | Medium |
| `space.250` | 2.5x | 20 | Medium |
| `space.300` | 3x | 24 | Medium |
| `space.400` | 4x | 32 | Large (32-80px) |
| `space.500` | 5x | 40 | Large |
| `space.600` | 6x | 48 | Large |
| `space.800` | 8x | 64 | Large |
| `space.1000` | 10x | 80 | Large |

Usage guidance:
- Small (0-8px): Gaps between icons and text, compact component padding
- Medium (12-24px): Larger component padding, vertical spacing between card elements
- Large (32-80px): Page-level content separation, section spacing

### GitLab Pajamas (geometric progression: 8 * 2^n then n * 1.5)

Source: https://design.gitlab.com/product-foundations/spacing

| Token | px | Semantic role |
|---|---|---|
| `spacing-scale.1` | 2 | Within component |
| `spacing-scale.2` | 4 | Within component |
| `spacing-scale.3` | 8 | Separate related elements |
| `spacing-scale.4` | 12 | Horizontal padding only |
| `spacing-scale.5` | 16 | Separate unrelated elements |
| `spacing-scale.6` | 24 | Separate sub-sections |
| `spacing-scale.7` | 32 | Separate sections |
| `spacing-scale.9` | 48 | Layout |
| `spacing-scale.11` | 64 | Layout |
| `spacing-scale.12` | 80 | Layout |
| `spacing-scale.13` | 96 | Layout |

### Material Design (8dp grid)

Source: https://m2.material.io/design/layout/spacing-methods.html

- 8dp square baseline grid for all components and layouts
- 4dp grid for icons, type, and sub-component alignment
- Component heights snap to 8dp grid
- Touch targets minimum 48x48dp with 8dp spacing between targets

### Tailwind CSS (4px base unit)

Source: https://v1.tailwindcss.com/docs/customizing-spacing

| Name | px |
|---|---|
| 1 | 4 |
| 2 | 8 |
| 3 | 12 |
| 4 | 16 |
| 5 | 20 |
| 6 | 24 |
| 8 | 32 |
| 10 | 40 |
| 12 | 48 |
| 16 | 64 |
| 20 | 80 |
| 24 | 96 |

### Universal consensus

The "workhorse" values used most frequently across all systems: **8, 16, 24, 32, 48, 64**.

## Typography

### IBM Carbon Type Scale

Source: https://carbondesignsystem.com/elements/typography/overview/

Formula: `Xn = Xn-1 + {INT[(n-2)/4] + 1} * 2`, starting at 12px.

Scale: 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 54, 60, 68, 76, 84, 92

Weights: Light (300), Regular (400), SemiBold (600)

### Ant Design Type Scale

Source: https://ant.design/docs/spec/font/

Base: 14px (optimized for 50cm reading distance). Inspired by pentatonic musical scale.

Scale: 12, 14, 16, 20, 24, 30, 38, 46, 56, 68

Line height for base (14px): 22px (ratio 1.57)

### Material Design 3 Type Scale

Source: https://m3.material.io/styles/typography/type-scale-tokens

| Role | Size (px) | Line Height (px) | Weight |
|---|---|---|---|
| Display Large | 57 | 64 | 400 |
| Display Medium | 45 | 52 | 400 |
| Display Small | 36 | 44 | 400 |
| Headline Large | 32 | 40 | 400 |
| Headline Medium | 28 | 36 | 400 |
| Headline Small | 24 | 32 | 400 |
| Title Large | 22 | 28 | 400 |
| Title Medium | 16 | 24 | 500 |
| Title Small | 14 | 20 | 500 |
| Body Large | 16 | 24 | 400 |
| Body Medium | 14 | 20 | 400 |
| Body Small | 12 | 16 | 400 |
| Label Large | 14 | 20 | 500 |
| Label Medium | 12 | 16 | 500 |
| Label Small | 11 | 16 | 500 |

Key insight: Material Design uses a 4dp baseline grid for typography. Line heights are multiples of 4 (16, 20, 24, 28, 32, 36, 40, 44, 52, 64).

### 8px Grid Typography (Elliot Dahl)

Source: https://medium.com/free-code-camp/8-point-grid-typography-on-the-web-be5dc97db6bc

Strict 8px-only line heights create gaps that are too large for some sizes. The 4px sub-grid approach (used by Material Design) is more practical:

| Font Size | Line Height (4px snap) | Ratio |
|---|---|---|
| 11px | 16px | 1.45 |
| 12px | 16px | 1.33 |
| 14px | 20px | 1.43 |
| 16px | 24px | 1.5 |
| 18px | 24px | 1.33 |
| 20px | 28px | 1.4 |
| 24px | 32px | 1.33 |

## Border and Stroke Systems

### Atlassian Design

Source: https://atlassian.design/foundations/border

| Token | Value | Use |
|---|---|---|
| `border.width` | 1px | Default borders, dividers |
| `border.width.selected` | 2px | Active tab, selected item |
| `border.width.focused` | 2px | Focus ring |

### USWDS

Source: https://designsystem.digital.gov/utilities/border/

| Token | Value |
|---|---|
| `.border-1px` | 1px |
| `.border-2px` | 2px |
| `.border-05` | 4px |
| `.border-1` | 8px |

Border radius: 0, 2px (sm), 4px (md), 8px (lg), 99rem (pill)

### Material Design Icons

Source: https://m2.material.io/design/iconography/system-icons.html

- 2dp stroke width for all curves, angles, interior/exterior strokes
- 1.5dp for tight spaces (optical correction)
- Corner radius default: 2dp (range: 0-4dp)

## Icon Sizing

### Standard sizes across design systems

| Size | 8px Grid | Usage |
|---|---|---|
| 16px | 2x | Small inline icons, dense UI |
| 20px | 2.5x | Dense desktop icons |
| 24px | 3x | Standard system icons (Material) |
| 32px | 4x | Medium icons, navigation |
| 48px | 6x | Touch targets, hero icons |
| 64px | 8x | Illustration icons |

### Touch targets

| Standard | Minimum | Source |
|---|---|---|
| WCAG 2.1 AAA | 44x44px | W3C |
| WCAG 2.5.8 | 24x24px (with spacing) | W3C 2.2 |
| Material Design | 48dp | Google |
| Apple HIG | 44pt | Apple |

## Elevation and Shadow

### USWDS Shadow Tokens

Source: https://designsystem.digital.gov/design-tokens/shadow/

| Token | CSS box-shadow |
|---|---|
| `1` | `0 1px 4px 0 rgba(0,0,0,0.1)` |
| `2` | `0 4px 8px 0 rgba(0,0,0,0.1)` |
| `3` | `0 8px 16px 0 rgba(0,0,0,0.1)` |
| `4` | `0 12px 24px 0 rgba(0,0,0,0.1)` |
| `5` | `0 16px 32px 0 rgba(0,0,0,0.1)` |

### Material Design 3 Elevation

Source: https://m3.material.io/styles/elevation/applying-elevation

6 levels (0-5dp). M3 shifted from shadow-heavy to tonal difference (surface color roles). Shadows reserved for floating elements and hover/drag states.

## Color

### IBM Carbon Data Visualization

Source: https://carbondesignsystem.com/data-visualization/color-palettes/

14 categorical colors in strict sequence, curated to maximize contrast between neighbors. Alert palette: Red 60 (danger), Orange 40 (serious), Yellow 30 (warning), Green 60 (success).

### Okabe-Ito Palette

Source: https://jfly.uni-koeln.de/color/ (original), popularized in Nature Methods by Bang Wong.

8 colors with distinct luminance values. Works for all three types of color vision deficiency.

### Vertical Rhythm

Source: https://uxdesign.cc/baseline-grids-design-systems-ae23b5af8cec

Rules: (1) Element total height must be a multiple of grid step, (2) line heights must divide evenly, (3) padding compensates so total snaps to grid. Font size can be any value -- only line height and outer spacing must snap.

### Data Visualization Accessibility

Source: https://designsystem.digital.gov/components/data-visualizations/

USWDS guidance: Prefer simple visualization types, limit to 2-3 concepts per viz, meet contrast requirements, avoid reusing colors for different variables, provide textual alternatives for SVG content.
