# Config Engineering Reference

Advanced config tuning for Mermaid flowcharts -- layout spacing, known bugs, and workarounds. Load when diagrams have overlapping labels, cramped subgraphs, or layout issues.

## Flowchart Config Properties

Full property reference for the `flowchart` config object. Pass via `-c config.json` or frontmatter.

| Property | Type | Default | Notes |
|----------|------|---------|-------|
| `titleTopMargin` | integer | `25` | Margin above the diagram title |
| `subGraphTitleMargin` | object | `{top:0, bottom:0}` | Top/bottom margin for subgraph titles. Partially broken -- see Known Bugs |
| `diagramPadding` | integer | `20` | Padding around the entire diagram |
| `htmlLabels` | boolean | `true` | Required for classDef text color to work |
| `nodeSpacing` | integer | `50` | Spacing between nodes on the same rank. Horizontal for TD/TB, vertical for LR/RL |
| `rankSpacing` | integer | `50` | Spacing between ranks (levels). Controls vertical gap in TD/TB |
| `curve` | enum | `"basis"` | Edge curve style: `basis`, `linear`, `step`, `stepBefore`, `stepAfter`, `cardinal`, `monotoneX`, `monotoneY`, `natural`, `bumpX`, `bumpY`, `catmullRom` |
| `padding` | number | `15` | Padding between node label and shape border. **Only works in the experimental renderer** -- has no effect on the default dagre-wrapper renderer |
| `defaultRenderer` | enum | `"dagre-wrapper"` | `dagre-d3`, `dagre-wrapper` (default), or `elk` |
| `wrappingWidth` | number | `200` | Max pixel width before markdown-string text wraps. **Ignored for subgraph titles** (Mermaid #6110) |
| `inheritDir` | boolean | `false` | If true, subgraphs without explicit direction inherit the parent graph direction |
| `useMaxWidth` | boolean | `true` | `true` = responsive (100% width). `false` = fixed dimensions. **Must be `false` for print export** |

## Sequence Config Properties

Full property reference for the `sequence` config object. These control actor boxes, notes, and structural elements (alt/loop/opt).

| Property | Type | Default | Preset | Notes |
|----------|------|---------|--------|-------|
| `height` | integer | `50` | `96` | Actor box height in pixels. Does NOT affect note or loop boxes |
| `width` | integer | `150` | `200` | Actor box width in pixels. Increase for long participant names |
| `boxMargin` | integer | `10` | `16` | Margin around loop/alt/opt boxes |
| `boxTextMargin` | integer | `5` | `16` | Text margin inside loop/alt/opt boxes. Does NOT affect actor or note text |
| `labelBoxWidth` | number | `50` | `72` | Width of the alt/loop/opt label tab |
| `labelBoxHeight` | number | `20` | `32` | Height of the alt/loop/opt label tab |
| `noteMargin` | integer | `10` | `24` | Margin around notes. Also partially controls internal note padding |
| `messageMargin` | integer | `35` | -- | Vertical space between messages |
| `diagramMarginY` | integer | `10` | `24` | Top and bottom margin of the entire diagram |
| `useMaxWidth` | boolean | `true` | `false` | `false` required for print export |

## Known Bugs and Workarounds

Status of layout-related bugs as of Mermaid v11.x:

| Bug | Issue | Status | Workaround |
|-----|-------|--------|------------|
| Subgraph title overlaps first node | #5622 | Partially fixed | `subGraphTitleMargin: {top:24, bottom:24}` helps for simple cases. Broken with ELK layout. Edge labels still overlap. Use invisible spacer node for reliable fix |
| Subgraph has no left/right/bottom padding | #1342 | Open (6+ years) | No config fix. Use invisible padding subgraph or spacer nodes |
| Multiline subgraph title overlaps nodes | Related to #5622 | Open | Invisible spacer node is the only reliable fix |
| `wrappingWidth` ignored for subgraph titles | #6110 | Open | Use manual `<br/>` in subgraph titles |
| `padding` property ignored on default renderer | By design | Won't fix | Only works with experimental renderer. Use `nodeSpacing`/`rankSpacing` instead |
| Edge labels use `primaryTextColor` (white) | #5052 | Open | `themeCSS` override: `.edgeLabel .label span { color: #333; }` |
| `transparent` edgeLabelBackground becomes grey | #3021 | By design | Use `#FFFFFF00` (hex + zero alpha) + `themeCSS` for `.labelBkg` |
| `classDef default` unreliable | #684 | Open | Use `themeVariables` for default node styling |
| `neutral` theme ignores themeVariables | #4264 | Open | Use `base` theme with custom themeVariables |

## Subgraph Spacing Workarounds

Three techniques to fix cramped subgraphs, ordered by recommended usage.

### 1. subGraphTitleMargin config (recommended for dagre)

The simplest and cleanest fix. Adds vertical margin above/below subgraph titles without extra nodes.

```json
{
  "flowchart": {
    "subGraphTitleMargin": { "top": 24, "bottom": 24 }
  }
}
```

The Classic and Sketch preset configs include this setting. Blueprint (ELK) does not -- ELK silently ignores it.

**Limitations:**
- Does NOT work with ELK layout engine (silently ignored)
- Edge labels can still overlap the margin space in rare cases
- Only adds vertical margin -- no left/right padding

**When to use:** Any dagre-layout diagram with subgraphs. This is the default approach.

### 2. Invisible spacer node + hidden link (fallback for ELK or edge cases)

Adds vertical space by inserting an invisible node that occupies a rank. Use when `subGraphTitleMargin` isn't available (ELK layout) or isn't sufficient.

```
subgraph "Phase 1: Setup"
    spacer1[ ]:::hidden
    spacer1 ~~~ A[Real Node]:::primary
    A --> B[Next Node]:::info
end

classDef hidden fill:none,stroke:none,color:transparent
```

**How it works:** The invisible node occupies a rank, pushing content nodes down. The hidden link (`~~~`) connects it to the first real node without drawing a visible edge. `fill:none,stroke:none,color:transparent` makes the node fully invisible while dagre still lays it out. Do NOT use `display:none` -- it hides children but leaves a visible white rect in the SVG.

**Caveat:** Spacer nodes add a full rank of spacing (nodeSpacing + node height), which can create excessive gaps. Only use when the config-based approach fails.

**When to use:** ELK layout diagrams, or dagre diagrams where `subGraphTitleMargin` doesn't provide enough clearance (e.g., very long multiline titles with edge labels nearby).

### 3. Invisible padding subgraph (best for nested subgraphs)

Wraps content in an inner subgraph with an empty title to create padding.

```
subgraph outer ["Phase 1: Setup"]
    subgraph inner [" "]
        A[Real Node]:::primary --> B[Next Node]:::info
    end
end

style inner fill:none,stroke:none
```

**When to use:** Nested subgraphs where you need padding on all sides, not just top.

## Edge Label Text and Background Fixes

Two bugs affect edge labels when `primaryTextColor` is white (needed for dark node fills):

### Bug 1: Edge labels inherit white text (Mermaid #5052)

Mermaid's `.label text, span` CSS sets all label text to `primaryTextColor`. Node labels get overridden by classDef, but edge labels don't -- they become invisible white-on-white.

**Status:** Open bug, PR #5057 was submitted but never merged.

### Bug 2: `transparent` edge label background becomes grey (#3021)

Setting `edgeLabelBackground: "transparent"` causes Mermaid to derive `.labelBkg` as `rgba(0,0,0,0.5)` -- a visible grey box.

### The holistic fix: `themeCSS`

All three preset configs use `themeCSS` to fix both issues at the CSS level:

```json
{
  "themeCSS": ".edgeLabel .label span { color: #333333; } .edgeLabel .label { background-color: transparent; } .labelBkg { background-color: transparent !important; } .cluster-label .nodeLabel { font-weight: 700; font-size: 18px; }",
  "themeVariables": {
    "edgeLabelBackground": "#FFFFFF00"
  }
}
```

**Why both `themeCSS` and `edgeLabelBackground`?**
- `themeCSS` injects raw CSS that overrides Mermaid's broken specificity chain
- `edgeLabelBackground: "#FFFFFF00"` (white + zero alpha) prevents the grey `.labelBkg` derivation
- Together they ensure edge labels have dark readable text on a fully transparent background

**For non-white backgrounds** (e.g. Sketch preset with `#FFFDF5`), match the background hex with `00` alpha: `#FFFDF500`.

### Subgraph title styling

Subgraph titles render at the same size and weight as node labels by default, making them hard to distinguish visually. All three preset configs add bold + larger font via `themeCSS`:

```
.cluster-label .nodeLabel { font-weight: 700; font-size: 18px; }
```

This targets the subgraph title text without affecting node labels. The `18px` pairs with `subGraphTitleMargin: {top:24, bottom:24}` -- symmetric margin compensates for the larger text size.

## Label Best Practices

### Line breaks in node labels

- **Prefer `<br/>`** over backtick markdown-string syntax. Backtick labels cause dagre to miscalculate node width, cramping nodes together when there are 10+ nodes.
- Max 2 lines per node label. Move detail to edge labels or index.md.

```
%% Good -- dagre calculates width correctly
A[Phase 1:<br/>Config Files]:::primary

%% Avoid -- causes dagre width miscalculation with 10+ nodes
A["`Phase 1:
Config Files`"]:::primary
```

### Subgraph title line breaks

- `wrappingWidth` is ignored for subgraph titles (Mermaid #6110)
- Use manual `<br/>` for line breaks: `subgraph "Line 1<br/>Line 2"`
- Keep subgraph titles short (under 30 chars) to avoid overlap issues

### htmlLabels interaction

- `htmlLabels: true` is required for:
  - classDef `color` property to work on node text
  - `<br/>` line breaks in node labels
  - Proper text rendering in general
- Without it, Mermaid's `<text>` CSS overrides classDef color (quarto-dev #6209)

## ELK Layout Tuning

ELK is an alternative to dagre for complex diagrams (10+ nodes with many crossings).

### When to use ELK

- Diagrams with 10+ nodes and many crossing edges
- When dagre produces excessive edge crossings
- When you need `mergeEdges` for cleaner parallel flows
- Blueprint preset uses ELK by default

### When NOT to use ELK

- Simple diagrams (under 10 nodes) -- dagre is faster and sufficient
- When you need `subGraphTitleMargin` -- it's ignored by ELK
- When node order matters -- ELK may reorder nodes for optimization

### ELK config properties

```json
{
  "layout": "elk",
  "elk": {
    "mergeEdges": false,
    "nodePlacementStrategy": "BRANDES_KOEPF",
    "cycleBreakingStrategy": "GREEDY_MODEL_ORDER",
    "forceNodeModelOrder": false,
    "considerModelOrder": "NODES_AND_EDGES"
  }
}
```

| Property | Default | Notes |
|----------|---------|-------|
| `mergeEdges` | `false` | Share edge paths where convenient. Cleaner but less readable |
| `nodePlacementStrategy` | `BRANDES_KOEPF` | `SIMPLE`, `NETWORK_SIMPLEX`, `LINEAR_SEGMENTS`, `BRANDES_KOEPF` |
| `cycleBreakingStrategy` | `GREEDY_MODEL_ORDER` | How cycles are broken. `GREEDY`, `DEPTH_FIRST`, `INTERACTIVE`, `MODEL_ORDER`, `GREEDY_MODEL_ORDER` |
| `forceNodeModelOrder` | `false` | Preserve source-order of nodes during layout |
| `considerModelOrder` | `NODES_AND_EDGES` | `NONE`, `NODES_AND_EDGES`, `PREFER_EDGES`, `PREFER_NODES` |

### ELK + dagre trade-offs

| Aspect | dagre | ELK |
|--------|-------|-----|
| Speed | Fast | Slower (more passes) |
| Edge crossings | Can be messy with 10+ nodes | Better minimization |
| subGraphTitleMargin | Works (partially) | Ignored |
| Node order preservation | Mostly preserved | May reorder for optimization |
| handDrawn look | Supported (flowcharts only) | Supported (flowcharts only) |
| Preset | Classic, Sketch | Blueprint |

## Config Hierarchy

Three ways to set config, listed in precedence order (highest first):

1. **Frontmatter** in `.mmd` file -- highest precedence, overrides everything
2. **`-c config.json`** via mmdc CLI -- merged under frontmatter
3. **`%%{init:}%%`** directive in diagram source -- lowest precedence

```
%% Frontmatter (wins)
---
config:
  flowchart:
    nodeSpacing: 80
---

%% CLI config (-c flag) fills in anything frontmatter doesn't set

%% init directive (lowest priority, overridden by both above)
%%{init: {'flowchart': {'nodeSpacing': 40}}}%%
```

**Rule for visualize skill output:** Never use `%%{init:}%%` directives. Pass all config via `-c <preset>-theme.json`. This keeps diagram source clean and config centralized.

## useMaxWidth: Print vs Screen

| Mode | `useMaxWidth` | Behavior |
|------|---------------|----------|
| Screen/responsive | `true` (default) | Width/height set to 100%, scales with container |
| Print/fixed | `false` | Uses absolute pixel dimensions from `-w`/`-H` flags |

All preset configs set `useMaxWidth: false` because print export requires fixed dimensions. The `-w` and `-H` flags on mmdc set the Puppeteer viewport, and `useMaxWidth: false` ensures the diagram respects those dimensions.

## Rendering Gotchas by Diagram Type

Lessons learned from iterative rendering and DevTools inspection. These are non-obvious behaviors that waste time if you don't know about them upfront.

### Sequence Diagrams

| Gotcha | Detail |
|--------|--------|
| `look: handDrawn` is ignored | Sequence diagrams always render with clean lines. The `handDrawn` look only applies to flowcharts and state diagrams. The Sketch preset's color palette still applies, but borders are always straight |
| `height` controls actor box height, not `boxTextMargin` | `boxTextMargin` only affects loop/alt/opt box text margin, NOT actor boxes. To fix cramped actor boxes, increase `sequence.height` (default: 50, preset: 96) |
| `width` controls actor box width (default: 150) | Long participant aliases like "SessionStart Hook" can fill the entire 150px box with only 5px side padding. Preset value is 200 |
| `labelBoxWidth` / `labelBoxHeight` control alt/loop/opt label tabs | The default 50x20 is very cramped. Preset values are 72x32 |
| `boxMargin` controls margin around loop/alt/opt boxes | Default 10 is tight. Preset value is 16 |
| `noteMargin` controls both internal and external note spacing | There is no separate property for internal note padding. Increasing `noteMargin` scales internal padding slowly (e.g., default 10 gives ~5px internal gap, 24 gives ~11px) |
| `boxTextMargin` default is 5, not what the name suggests | Despite the name, it only controls text margin inside loop/alt/opt boxes, not actor boxes or note boxes |

### Mind Maps

| Gotcha | Detail |
|--------|--------|
| ELK layout crashes mind maps | Blueprint preset (ELK) causes a Puppeteer TypeError on mind maps. Mind maps only support dagre layout |
| classDef is NOT supported | Cannot style individual nodes with classDef. Use node shapes for differentiation: `((root))`, `[square]`, `(rounded)`, `))cloud((` |
| Section text is invisible on dark fills | Mermaid auto-generates section fills by rotating hue from primaryColor. The `text { fill }` CSS doesn't cascade into `foreignObject > span` elements. Fix with themeCSS: `[class^='section-'] span, [class*=' section-'] span { color: #ffffff !important; }` (or `#333333` for light fills) |
| Max 3-4 top-level branches | More than 4 branches causes extreme horizontal sprawl with tiny nodes. Consolidate into fewer high-level groups |
| `mindmap.padding` is the only spacing control | No nodeSpacing, rankSpacing, or other layout properties. Default 16 works well |

### Flowcharts (for completeness)

| Gotcha | Detail |
|--------|--------|
| `subGraphTitleMargin` is dagre-only | ELK silently ignores it. Use invisible spacer nodes for ELK subgraph spacing |
| `padding` property is broken on default renderer | Only works with the experimental renderer. Use `nodeSpacing`/`rankSpacing` instead |
| Backtick markdown-strings cause width miscalculation | With 10+ nodes, dagre miscalculates node width. Use `<br/>` for line breaks instead |

### State Diagrams

| Gotcha | Detail |
|--------|--------|
| `look: handDrawn` works for state diagrams | Unlike sequence diagrams, state diagrams DO support the hand-drawn look (flowcharts and state diagrams are the two supported types) |
| Composite states cause label overlap | Transition labels entering/exiting composite states collide with the group title. Mermaid renders both at the same Y position with no offset. Avoid composite states or use unlabeled transitions at group boundaries |
| No spacing config properties | State diagrams have no equivalent of `nodeSpacing`, `rankSpacing`, or `subGraphTitleMargin`. Layout is entirely automatic |
| Use `<<choice>>` for branching | Choice pseudo-states render as diamonds and avoid the composite state overlap problem. Cleaner than composite states for decision points |
| Diagrams tend to be very tall/narrow | State diagrams stack vertically with no horizontal spreading. Keep state count under 12 or the diagram becomes unwieldy |

### Gantt Charts

| Gotcha | Detail |
|--------|--------|
| `look: handDrawn` partially works | Bar edges get rough treatment in Sketch preset, but the timeline axis and grid lines stay clean |
| Bar text color is auto-derived | Cannot independently control text color inside bars. Mermaid derives it from the bar fill, which can produce white text on lighter active/crit bars |
| `done` / `active` / `crit` states use hardcoded color derivation | Colors come from themeVariables but the lightness shifts are Mermaid-internal. The `done` state always renders as grey regardless of preset |
| No config properties for bar height or row spacing | Gantt layout is fully automatic. The only controls are `useMaxWidth` and date formatting (`dateFormat`, `axisFormat`) |
| Section background bands alternate automatically | Colors derived from theme. Blueprint's monochrome palette makes them very subtle (barely visible grey stripes) |
| Today marker is always red | The `todayMarker` CSS class is hardcoded red. Cannot be changed via themeVariables, only via themeCSS override |

### Class Diagrams

| Gotcha | Detail |
|--------|--------|
| `look: handDrawn` works for class diagrams | Sketch preset renders hatched fills and rough borders correctly |
| `primaryColor` fill covers entire class box | In Classic and Sketch presets, the class header, properties, and methods sections all share the same fill color. Section divider lines become invisible against the solid background. Blueprint (monochrome) handles this best with white body sections |
| No spacing config properties | Class diagram layout is fully automatic. Cannot control class box width, spacing between classes, or method/property row height |
| Relationship labels can cluster at intersection points | With many classes and crossing relationships, labels pile up. Keep to 6-8 classes max per diagram |
| `<<interface>>` and `<<abstract>>` stereotypes render correctly | Displayed above the class name in italics across all three presets |

### ER Diagrams

| Gotcha | Detail |
|--------|--------|
| Attribute text invisible with white primaryTextColor | The `.label` CSS class sets all text to `primaryTextColor`. ER attribute rows on white backgrounds become white-on-white. Classic preset fixes this with themeCSS: `.label.attribute-type span, .label.attribute-name span, .label.attribute-comment span, .label.attribute-keys span { color: #333333 !important; }` |
| Alternating row colors use primaryColor fill | Odd rows use `primaryColor` as background with white text, even rows are white with dark text. This is intentional but means the preset's primary color must have good contrast with white text |
| `look: handDrawn` is ignored | ER diagrams always render with clean lines, same as sequence diagrams. Only color palette applies |
| No spacing or layout config properties | ER diagram layout is fully automatic. Entity placement, spacing, and relationship routing cannot be configured |
| Entity names must be UPPER_SNAKE_CASE or single words | Spaces in entity names cause parse errors. Use underscores for multi-word names |
| Relationship labels can overlap on complex diagrams | With many entities and crossing relationships, labels pile up in the center. Keep to 6-8 entities max |

### CLI Invocation

| Gotcha | Detail |
|--------|--------|
| `bunx --bun @mermaid-js/mermaid-cli` -- no `mmdc` subcommand | The package exposes the CLI directly. Use `bunx --bun @mermaid-js/mermaid-cli -i input.mmd -o output.svg`, NOT `bunx --bun @mermaid-js/mermaid-cli mmdc -i ...` |
| Background color flag is `-b`, not `--background` | Short flag only: `-b white` or `-b transparent` |
