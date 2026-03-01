# Default Theme -- Locked Visual Identity

Every diagram produced by the visualize skill uses this locked visual identity. No overrides, no customization. Consistency is the feature.

## Why `base` Theme, Not `neutral`

Mermaid's `neutral` theme silently ignores `themeVariables` (GitHub #4264). The `base` theme is the only modifiable theme -- it applies all `themeVariables` as a blank slate.

**Rule:** Generated diagrams must NEVER contain `%%{init:}%%` directives. The `default-theme.json` config file is the single source of truth. Pass it via `mmdc -c default-theme.json`.

## Config File

See [default-theme.json](default-theme.json) for the full config.

**Format constraint:** The JSON must be flat (no `"init"` wrapper). mmdc ignores `themeVariables` if wrapped in `{"init": {...}}` (Mermaid #5357).

**Key settings:**
- `htmlLabels: true` -- required for classDef text color to work. Without it, Mermaid's `<text>` element CSS overrides classDef `color` (quarto-dev #6209).
- `wrappingWidth: 200` -- max pixel width before node text wraps. Only works for backtick-delimited (markdown-string) labels. Subgraph labels ignore it (Mermaid #6110). Workaround: manual `<br/>` in subgraph titles.
- `useMaxWidth: false` -- lets the diagram grow to fill the viewport rather than being constrained.

## Semantic classDef Block

Inject this into every generated diagram source (except mind maps):

```
classDef primary fill:#0072B2,stroke:#005a8c,color:#fff,stroke-width:2px
classDef info fill:#56B4E9,stroke:#2A8ABF,color:#000,stroke-width:2px
classDef success fill:#009E73,stroke:#006B4F,color:#fff,stroke-width:2px
classDef warning fill:#E69F00,stroke:#B37A00,color:#000,stroke-width:2px
classDef danger fill:#D55E00,stroke:#A34800,color:#fff,stroke-width:2px
classDef highlight fill:#F0E442,stroke:#C4B800,color:#000,stroke-width:3px
classDef accent fill:#CC79A7,stroke:#A35E85,color:#000,stroke-width:2px
```

**Text color rules:** White text on dark fills (primary, success, danger). Black text on light fills (info, warning, highlight, accent).

**Unstyled nodes** inherit `primaryColor` (#0072B2) from the theme -- an implicit 8th visual state with auto-derived border and text colors.

**Do NOT use `classDef default`** to style unstyled nodes. It is unreliable (Mermaid #684). Rely on `themeVariables` instead.

**classDef vs themeVariables:** classDef inline styles have higher CSS specificity than theme CSS. They layer, not conflict. `themeVariables` only affect properties a classDef does not explicitly set (e.g., font-family).

**Mind maps:** classDef is NOT supported. Use node shapes for differentiation: `((root))`, `[square]`, `(rounded)`, `))cloud((`.

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

Use `$CLAUDE_PLUGIN_ROOT` to resolve the config file path at runtime:

```bash
# SVG (primary)
bunx --bun @mermaid-js/mermaid-cli mmdc -i diagram.mmd -o diagram.svg \
  -c "$CLAUDE_PLUGIN_ROOT/skills/mermaid-diagrams/references/default-theme.json" \
  -b white -w <WIDTH> -H <HEIGHT>

# PDF (secondary)
bunx --bun @mermaid-js/mermaid-cli mmdc -i diagram.mmd -o diagram.pdf \
  -c "$CLAUDE_PLUGIN_ROOT/skills/mermaid-diagrams/references/default-theme.json" \
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
bunx --bun @mermaid-js/mermaid-cli mmdc -i diagram.mmd -o diagram.svg \
  -c "$CLAUDE_PLUGIN_ROOT/skills/mermaid-diagrams/references/default-theme.json" \
  -p /tmp/puppeteer-config.json -b white -w 3508 -H 2480
```

**`bunx --bun` module resolution:** If Puppeteer fails to resolve with `--bun`, drop the flag:

```bash
bunx @mermaid-js/mermaid-cli mmdc -i diagram.mmd -o diagram.svg ...
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
