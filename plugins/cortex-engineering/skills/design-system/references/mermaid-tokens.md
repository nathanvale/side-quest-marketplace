# Mermaid Config Token Mapping

Maps the design system tokens to concrete Mermaid config properties. Use this when creating or modifying theme JSON files.

## Spacing Tokens to Mermaid Properties

| Design Token | px | Mermaid Property | Preset Value |
|---|---|---|---|
| `sm` | 16 | `flowchart.padding` | 16 (all presets) |
| `md-lg` | 24-32 | `flowchart.diagramPadding` | 32 (all presets) |
| `md` | 24 | `flowchart.subGraphTitleMargin.top` | 24 (Classic, Sketch) |
| `md` | 24 | `flowchart.subGraphTitleMargin.bottom` | 24 (Classic, Sketch) |
| `xl` | 48 | `flowchart.nodeSpacing` (compact) | 48 (Blueprint) |
| `2xl` | 64 | `flowchart.nodeSpacing` (standard) | 64 (Classic, Sketch) |
| `xl` | 48 | `flowchart.rankSpacing` (compact) | 48 (Blueprint) |
| `2xl` | 64 | `flowchart.rankSpacing` (standard) | 64 (Classic, Sketch) |
| 24x8 | 192 | `flowchart.wrappingWidth` | 192 (all presets) |

## Typography Tokens to Mermaid Properties

| Design Token | Value | Mermaid Property |
|---|---|---|
| Base size | 16px | `themeVariables.fontSize` |
| Large size | 18px | `themeCSS` `.cluster-label .nodeLabel { font-size: 18px; }` |
| Title weight | 700 | `themeCSS` `.cluster-label .nodeLabel { font-weight: 700; }` |
| Font stack | Inter, Helvetica, Arial, sans-serif | `themeVariables.fontFamily` |

## Border Tokens to Mermaid Properties

| Design Token | Value | Mermaid Property |
|---|---|---|
| Default stroke | 1px | classDef `stroke-width:1px` |
| Emphasis stroke | 2px | classDef `stroke-width:2px` (standard nodes) |
| Heavy stroke | 3px | classDef `stroke-width:3px` (highlight nodes) |

## Color Tokens to Mermaid Properties

Okabe-Ito palette mapped to Mermaid classDef and themeVariables:

| Semantic Role | Hex | On-color | classDef |
|---|---|---|---|
| Primary | `#0072B2` | `#fff` | `fill:#0072B2,stroke:#005a8c,color:#fff,stroke-width:2px` |
| Info | `#56B4E9` | `#000` | `fill:#56B4E9,stroke:#2A8ABF,color:#000,stroke-width:2px` |
| Success | `#009E73` | `#fff` | `fill:#009E73,stroke:#006B4F,color:#fff,stroke-width:2px` |
| Warning | `#E69F00` | `#000` | `fill:#E69F00,stroke:#B37A00,color:#000,stroke-width:2px` |
| Highlight | `#F0E442` | `#000` | `fill:#F0E442,stroke:#8A8200,color:#000,stroke-width:3px` |
| Accent | `#CC79A7` | `#000` | `fill:#CC79A7,stroke:#A35E85,color:#000,stroke-width:2px` |
| Danger | `#D55E00` | `#fff` | `fill:#D55E00,stroke:#A34800,color:#fff,stroke-width:2px` |

**On-color rule:** White text on dark fills (Blue, Green, Vermillion). Black text on light fills (Sky Blue, Orange, Yellow, Purple).

## Preset Spacing Profiles

Three density profiles, all 8px-grid-aligned:

### Classic (Standard)

```json
{
  "flowchart": {
    "nodeSpacing": 64,
    "rankSpacing": 64,
    "padding": 16,
    "subGraphTitleMargin": { "top": 24, "bottom": 24 },
    "diagramPadding": 32,
    "wrappingWidth": 192
  }
}
```

### Sketch (Standard, same spacing as Classic)

```json
{
  "flowchart": {
    "nodeSpacing": 64,
    "rankSpacing": 64,
    "padding": 16,
    "subGraphTitleMargin": { "top": 24, "bottom": 24 },
    "diagramPadding": 32,
    "wrappingWidth": 192
  }
}
```

### Blueprint (Compact -- ELK handles density better)

```json
{
  "flowchart": {
    "nodeSpacing": 48,
    "rankSpacing": 48,
    "padding": 16,
    "diagramPadding": 32,
    "wrappingWidth": 192
  }
}
```

Note: Blueprint omits `subGraphTitleMargin` because ELK silently ignores it.

## themeCSS Rules

All presets include these CSS overrides:

```css
/* Fix edge label text color (Mermaid #5052) */
.edgeLabel .label span { color: #333333; }

/* Fix edge label background (Mermaid #3021) */
.edgeLabel .label { background-color: transparent; }
.labelBkg { background-color: transparent !important; }

/* Subgraph title hierarchy */
.cluster-label .nodeLabel { font-weight: 700; font-size: 18px; }
```

Blueprint uses `color: #000000` instead of `#333333` for its monochrome theme.
