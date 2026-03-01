---
created: 2026-03-01
title: "Mermaid Styling 2.0 - Curated Themes, Look Modes, and ELK Layout"
type: plan
tags: [cortex, mermaid, styling, themes, look, elk, visualize]
project: cortex-engineering
status: completed
origin: docs/brainstorms/2026-02-28-visualize-skill-brainstorm.md
deepened: 2026-03-01
deepened-round-2: 2026-03-01
---

> Origin: docs/brainstorms/2026-02-28-visualize-skill-brainstorm.md
> Research session: 2026-03-01 (Context7 + Firecrawl + LinkedIn article on Mermaid v11 + newsroom community investigation)
> Deepened: 2026-03-01 (5 parallel agents -- Mermaid v11 research, color accessibility, architecture review, simplicity review, skill authoring patterns)
> Deepened round 2: 2026-03-01 (6 parallel agents -- Mermaid v11 schema verification, WCAG accessibility deep-dive, architecture strategist, code simplicity reviewer, skill authoring audit, pattern consistency checker)

# feat: Mermaid Styling 2.0 - Curated Themes, Look Modes, and ELK Layout

## Overview

Upgrade the mermaid-diagrams and visualize skills to leverage Mermaid v11's `look`, `layout`, and frontmatter config properties while keeping the curated-identity philosophy. Instead of one locked theme, offer 3 curated presets that each combine a theme config, look mode, and layout engine. The user picks a preset at confirmation time -- zero manual styling decisions, maximum visual variety.

## Problem Statement

The current system has a single "locked visual identity" (one config, one palette, one layout). This was the right v1 decision -- consistency over chaos. But Mermaid v11 introduced powerful features we're not using:

1. **`look` property** (`classic`, `handDrawn`) -- changes rendering style (solid borders vs. sketchy). Note: `neo` exists only in the commercial Mermaid Chart SaaS, not in the open-source library.
2. **`layout` property** (`dagre`, `elk`) -- changes how nodes are arranged. ELK must be registered separately (mmdc bundles it automatically).
3. **`handDrawnSeed`** -- makes hand-drawn output deterministic (same seed = same wiggly lines)

These are exactly the kind of features that help with ADHD visual processing -- different looks for different contexts make diagrams more memorable and easier to distinguish on the wall.

(see brainstorm: docs/brainstorms/2026-02-28-visualize-skill-brainstorm.md)

### Research Insights

**Diagram type compatibility (critical limitation):**

`look: handDrawn` and `layout: elk` only work on **flowcharts and state diagrams** as of Mermaid v11. All other diagram types silently fall back to `look: classic` and `layout: dagre`. No error, no warning -- the preset's color palette still applies, only the look/layout effects are lost.

This is acceptable because the majority of visualize skill output is flowcharts (the most common diagram type requested). Document the limitation clearly and let users know when their diagram type won't benefit from the non-classic presets.

**ELK config (verified against v11.12.3 schema):** Blueprint uses `NETWORK_SIMPLEX` + `mergeEdges: true` -- most compact, balanced placement for architecture diagrams. `considerModelOrder` defaults to `NODES_AND_EDGES` already, no need to set explicitly. Full ELK property reference: https://mermaid.js.org/config/schema-docs/config-properties-elk.html

**handDrawnSeed:** Top-level in JSON config. `0` = random, any positive integer = deterministic. `42` is fine.

