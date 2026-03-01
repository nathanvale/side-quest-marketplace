# Color and Contrast Reference

Deep reference for color system construction, contrast compliance, and palette selection for visual artifacts.

## Contents

- [WCAG Contrast Criteria](#wcag-contrast-criteria)
- [Semantic Color Roles](#semantic-color-roles)
- [Material Design 3 Color Architecture](#material-design-3-color-architecture)
- [IBM Carbon Data Visualization Palette](#ibm-carbon-data-visualization-palette)
- [Okabe-Ito Palette (Colorblind-Safe)](#okabe-ito-palette-colorblind-safe)
- [Color Count Guidelines](#color-count-guidelines)
- [Problematic Combinations](#problematic-combinations)
- [Hierarchy Without Color](#hierarchy-without-color)
- [Elevation Scale](#elevation-scale-for-svg-filter-effects)

## WCAG Contrast Criteria

Three distinct criteria apply to diagrams:

| Criterion | Level | Applies To | Minimum Ratio |
|---|---|---|---|
| 1.4.3 Contrast (Minimum) | AA | Normal text (<18pt / <14pt bold) | 4.5:1 |
| 1.4.3 Contrast (Minimum) | AA | Large text (>=18pt / >=14pt bold) | 3:1 |
| 1.4.6 Contrast (Enhanced) | AAA | Normal text | 7:1 |
| 1.4.6 Contrast (Enhanced) | AAA | Large text | 4.5:1 |
| 1.4.11 Non-text Contrast | AA | UI components + graphical objects | 3:1 |

**Critical detail for diagrams:** WCAG 1.4.11 measures contrast against *adjacent colors*, not just background. A node border needs 3:1 against the background AND against the node fill. Adjacent pie/chart segments need 3:1 against each other.

## Semantic Color Roles

Based on Material Design 3 and IBM Carbon conventions:

| Role | Use in Diagrams | Suggested Base | On-color |
|---|---|---|---|
| Primary | Main flow, primary nodes | Blue family | White |
| Secondary | Supporting nodes, alternate paths | Cyan/Teal family | Black |
| Tertiary | Special emphasis, annotations | Purple family | Black |
| Success | Completed states, positive outcomes | Green family | White |
| Warning | Caution states, degraded paths | Yellow/Orange family | Black |
| Danger/Error | Error states, critical paths | Red/Vermillion family | White |
| Info | Informational, metadata | Sky Blue family | Black |
| Neutral | Backgrounds, disabled, inactive | Gray scale | Black |

**Pairing rule (from M3):** Colors must be used in proper pairs (primary + on-primary) to guarantee accessible contrast. Never pair primary + primary-container for text.

## Material Design 3 Color Architecture

M3 organizes 26 standard roles into 6 groups:

- **Primary group:** primary, on-primary, primary-container, on-primary-container
- **Secondary group:** secondary, on-secondary, secondary-container, on-secondary-container
- **Tertiary group:** tertiary, on-tertiary, tertiary-container, on-tertiary-container
- **Error group:** error, on-error, error-container, on-error-container (static -- doesn't change with dynamic color)
- **Surface group:** surface, on-surface, on-surface-variant + 5 container levels (lowest, low, default, high, highest)
- **Outline group:** outline (3:1 contrast, boundaries), outline-variant (decorative, dividers)

**For diagrams, the relevant subset is:**
- Primary/secondary/tertiary for node fills
- On-primary/on-secondary/on-tertiary for text on those fills
- Surface levels for subgraph backgrounds (hierarchy without chromatic color)
- Outline vs outline-variant for border emphasis levels

## IBM Carbon Data Visualization Palette

14 categorical colors in strict sequence, curated to maximize contrast between neighbors:

| # | Color | Hex |
|---|---|---|
| 1 | Purple 70 | `#6929c4` |
| 2 | Cyan 50 | `#1192e8` |
| 3 | Teal 70 | `#005d5d` |
| 4 | Magenta 70 | `#9f1853` |
| 5 | Red 50 | `#fa4d56` |
| 6 | Red 90 | `#570408` |
| 7 | Green 60 | `#198038` |
| 8 | Blue 80 | `#002d9c` |
| 9 | Magenta 50 | `#ee538b` |
| 10 | Yellow 50 | `#b28600` |
| 11 | Teal 50 | `#009d9a` |
| 12 | Cyan 90 | `#012749` |
| 13 | Orange 70 | `#8a3800` |
| 14 | Purple 50 | `#a56eff` |

**Carbon alert palette:** Red 60 (danger), Orange 40 (serious), Yellow 30 (warning), Green 60 (success).

## Okabe-Ito Palette (Colorblind-Safe)

The gold standard for categorical color in scientific and technical diagrams. Published by Masataka Okabe and Kei Ito; popularized by Bang Wong in Nature Methods.

| Color | Hex | RGB |
|---|---|---|
| Orange | `#E69F00` | (230, 159, 0) |
| Sky Blue | `#56B4E9` | (86, 180, 233) |
| Bluish Green | `#009E73` | (0, 158, 115) |
| Yellow | `#F0E442` | (240, 228, 66) |
| Blue | `#0072B2` | (0, 114, 178) |
| Vermillion | `#D55E00` | (213, 94, 0) |
| Reddish Purple | `#CC79A7` | (204, 121, 167) |
| Black | `#000000` | (0, 0, 0) |

**Why it works:** Each color has distinct luminance, so the palette degrades gracefully to grayscale. Designed for protanopia, deuteranopia, AND tritanopia.

## Color Count Guidelines

| Count | Recommendation |
|---|---|
| 2-3 | Ideal for most diagrams |
| 4-6 | Maximum for categorical distinction |
| 7-8 | Absolute maximum (Okabe-Ito palette size) |
| 8+ | Not recommended -- use shapes, patterns, or labels instead |

## Problematic Combinations

| Combination | Why | Alternative |
|---|---|---|
| Red + Green | Most common color vision deficiency | Blue + Orange |
| Green + Brown | Appear identical to deuteranopes | Blue + Brown |
| Blue + Purple | Tritanopia confusion | Blue + Orange |
| Light Green + Yellow | Low luminance contrast | Dark Green + Yellow |

**Safest universal pairs:** Blue + Orange, Blue + Yellow, Purple + Yellow.

## Hierarchy Without Color

Three techniques for node emphasis when color alone is insufficient:

1. **Border weight variation:** 1px default, 2px emphasis, 3px primary/selected
2. **Background tint:** Use surface container scale (M3's 5 levels) to create hierarchy without chromatic color
3. **Shadow/elevation:** `0 2px 4px rgba(0,0,0,0.1)` for slight lift; `0 4px 8px rgba(0,0,0,0.1)` for prominent nodes

## Elevation Scale (for SVG filter effects)

| Level | Shadow | Use |
|---|---|---|
| 0 | none | Flat/resting |
| 1 | `0 1px 4px rgba(0,0,0,0.1)` | Subtle lift |
| 2 | `0 4px 8px rgba(0,0,0,0.1)` | Cards, raised elements |
| 3 | `0 8px 16px rgba(0,0,0,0.1)` | Floating elements |
| 4 | `0 12px 24px rgba(0,0,0,0.1)` | Modals, overlays |

Note: Shadow Y-offset and blur follow the 8px grid progression at levels 2+. All use 10% black opacity (USWDS convention).
