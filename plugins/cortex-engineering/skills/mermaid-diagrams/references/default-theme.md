# Curated Visual Identity

Every diagram produced by the visualize skill uses one of three curated presets. Each preset pairs a theme config, look mode, and layout engine. The user picks a preset at confirmation time -- zero manual styling decisions.

## Table of Contents

- [Presets](#presets)
- [Why `base` Theme](#why-base-theme-not-neutral)
- [Config Files](#config-files)
- [Classic classDef Block](#classic-classdef-block)
- [Sketch classDef Block](#sketch-classdef-block)
- [Blueprint classDef Block](#blueprint-classdef-block)
- [Diagram Type Compatibility](#diagram-type-compatibility)
- [Diagram Type Auto-Detection](#diagram-type-auto-detection)
- [Node Shape Mapping](#node-shape-mapping)
- [Paper Sizes](#paper-sizes)
- [mmdc Export Commands](#mmdc-export-commands)
- [mmdc Troubleshooting](#mmdc-troubleshooting)
- [Security](#security)
- [Mermaid Issues Referenced](#mermaid-issues-referenced)

## Presets

| Preset | Look | Layout | Theme | Best for |
|--------|------|--------|-------|----------|
| **Classic** (default) | `classic` | `dagre` | `base` + Wong palette | Print, documentation, wall diagrams |
| **Sketch** | `handDrawn` | `dagre` | `base` + muted palette | Brainstorms, informal, whiteboard |
| **Blueprint** | `classic` | `elk` | `base` + monochrome | Complex systems, architecture, 10+ nodes |

Each preset exercises a distinct Mermaid v11 axis -- Classic: proven palette, Sketch: look mode, Blueprint: layout engine.

**Minimum version:** All three configs require Mermaid v11+ for `look`, `layout`, and `handDrawnSeed` properties.

## Why `base` Theme, Not `neutral`

Mermaid's `neutral` theme silently ignores `themeVariables` (GitHub #4264). The `base` theme is the only modifiable theme -- it applies all `themeVariables` as a blank slate.

**Rule:** Generated diagrams must NEVER contain `%%{init:}%%` directives. The preset config files are the single source of truth. Pass via `mmdc -c <preset>-theme.json`.

## Config Files

| Preset | File | Notes |
|--------|------|-------|
| Classic | [default-theme.json](default-theme.json) | Wong/Okabe-Ito colorblind-safe palette |
| Sketch | [sketch-theme.json](sketch-theme.json) | `handDrawnSeed: 42` for deterministic output |
| Blueprint | [blueprint-theme.json](blueprint-theme.json) | ELK layout with `mergeEdges: true` |

**Format constraint:** The JSON must be flat (no `"init"` wrapper). mmdc ignores `themeVariables` if wrapped in `{"init": {...}}` (Mermaid #5357).

**Key settings (shared across all presets):**
- `htmlLabels: true` -- required for classDef text color to work. Without it, Mermaid's `<text>` element CSS overrides classDef `color` (quarto-dev #6209).
- `wrappingWidth: 192` -- max pixel width before node text wraps. Only works for backtick-delimited (markdown-string) labels. Subgraph labels ignore it (Mermaid #6110). Workaround: manual `<br/>` in subgraph titles. **Prefer `<br/>` over backtick labels in all cases** -- backtick labels cause dagre to miscalculate node width, cramping nodes together with 10+ nodes.
- `useMaxWidth: false` -- lets the diagram grow to fill the viewport rather than being constrained.
- `subGraphTitleMargin: {top: 24, bottom: 24}` -- included in Classic and Sketch presets (dagre layout). Adds vertical clearance between subgraph titles and content nodes. Omitted from Blueprint preset because ELK silently ignores it. See [config-engineering.md](config-engineering.md) for edge cases and alternative workarounds.

## Classic classDef Block

Inject into every generated diagram source (except mind maps) when using the Classic preset:

```
classDef primary fill:#0072B2,stroke:#005a8c,color:#fff,stroke-width:2px
classDef info fill:#56B4E9,stroke:#2A8ABF,color:#000,stroke-width:2px
classDef success fill:#009E73,stroke:#006B4F,color:#fff,stroke-width:2px
classDef warning fill:#E69F00,stroke:#B37A00,color:#000,stroke-width:2px
classDef danger fill:#D55E00,stroke:#A34800,color:#fff,stroke-width:2px
classDef highlight fill:#F0E442,stroke:#8A8200,color:#000,stroke-width:3px
classDef accent fill:#CC79A7,stroke:#A35E85,color:#000,stroke-width:2px
```

**Text color rules:** White text on dark fills (primary, success, danger). Black text on light fills (info, warning, highlight, accent).

**Unstyled nodes** inherit `primaryColor` (#0072B2) from the theme -- an implicit 8th visual state with auto-derived border and text colors.

**Do NOT use `classDef default`** to style unstyled nodes. It is unreliable (Mermaid #684). Rely on `themeVariables` instead.

**classDef vs themeVariables:** classDef inline styles have higher CSS specificity than theme CSS. They layer, not conflict. `themeVariables` only affect properties a classDef does not explicitly set (e.g., font-family).

**Mind maps:** classDef is NOT supported. Use node shapes for differentiation: `((root))`, `[square]`, `(rounded)`, `))cloud((`.

## Sketch classDef Block

Inject into every generated diagram source (except mind maps) when using the Sketch preset. Warm, parchment-like tones with dark text for print readability:

```
classDef primary fill:#C4A882,stroke:#8B7355,color:#333,stroke-width:3px
classDef info fill:#A3B5CD,stroke:#6B7F99,color:#333,stroke-width:3px
classDef success fill:#8FBC8F,stroke:#5F8A5F,color:#333,stroke-width:3px
classDef warning fill:#D4B896,stroke:#9A7E5A,color:#333,stroke-width:3px
classDef danger fill:#D4836A,stroke:#A35840,color:#fff,stroke-width:3px
classDef highlight fill:#F5E6A0,stroke:#A89640,color:#333,stroke-width:3px
classDef accent fill:#C4A0B5,stroke:#8A6B7D,color:#333,stroke-width:3px
```

**Sketch-specific rules:**
- All borders darkened 25-30% from fills to compensate for rough.js jitter (reduces effective stroke width to ~60-70% of nominal)
- Minimum `stroke-width:3px` on all classes (rough.js contrast dilution)
- Info uses blue-family (#A3B5CD dusty blue), NOT green -- breaks green-green confusion pair for deuteranopia/protanopia

## Blueprint classDef Block

Inject into every generated diagram source (except mind maps) when using the Blueprint preset. Monochrome with pattern differentiation:

```
classDef primary fill:#FFFFFF,stroke:#333333,color:#000,stroke-width:2px
classDef info fill:#F0F0F0,stroke:#555555,color:#000,stroke-width:2px
classDef success fill:#E0E0E0,stroke:#333333,color:#000,stroke-width:2px
classDef warning fill:#F5F5F5,stroke:#777777,color:#000,stroke-width:2px
classDef danger fill:#FFFFFF,stroke:#333333,color:#000,stroke-width:4px,stroke-dasharray:3
classDef highlight fill:#F0F0F0,stroke:#555555,color:#000,stroke-width:3px
classDef accent fill:#E8E8E8,stroke:#444444,color:#000,stroke-width:2px
```

**Blueprint-specific rules:**
- Danger uses `stroke-dasharray:3` + `stroke-width:4px` to distinguish from primary (no color differentiation in monochrome)
- Warning border is #777777 (darkened to meet 3:1 contrast against #F5F5F5 fill)
- All text is black -- monochrome palette has no dark fills requiring white text

## Diagram Type Compatibility

`look: handDrawn` and `layout: elk` only apply to **flowcharts and state diagrams** as of Mermaid v11. All other diagram types silently fall back to `look: classic` and `layout: dagre` with the preset's color palette still applied.

This means: Sketch and Blueprint presets give their full visual effect on flowcharts and state diagrams. For sequence diagrams, mind maps, ER diagrams, etc., only the color palette from the preset is used.

## Diagram Type Auto-Detection

When the visualize skill receives a source document, auto-detect the diagram type:

| Source | Signal | Diagram Type | Direction |
|--------|--------|-------------|-----------|
| `type: brainstorm` | -- | Mind map | auto |
| `type: research` | -- | Mind map | auto |
| `type: plan` | -- | Flowchart | TD |
| `type: decision` | -- | Flowchart | TD |
| Content has ordered interactions | "sends", "receives", "calls" | Sequence | -- |
| Content has state transitions | "pending -> active", lifecycle | State diagram | -- |
| Content has entity relationships | "has many", "belongs to" | ER diagram | -- |
| Content has system components | services, APIs, infrastructure | Flowchart (architecture) | LR |
| Standalone / unknown | no signal | Ask user | -- |

Always confirm with the user before generating. Never auto-invoke.

## Node Shape Mapping

Use shapes semantically -- don't rely on color alone:

| Semantic role | Shape | Syntax |
|--------------|-------|--------|
| Process/action | Rectangle | `[text]` |
| Start/end | Rounded | `(text)` |
| Decision | Diamond | `{text}` |
| Database | Cylinder | `[(text)]` |
| External system | Dashed rectangle | Use `classDef` with `stroke-dasharray:5` |
| Input/output | Parallelogram | `[/text/]` |

Max 3 different shapes per diagram. More becomes visual noise.

## Paper Sizes

| Size | `-w` | `-H` | Pixels at 300 DPI | Use for |
|------|------|------|--------------------|---------|
| A4 landscape (default) | 3508 | 2480 | 3508 x 2480 | Desk reference, home printer |
| A3 landscape | 4961 | 3508 | 4961 x 3508 | Wall poster, team board |

SVG has no intrinsic DPI -- the `-w` and `-H` flags set the Puppeteer viewport dimensions for layout purposes.

A4 is the default. User chooses at confirmation time.

## mmdc Export Commands

Use `$CLAUDE_PLUGIN_ROOT` to resolve the config file path at runtime. Replace `<PRESET>` with `default`, `sketch`, or `blueprint`:

```bash
# SVG (primary)
bunx @mermaid-js/mermaid-cli -i diagram.mmd -o diagram.svg \
  -c "$CLAUDE_PLUGIN_ROOT/skills/mermaid-diagrams/references/<PRESET>-theme.json" \
  -b white -w <WIDTH> -H <HEIGHT>

# PDF (secondary)
bunx @mermaid-js/mermaid-cli -i diagram.mmd -o diagram.pdf \
  -c "$CLAUDE_PLUGIN_ROOT/skills/mermaid-diagrams/references/<PRESET>-theme.json" \
  -b white -w <WIDTH> -H <HEIGHT> --pdfFit
```

**Flag notes:**
- `--scale` / `-s` only affects PNG (Puppeteer `deviceScaleFactor`). Omit for SVG/PDF.
- `--pdfFit` (camelCase, short: `-f`) auto-sizes the PDF page to diagram content.
- `-b white` sets background for SVG only. PDF background comes from Chrome's rendering.

## mmdc Troubleshooting

**First-run Chromium download:** mmdc downloads Chromium (~150MB) on first use. If this fails behind a proxy or firewall, use system Chrome:

```bash
# Create puppeteer-config.json
echo '{"executablePath": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}' > /tmp/puppeteer-config.json

# Use -p flag
bunx @mermaid-js/mermaid-cli -i diagram.mmd -o diagram.svg \
  -c "$CLAUDE_PLUGIN_ROOT/skills/mermaid-diagrams/references/default-theme.json" \
  -p /tmp/puppeteer-config.json -b white -w 3508 -H 2480
```

**`bunx` module resolution:** If Puppeteer fails to resolve with bunx, use npx with the `-p` flag instead:

```bash
npx -p @mermaid-js/mermaid-cli mmdc -i diagram.mmd -o diagram.svg ...
```

**Bunx cache corruption:** If mmdc fails with `Cannot find module '@modelcontextprotocol/sdk/...'` or similar, clear the bunx cache:

```bash
rm -rf /private/var/folders/_b/*/T/bunx-501-@mermaid-js/
```

## Security

Generated Mermaid must NEVER contain:
- `click` directives (execute JavaScript in browser)
- `callback` directives (execute JavaScript in browser)
- `href` directives (navigate URLs when rendered)

## Mermaid Issues Referenced

- #4264 -- `neutral` theme ignores themeVariables
- #5357 -- Config must be flat (no init wrapper)
- #684 -- `classDef default` unreliable
- #6110 -- `wrappingWidth` ignored for subgraph labels
- quarto-dev #6209 -- `htmlLabels: true` required for classDef text color