**Key Mermaid v11 constraints:** Must use `base` theme for custom palettes (`neutral` ignores themeVariables, #4264). Config file must be flat JSON (no `init` wrapper, #5357). `htmlLabels: true` required for classDef text color. ELK + handDrawn at tight spacing can overlap -- increase spacing ~30% if combining.

## Proposed Solution

### 3 Curated Presets

Each preset is a JSON config file in `references/` plus a matching classDef block. The visualize skill offers preset choice at confirmation time.

| Preset | Look | Layout | Theme | Best for |
|--------|------|--------|-------|----------|
| **Classic** (default) | `classic` | `dagre` | `base` + Wong palette | Print, documentation, wall diagrams |
| **Sketch** | `handDrawn` | `dagre` | `base` + muted palette | Brainstorms, informal, whiteboard |
| **Blueprint** | `classic` | `elk` | `base` + monochrome | Complex systems, architecture, 10+ nodes |

Each preset exercises a distinct Mermaid axis -- Classic: proven palette, Sketch: look mode, Blueprint: layout engine. No preset is a trivial variation of another.

**Why these three:**
- **Classic** is our existing identity -- proven for print, colorblind-safe (Wong/Okabe-Ito palette, still gold standard as of 2026)
- **Sketch** fills the brainstorm/informal gap -- hand-drawn look is perfect for ideas-in-progress
- **Blueprint** uses ELK's compact layout for complex diagrams that overflow with dagre

**Why NOT `look: neo`:** `neo` does not exist in the open-source Mermaid library. It is exclusive to the commercial Mermaid Chart SaaS product. The `look` enum only has `classic` and `handDrawn`.

**Diagram type caveat:** Sketch and Blueprint visual effects only apply to flowcharts and state diagrams. For all other diagram types, the preset's color palette is applied but the look/layout silently falls back to classic/dagre.

### Architecture

```
plugins/cortex-engineering/skills/mermaid-diagrams/
  references/
    default-theme.json          # Classic preset (add look + layout fields)
    sketch-theme.json           # NEW - handDrawn look, muted palette
    blueprint-theme.json        # NEW - ELK layout, monochrome
    default-theme.md            # UPDATE - document all 3 presets, add TOC
    styling-patterns.md         # UPDATE - reference preset system
    print-optimization.md       # UPDATE - preset-specific export notes
    syntax-reference.md         # NO CHANGE
```

**Architecture validated (6 reviewers):**
- 3 separate JSON files is correct -- maps 1:1 to `mmdc -c` CLI. A merged config would require a build step.
- Flat `references/` at 7 files (3 JSON + 4 markdown) scales fine. A subdirectory would break `$CLAUDE_PLUGIN_ROOT` paths.
- Config duplication (~5 shared lines) is acceptable for 3 files. No merge system needed.
- Skill boundaries are clean: visualize owns UX, mermaid-diagrams owns knowledge. No cross-skill implementation coupling.

## Technical Approach

### Phase 1: Create New Config Files

**File: `default-theme.json`** (existing -- add two fields)

Add `"look": "classic"` and `"layout": "dagre"` at the top level. All existing themeVariables, flowchart, and mindmap settings remain identical.

**Opportunistic fix (separate commit):** Darken `highlight` stroke from `#C4B800` to `#8A8200` (current fails 3:1 against white at 2.06:1). This is a pre-existing bug, not part of the preset feature.

**File: `sketch-theme.json`** (NEW)

Design direction: warm, parchment-like tones. `look: handDrawn`, `handDrawnSeed: 42`, `curve: basis`. Dark text (#333) on light fills for print readability. Use `default-theme.json` as the template, then modify themeVariables to the muted palette.

**Sketch accessibility rules:**
- Darken all borders 25-30% from fills (rough.js jitter reduces effective stroke width to ~60-70% of nominal)
- Use `strokeWidth: 3` minimum in classDef (compensates for rough.js contrast dilution)
- Use blue-family for info (e.g., #A3B5CD dusty blue), NOT green -- breaks green-green confusion pair for deuteranopia/protanopia

**File: `blueprint-theme.json`** (NEW)

Design direction: monochrome (white/gray/black). `look: classic`, `layout: elk`, `curve: linear` for straight edges. Tighter spacing (nodeSpacing: 50, padding: 16). ELK config: `mergeEdges: true`, `nodePlacementStrategy: "NETWORK_SIMPLEX"`.

**Blueprint accessibility rules:**
- Differentiate danger from primary using `stroke-dasharray:3` + `stroke-width:4px`
- Darken warning border to #777777 (current #999999 fails 3:1 against #F5F5F5 fill)
- Consider third dasharray pattern (`8,4` long dash) for accent -- gives 3 distinguishable border patterns

**Minimum Mermaid version:** All three configs require Mermaid v11+ for `look`, `layout`, and `handDrawnSeed`. Add a note to `default-theme.md`.

Each preset gets a matching classDef block documented in default-theme.md.

### Phase 2: Update Visualize Skill

**This phase replaces the existing step 2 (confirmation) entirely.** The current step 2 combines paper size selection with diagram type override. The new step 2 is a fast-path confirmation with sub-prompts.

**Edit: `skills/visualize/SKILL.md` step 2 (confirmation) -- REPLACE**

```
> "I'll generate a **mind map** for **YAML Frontmatter Research**."
> Defaults: A4, Classic style.
>
> 1. Go (use defaults)
> 2. A3 landscape (wall poster)
> 3. Change style (Sketch / Blueprint)
> 4. Change diagram type
```

**Follow-up flows (one decision at a time):**

If user picks **2** (A3): Set paper to A3, proceed to step 3. No further questions.

If user picks **3** (Change style): Show preset sub-prompt, then return to main flow:
```
> 1. Classic - bold colors, clean lines (default)
> 2. Sketch - hand-drawn, warm tones (flowcharts + state only)
> 3. Blueprint - monochrome, compact ELK layout (flowcharts + state only)
```
After preset selection, proceed to step 3. If diagram type is NOT flowchart/state and user picked Sketch or Blueprint, show one-line note:
> "Note: hand-drawn/ELK only affects flowcharts and state diagrams. Your [type] will use [preset] colors with classic rendering."

If user picks **4** (Change diagram type): Show current auto-detected type and ask what to change it to. After selection, proceed to step 3 (do NOT loop back to step 2 -- the user has made their choices).

**Edit: `skills/visualize/SKILL.md` step 3 (generate)**

Add preset-aware classDef selection:

```
Use the classDef block matching the chosen preset:
- Classic: semantic classDef block from default-theme.md
- Sketch: muted classDef block from default-theme.md
- Blueprint: monochrome classDef block from default-theme.md
```

**Edit: `skills/visualize/SKILL.md` step 4 (export)**

Replace hardcoded config path with preset-selected path:

| Preset | Config file |
|--------|-------------|
| Classic (default) | `default-theme.json` |
| Sketch | `sketch-theme.json` |
| Blueprint | `blueprint-theme.json` |

```bash
bunx @mermaid-js/mermaid-cli -i diagram.mmd -o diagram.svg \
  -c "$CLAUDE_PLUGIN_ROOT/skills/mermaid-diagrams/references/<PRESET>-theme.json" \
  -b white -w <WIDTH> -H <HEIGHT>
```

Where `<PRESET>` is `default`, `sketch`, or `blueprint` based on user choice.

**Step 5 (save) -- NO CHANGE.** `preset`/`paper` frontmatter storage is deferred (YAGNI). The `.mmd` file already contains the classDef block, and re-render defaults to Classic + A4 which is correct behavior.

### Phase 3: Update Mermaid-Diagrams Skill

**Edit: `skills/mermaid-diagrams/SKILL.md`**

Update the "Locked visual identity" language:

BEFORE:
```
**Locked visual identity:** All diagrams use the [default-theme.json](...) config...
```

AFTER:
```
**Curated visual identity:** All diagrams use one of three preset configs. Each preset pairs a theme, look mode, and layout engine. See [default-theme.md](...) for the full specification.
```

Update Quick Start to show the default (classic) preset with a note about alternatives.

**Edit: `references/default-theme.md`**

Major update -- document all 3 presets:
- Add table of contents (file is already over 100 lines -- skill authoring convention)
- Rename "Locked Visual Identity" heading to "Curated Visual Identity"
- Add preset comparison table
- Add classDef blocks for each preset
- Add one-sentence diagram type compatibility note: "`look: handDrawn` and `layout: elk` only apply to flowcharts and state diagrams. All other types silently fall back to classic/dagre with the preset's color palette."
- Keep the type auto-detection table (unchanged)
- Add Mermaid v11 minimum version note

**Edit: `references/print-optimization.md`**

Add preset-specific notes:
- Classic: standard export commands (unchanged)
- Sketch: `handDrawnSeed` ensures reproducible output; hand-drawn borders print well at 300 DPI (vector paths survive rasterization); laser printing > inkjet for best results
- Blueprint: ELK layout with `mergeEdges: true` produces tighter output; may need A3 for 15+ node diagrams; straight edges (`curve: linear`) print cleaner than curved

**Edit: `references/styling-patterns.md`**

Update the "Consistent Style Patterns" note to reference presets instead of init directives.

### Phase 4: Version Bump

Bump patch version in `plugins/cortex-engineering/.claude-plugin/plugin.json` to satisfy marketplace validation (files added to plugin).

### Phase 5: Verify

1. Export each preset with a flowchart (confirms configs work, ELK layout, handDrawn rendering)
2. Export Sketch with a sequence diagram (confirms graceful fallback -- palette applies, look/layout ignored)
3. Run `bun run validate` (confirms no structural breakage)

## Acceptance Criteria

- [x] 3 JSON config files exist in `references/`: `default-theme.json`, `sketch-theme.json`, `blueprint-theme.json`
- [x] `default-theme.json` adds `"look": "classic"` and `"layout": "dagre"` at top level; `highlight` stroke darkened to #8A8200
- [x] Visualize skill step 2 uses fast-path confirmation (defaults to A4 + Classic with single keypress)
- [x] Style sub-prompt includes "(flowcharts + state only)" caveat for Sketch and Blueprint
- [x] Follow-up flows for options 3 and 4 are specified (one decision at a time, then proceed)
- [x] Visualize skill step 4 uses the selected preset's config file for export
- [x] Each preset has a matching classDef block documented in `default-theme.md`
- [x] Sketch classDef uses `stroke-width:3px` minimum and borders darkened 25-30% from fills
- [x] Sketch info classDef uses a blue-family color (not green -- colorblind safety)
- [x] Blueprint danger class uses `stroke-dasharray:3` + `stroke-width:4px` (distinguishable from primary)
- [x] Blueprint warning border darkened to #777777
- [x] "Locked visual identity" language replaced with "curated visual identity" across all files
- [x] No `%%{init:}%%` directives in generated diagrams (rule unchanged -- presets are via `-c`)
- [x] `bun run validate` passes after all changes
- [x] All 3 presets produce valid SVG/PDF output via mmdc
- [x] Non-flowchart diagrams gracefully fallback to classic look with preset colors
- [x] Plugin version bumped (patch)

## Implementation Order

| Phase | Files | Effort |
|-------|-------|--------|
| 1. Config files | `default-theme.json` (add fields + fix highlight), `sketch-theme.json` (NEW), `blueprint-theme.json` (NEW) | Small |
| 2. Visualize skill | `skills/visualize/SKILL.md` (step 2 replace, steps 3-4 update) | Medium |
| 3. Mermaid-diagrams skill | `SKILL.md`, `default-theme.md`, `print-optimization.md`, `styling-patterns.md` | Medium |
| 4. Version bump | `plugin.json` | Trivial |
| 5. Verify | 3 export tests + validate | Small |

## What's NOT in This Plan

- **`look: neo` preset** -- does not exist in open-source Mermaid (Mermaid Chart SaaS only)
- **`preset`/`paper` frontmatter storage** -- deferred to v2 if re-render friction emerges. Re-render works via `.mmd` file today.
- **Frontmatter skill update** -- not needed since `preset`/`paper` fields are deferred
- **Custom user themes** -- future `theme` field in cortex config.yaml (noted in the global-docs-plan as a deferred item)

## Decisions Made

- **Keep `default-theme.json` name** (simpler) rather than rename to `classic-theme.json` -- avoids breaking 6+ file references
- **3 presets, not unlimited** -- curated choices reduce cognitive load (ADHD-friendly); each exercises a distinct Mermaid axis
- **Presets are config files, not init directives** -- maintains the no-`%%{init:}%%` rule
- **`handDrawnSeed: 42`** -- deterministic hand-drawn output for reproducible builds; any positive integer works
- **ELK is blueprint-only** -- dagre is better for simple diagrams; ELK shines with 10+ nodes
- **Blueprint uses `NETWORK_SIMPLEX`** -- most compact, balanced placement for architecture diagrams
- **Blueprint uses `curve: "linear"`** -- straight edges for the technical drawing aesthetic
- **Blueprint uses `mergeEdges: true`** -- reduces visual clutter in complex diagrams
- **No auto-selection of preset** -- user always chooses (classic is default). Auto-selection is too opinionated for v1
- **Fast-path confirmation UX** -- single keypress for defaults; style choice is a sub-prompt behind "Change style" option
- **Defer `preset`/`paper` frontmatter** -- YAGNI; re-render works via `.mmd` file + default to Classic + A4
- **Darken Sketch borders 25-30%, strokeWidth: 3px** -- compensate for rough.js contrast dilution
- **Change Sketch info to blue-family** -- break green-green confusion pair for deuteranopia/protanopia
- **Fix Classic `highlight` stroke opportunistically** -- current #C4B800 fails 3:1 against white

## Deepening History

<details>
<summary>Round 1 (5 agents) and Round 2 (6 agents) -- click to expand</summary>

**Round 2 -- 6 parallel agents:** Mermaid v11 schema verification, WCAG accessibility deep-dive, architecture strategist, code simplicity reviewer, skill authoring audit (6/7 pass), pattern consistency checker.

**Key corrections from round 2:**
- `look: neo` does not exist in open-source Mermaid -- only `classic` and `handDrawn`
- `cycleBreakingStrategy` default is `GREEDY_MODEL_ORDER` (not `GREEDY`)
- `considerModelOrder` default is `NODES_AND_EDGES` (not `NONE`) -- redundant to set
- `NETWORK_SIMPLEX` is better than `LINEAR_SEGMENTS` for architecture diagrams
- Existing Classic palette has a compliance gap (`highlight` stroke)

**YAGNI cuts applied:** `preset`/`paper` frontmatter, Preset Authoring Checklist, `considerModelOrder` config, 12-row compatibility matrix (replaced with sentence), 10 test cases (compressed to 3), Community Intelligence section.

**Round 1 -- 5 agents:** Mermaid v11 research, color accessibility, architecture review, simplicity review, skill authoring patterns.

</details>

## Sources

- **Origin brainstorm:** docs/brainstorms/2026-02-28-visualize-skill-brainstorm.md
- **Mermaid v11 config schema:** https://mermaid.js.org/config/schema-docs/config.html
- **Mermaid v11 look property:** https://mermaid.js.org/config/schema-docs/config-properties-look.html (only `classic` and `handDrawn`)
- **Mermaid theming:** https://mermaid.js.org/config/theming.html (only `base` theme supports full themeVariables)
- **ELK config properties:** https://mermaid.js.org/config/schema-docs/config-properties-elk.html
- **handDrawnSeed:** https://mermaid.js.org/config/schema-docs/config-properties-handdrawnseed.html
- **Config file init wrapper bug (#5357):** https://github.com/mermaid-js/mermaid/issues/5357
- **handDrawn limitation (#7058):** https://github.com/mermaid-js/mermaid/issues/7058
- **Neo look is SaaS-only:** https://docs.mermaidchart.com/blog/posts/mermaid-innovation-introducing-new-looks-for-mermaid-diagrams
- **WCAG 2.1 SC 1.4.11 Non-text Contrast:** https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html
- **G209 technique (border contrast):** https://www.w3.org/WAI/WCAG21/Techniques/general/G209
- **WCAG contrast checker:** https://webaim.org/resources/contrastchecker/
- **Color accessibility:** https://sronpersonalpages.nl/~pault/ (Paul Tol's schemes), https://clauswilke.com/dataviz/avoid-line-drawings.html
- **Rough.js algorithms:** https://shihn.ca/posts/2020/roughjs-algorithms/
- **Community research (newsroom):** Reddit (r/SideProject, r/javascript), Cursor CLI changelog, mermaid-ascii -- 2026-03-01
