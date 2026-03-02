---
created: 2026-03-01
updated: 2026-03-02
title: "Mind Map Engine Routing with Export Parity and Theme Alignment"
type: plan
tags: [cortex, visualize, mindmap, markmap, mermaid, export, theming]
project: cortex-engineering
status: completed
origin: docs/brainstorms/2026-03-01-mindmap-engine-routing-brainstorm.md
---

> Origin: docs/brainstorms/2026-03-01-mindmap-engine-routing-brainstorm.md
> Planning basis: Local repo research + existing in-repo mind map research + targeted vendor-doc verification (Markmap docs, Mermaid docs, npm package state)

# feat: Mind Map Engine Routing with Export Parity and Theme Alignment

## Enhancement Summary

**Deepened on:** 2026-03-02
**Review agents used:** code-simplicity-reviewer, architecture-strategist, pattern-recognition-specialist, spec-flow-analyzer, skill-authoring specialist, markmap-cli researcher

### Key Improvements

1. **Export pipeline identified as #1 risk** -- markmap-cli outputs HTML only. SVG/PDF requires custom Puppeteer scripting. No maintained wrappers exist. Plan restructured to spike this first before any skill documentation work.
2. **Plan complexity reduced ~60%** -- 6 phases collapsed to 3 (spike, implement, validate). Config precedence chain simplified -- no config system exists yet, so routing is auto-default + user override at confirmation prompt.
3. **Source file naming collision resolved** -- `mindmap.md` conflicts with Cortex `.md` convention. Decision: use `mindmap.mmd` with `engine:` frontmatter field to distinguish rendering engine.
4. **Skill structure decision: start lean** -- Markmap knowledge lives in `visualize/references/engine-routing.md` initially (YAGNI). Promote to separate `markmap-diagrams` companion skill when craft knowledge exceeds ~100 lines.
5. **New frontmatter field: `engine:`** -- added to diagram doc type for reliable re-render detection. Optional, defaults to `mermaid`.

### New Considerations Discovered

- Markmap's JSON styling options have no `fontFamily`, `fontSize`, or `backgroundColor` -- font styling requires `extraCss` injection
- Sketch and Blueprint presets are Mermaid-specific (handDrawn look, ELK layout). Markmap gets one style only (Classic colors via Okabe-Ito palette). Preset selection hidden for Markmap with a one-line note.
- Engine switch on existing directory leaves orphaned source file (different syntax). Collision handling must account for cross-engine overwrites.
- `markmap-cli` version 0.18.12 is current. All markmap packages are version-locked.
- The fenced code block in index.md should use ````markmap` language tag (enables Obsidian's markmap plugin for inline preview)

### Export Pipeline: Proven Approach

Markmap is "HTML-first" by design -- the CLI generates an HTML page containing the SVG (rendered by markmap-view in the browser). Native SVG/PDF export isn't a first-class feature. The reliable approach is to **productize the Puppeteer extraction step**:

1. `markmap-cli` -> HTML (with embedded SVG rendered by D3/markmap-view)
2. Puppeteer opens the HTML -> extracts the `<svg>` element -> saves as `.svg`
3. Puppeteer prints the page -> saves as `.pdf`

This works because markmap-view renders an actual SVG in-browser, so Puppeteer can "steal" it. We already have Puppeteer as a dependency (mermaid-cli uses it). The script is ~15 lines and the approach is well-understood in the community.

**To productize:** Pin the Chromium version (already handled by mermaid-cli's Puppeteer), add the export script to the plugin, and add a small regression check that output isn't blank.

## Overview

Add first-class multi-engine mind map support to the visualize workflow by auto-routing mind map requests to Markmap by default while preserving Mermaid for non-mind-map diagram types. Keep a single user-facing experience with mandatory export parity (`SVG` + `PDF` + source artifacts), and align mind map styling with existing design-system and diagram theme conventions.

This plan directly carries forward brainstorm decisions (see brainstorm: docs/brainstorms/2026-03-01-mindmap-engine-routing-brainstorm.md): hybrid routing, configurable engine selection, export parity, optional Obsidian benefits, and theme consistency.

## Problem Statement / Motivation

Current mind map output quality is constrained by Mermaid mind map limitations, which produces lower visual quality than purpose-built mind map renderers. At the same time, users should not have to care which engine was used, and should not lose existing print/export workflows.

We need to improve mind map quality without introducing lock-in or cognitive overhead:
- Better defaults for mind map visuals.
- Explicit engine choice for advanced users.
- Same export contract and paths regardless of engine.

## Research Consolidation

### Repository Findings
- Visualize workflow currently centers on Mermaid generation and `mmdc` export in the visualize skill: `plugins/cortex-engineering/skills/visualize/SKILL.md`.
- Mermaid-diagrams skill codifies print-safe presets and export constraints: `plugins/cortex-engineering/skills/mermaid-diagrams/SKILL.md`.
- Design-system skill defines shared spacing/color/contrast tokens that should inform mind map theming: `plugins/cortex-engineering/skills/design-system/SKILL.md`.

### Institutional Learnings
- `docs/solutions/` is not present in this repository, so no institutional solution documents were available to carry forward.

### Existing Internal Research
- `docs/research/2026-02-28-mind-map-rendering-tools.md` already establishes:
  - Markmap is preferred for mind map visual quality.
  - Mermaid remains strong for non-mind-map diagrams.
  - Markmap export requires a dedicated pipeline for SVG/PDF parity.

### Targeted External Verification (2026-03-01)
- Markmap docs confirm:
  - `markmap-cli` produces HTML output only (`--output` HTML), so SVG/PDF parity requires Puppeteer.
  - JSON/frontmatter options support style controls (`color`, spacing, line width) usable for design-system alignment.
  - No `fontFamily`, `fontSize`, or `backgroundColor` in JSON options -- font styling requires `extraCss`.
- npm package metadata confirms active Markmap ecosystem releases (`markmap-cli` 0.18.12, all packages version-locked).
- Mermaid docs still mark `mindmap` as experimental, reinforcing the default routing decision to Markmap for mind-map quality.

### Deepen Pass Research (2026-03-02)

**Markmap CLI verified capabilities:**
- Output: HTML only (interactive page with D3.js + markmap-view)
- No built-in SVG or PDF export
- CLI invocation: `bunx markmap-cli --no-open --no-toolbar --offline -o mindmap.html input.md`
- JSON options: `color`, `colorFreezeLevel`, `spacingHorizontal` (default 80), `spacingVertical` (default 5), `maxWidth`, `lineWidth`, `initialExpandLevel`
- No maintained SVG/PDF wrappers exist. `md2mm-svg` (3 commits, 1 star) is abandoned.
- SVG extraction requires: open HTML in Puppeteer, query the SVG element from DOM, serialize to file
- PDF export requires: open HTML in Puppeteer, `page.pdf()` with print settings

## Proposed Solution

Implement a hybrid engine-routing model for visualize:

1. **Auto-routing**
- Detect `mindmap` diagram intent and default engine to Markmap.
- Keep Mermaid default for all non-mind-map diagram types.
- Preserve user override at the step 2 confirmation prompt.

2. **Engine selection (simplified)**
- Auto-default: Markmap for mind maps, Mermaid for everything else.
- User override: option 5 in the step 2 confirmation prompt (mind maps only).
- No persistent config until the unified config system ships. When it does, add `mindmap_engine: markmap | mermaid` to `config.yaml`.

3. **Unified output contract (mandatory parity)**
- Normalize output artifacts across engines:
  - Source file: `mindmap.mmd` (Markmap source is markdown, but `.mmd` maintains the "diagram source" convention; `engine:` frontmatter field distinguishes the renderer)
  - `mindmap.svg`
  - `mindmap.pdf`
  - `index.md` entry with `## Mind Map` section heading
- Users receive identical artifact expectations regardless of engine.

4. **Theme alignment**
- Markmap gets one style: Classic colors via Okabe-Ito palette from design-system skill.
- Sketch and Blueprint presets are Mermaid-specific -- not applicable to Markmap. Show one-line note: "Markmap uses Classic colors; hand-drawn/ELK modes are Mermaid-only."
- Concrete Markmap theme: `color: ['#0072B2', '#009E73', '#E69F00', '#D55E00', '#56B4E9', '#CC79A7', '#F0E442']`

## Alternative Approaches Considered

### A) Full abstraction-first multi-engine platform
- Rejected for now: more architecture than needed for current scope (YAGNI), slower time-to-value.

### B) Obsidian-first specialized flow
- Rejected: risks perceived lock-in. Obsidian support is optional and out of scope for this plan.

### C) Hybrid routing with explicit overrides (Chosen)
- Chosen for fast quality gains + flexibility + low cognitive load.
- Carries forward exact brainstorm direction (see brainstorm: docs/brainstorms/2026-03-01-mindmap-engine-routing-brainstorm.md).

### D) Separate markmap-diagrams companion skill (Deferred)
- Architecture strategist recommended creating a parallel skill following the mermaid-diagrams pattern.
- Skill authoring reviewer recommended YAGNI -- start with `visualize/references/engine-routing.md`.
- **Decision: start lean.** Create the companion skill when Markmap craft knowledge exceeds ~100 lines or multiple skills need to reference it.

## Technical Approach

### Phase 0: Export Pipeline Spike (MUST DO FIRST)

**Validate the Puppeteer extraction approach before any skill documentation work.**

#### Pipeline

```bash
# Step 1: Generate HTML with embedded SVG
bunx markmap-cli --no-open --no-toolbar --offline -o mindmap.html input.md

# Step 2: Extract SVG + print PDF via Puppeteer
node export-markmap.mjs mindmap.html mindmap
# Produces: mindmap.svg + mindmap.pdf
```

#### Export script (`export-markmap.mjs`)

```javascript
import { promises as fs } from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const htmlPath = process.argv[2];              // e.g. mindmap.html
const outBase  = process.argv[3] || "mindmap"; // e.g. mindmap

const absHtml = "file://" + path.resolve(htmlPath);

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.goto(absHtml, { waitUntil: "networkidle0" });

// Grab the rendered SVG
const svg = await page.$eval("svg", el => el.outerHTML);
await fs.writeFile(`${outBase}.svg`, svg, "utf8");

// Print to PDF
await page.pdf({
  path: `${outBase}.pdf`,
  format: "A4",
  landscape: true,
  printBackground: true,
  margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
});

await browser.close();
```

#### Spike tasks

- [x] Run the pipeline on a sample markdown mind map
- [x] Validate SVG quality: readable text, correct colors, proper sizing for A4/A3
- [x] Validate PDF quality: print-ready, correct text colors (no grey-text issue -- markmap renders natively with `printBackground: true`)
- [x] Test with `--offline` flag (inlines all JS/CSS assets -- required for file:// URLs)
- [x] Verify Puppeteer reuses mermaid-cli's Chromium (no second download)
- [x] Document any timing issues (D3 animation completion before SVG extraction)

#### Spike results (2026-03-02)

**Branch:** `spike/markmap-export` | **Files:** `spike/markmap-export/`

| Step | Command | Output | Size |
|------|---------|--------|------|
| Markdown -> HTML | `bunx markmap-cli --no-open --no-toolbar --offline -o mindmap.html sample.md` | mindmap.html | 335KB |
| HTML -> SVG + PDF | `node export-markmap.mjs mindmap.html mindmap` | mindmap.svg, mindmap.pdf | 32KB, 49KB |

**SVG structure:** 51 `<g>` groups, 48 `<path>` elements, 49 `<foreignObject>` elements (markmap uses foreignObject for text, not `<text>` elements). All content from sample.md present and readable.

**PDF quality:** 1-page A4 landscape. All nodes readable, colorful Okabe-Ito branch lines, proper hierarchy. Dark background (markmap default).

**Key findings:**
1. **`--offline` flag is essential** -- without it, the HTML references CDN URLs that fail with `file://` protocol in Puppeteer
2. **1-second delay needed** -- markmap uses D3 transitions (requestAnimationFrame). The script waits 1s after `waitForSelector('svg')` to let animations complete
3. **Puppeteer reuses mermaid-cli's Chromium** -- cached at `~/.cache/puppeteer/chrome`, no second download
4. **No grey-text issue** -- unlike Mermaid PDF export, markmap's `printBackground: true` renders colors correctly without needing a CSS fix
5. **Dark background is markmap's default** -- for print, may want to inject `extraCss` to set white background. Not blocking -- dark looks good on screen
6. **foreignObject rendering** -- markmap uses HTML-in-SVG via foreignObject rather than SVG `<text>`. This means the extracted SVG depends on a browser for full rendering (not a pure SVG). For print-ready output, PDF is the better format

**Spike exit criteria:**
- SVG + PDF both produce print-quality output: proceed to Phase 1 with full parity.
- SVG works but PDF quality is poor: proceed with SVG-only Markmap + PDF via Mermaid fallback.
- Neither works reliably: keep Markmap for interactive HTML, Mermaid for all static exports.

**Script location after spike:** `plugins/cortex-engineering/skills/visualize/references/export-markmap.mjs` -- becomes the basis for export instructions in the skill.

### Phase 1: Implement Routing and Export

After the spike validates the pipeline:

- [x] Create `visualize/references/engine-routing.md` with:
  - Markmap CLI invocation commands (from spike)
  - SVG extraction pipeline (from spike)
  - PDF export pipeline (from spike)
  - Markmap JSON options for theming (Okabe-Ito colors, spacing)
  - Fallback matrix (same as Mermaid: SVG+PDF -> SVG only -> source only)
  - Known issues and workarounds
- [x] Update `visualize/SKILL.md`:
  - Step 1: extend re-render shortcut to detect both `.mmd` files with `engine: markmap` metadata
  - Step 2: add one-liner about mind map auto-routing + option 5 (engine override, mind maps only)
  - Step 2: add note about Sketch/Blueprint being Mermaid-only for mind maps
  - Step 4: add Markmap export block referencing `engine-routing.md`
  - Step 5: document `engine:` field in index.md frontmatter and Export annotation
  - Step 6: add engine name to success report
- [x] Update `frontmatter/SKILL.md`:
  - Add `engine:` field to diagram doc type (optional, defaults to `mermaid`)
- [x] Update `mermaid-diagrams/SKILL.md`:
  - Add scope clarification: "Mermaid remains the engine for all non-mind-map diagram types"
- [x] Create Markmap theme config (JSON or CSS in `visualize/references/`):
  - Okabe-Ito colors: `['#0072B2', '#009E73', '#E69F00', '#D55E00', '#56B4E9', '#CC79A7', '#F0E442']`
  - `spacingHorizontal: 48` (design-system `xl`)
  - `spacingVertical: 16` (design-system `sm`)
  - `maxWidth: 300`

#### Updated confirmation prompt (step 2, mind maps only)

```
> "I'll generate a **mind map** for **[Topic]**."
> Defaults: A4, Markmap engine.
>
> 1. Go (use defaults)
> 2. A3 landscape (wall poster)
> 3. Change style (Classic only for Markmap)
> 4. Change diagram type
> 5. Change engine (currently: Markmap)
```

Option 5 only appears when the auto-detected diagram type supports multiple engines (currently only mind maps). Follow-up shows:

```
> 1. Markmap - curved branches, auto-colors, beautiful (default)
> 2. Mermaid - basic shapes, themed presets (Classic/Sketch/Blueprint)
```

#### index.md section format for Markmap

```markdown
## Mind Map

```markmap
# Topic
## Branch 1
### Leaf
## Branch 2
```

**Export:** Markmap engine, A4 landscape.
```

The ````markmap` language tag enables Obsidian's markmap plugin for inline preview.

#### Source file convention

Use `mindmap.mmd` as the source filename (maintains the `.mmd` = diagram source convention). The `engine: markmap` field in index.md frontmatter distinguishes the renderer. The file content is standard markdown with heading-based hierarchy, not Mermaid syntax.

#### Re-render detection (step 1)

When the source is an existing diagram directory:
1. Read `index.md` frontmatter for `engine:` field
2. If `engine: markmap`: read `mindmap.mmd` as markdown, use Markmap pipeline
3. If `engine: mermaid` or absent: read `mindmap.mmd` as Mermaid syntax, use mmdc pipeline
4. If multiple `.mmd` files: list them and ask which to re-render (existing behavior)

#### Fallback chain

- Markmap: SVG+PDF -> SVG only -> source only. Same structure as Mermaid.
- `bunx` to `npx` fallback for markmap-cli (same Puppeteer native-module issue may apply).
- **No cross-engine fallback.** If Markmap fails, do NOT silently fall back to Mermaid mind map. Report the failure and let the user choose. Silent engine switching defeats the quality purpose.

### Phase 2: Validation

- [ ] `auto` + mind map -> Markmap route
- [ ] explicit Mermaid override + mind map -> Mermaid route
- [ ] non-mind-map + any -> Mermaid route (engine option not shown)
- [ ] Markmap path creates source + SVG + PDF
- [ ] Mermaid mindmap path creates source + SVG + PDF (unchanged)
- [ ] Re-render with engine metadata correctly routes to prior engine
- [ ] Existing non-mind-map exports unchanged
- [ ] Output directory structure and naming compatible
- [ ] `bun run validate` passes

## System-Wide Impact

- **Interaction graph:**
  - Visualize command -> diagram type detection -> engine resolution -> engine-specific generation/export -> common artifact persistence.
- **Error propagation:**
  - Engine-specific export failures converge into the shared fallback/reporting path. No cross-engine fallback.
- **State lifecycle risks:**
  - Partial exports may leave incomplete artifact sets; fallback chain preserves what succeeded.
  - Engine switch on existing directory leaves orphaned source file if syntax differs.
- **API surface parity:**
  - Mind map behavior appears through visualize command and its skill workflow docs; both must stay consistent.
  - Engine option only appears for diagram types with multiple engines (currently only mind maps).

## Acceptance Criteria

### Functional Requirements
- [x] Mind map requests auto-route to Markmap by default
- [x] Users can override engine at step 2 confirmation prompt (option 5)
- [x] Non-mind-map diagrams continue to default to Mermaid (no engine option shown)
- [x] Output contract is engine-agnostic: source + SVG + PDF

### Export Parity Requirements
- [x] Markmap pipeline produces SVG and PDF outputs (validated by spike)
- [x] Fallback behavior is documented and deterministic
- [x] Output location and naming conventions are consistent (`mindmap.mmd`, `mindmap.svg`, `mindmap.pdf`)

### UX & Theming Requirements
- [x] User-facing messaging does not require knowing internal engine details
- [x] Markmap theming uses Okabe-Ito palette from design-system skill
- [x] Sketch/Blueprint presets show one-line note for Markmap ("hand-drawn/ELK modes are Mermaid-only")

### Documentation & Schema Requirements
- [x] `engine:` field added to diagram frontmatter in frontmatter skill
- [x] `engine-routing.md` reference file created in visualize skill
- [x] Export annotation in index.md includes engine name
- [x] Version bump to 0.5.0 (minor -- new capability)

### Quality Gates
- [x] Export pipeline spike completed and documented
- [x] `bun run validate` passes
- [ ] Manual scenario checks cover routing, override, and fallback (Phase 2 -- user testing)

## Dependencies & Risks

### Dependencies
- Existing visualize/mermaid skill architecture and export conventions.
- Markmap CLI (0.18.12) for HTML generation.
- Puppeteer (already a dependency via mermaid-cli) for SVG/PDF extraction.
- Existing design-system token guidance.

### Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| ~~Markmap SVG/PDF extraction produces poor print quality~~ | ~~High~~ | **RESOLVED by spike** -- PDF renders correctly with `printBackground: true`. SVG uses foreignObject (browser-dependent) but PDF is print-ready. |
| Puppeteer SVG extraction is fragile (DOM timing, D3 animation) | Medium | Use `--no-open --no-toolbar` flags. Wait for D3 transitions to complete. Document known issues. |
| `mindmap.mmd` contains markdown, not Mermaid -- confusing | Low | `engine:` frontmatter field is the source of truth. Document clearly. |
| Config system doesn't exist yet for persistent engine preference | Low | Defer to unified config plan. Use auto-default + prompt override for now. |
| Markmap has no equivalent of Sketch/Blueprint presets | Low | One style only (Classic colors). Show one-line note for unavailable presets. |

## Implementation Task Checklist

- [x] **Spike:** Validate Markmap SVG/PDF export pipeline with Puppeteer
- [x] **Spike:** Document exact CLI commands and scripts
- [x] Update `plugins/cortex-engineering/skills/visualize/SKILL.md` (steps 1, 2, 4, 5, 6)
- [x] Create `plugins/cortex-engineering/skills/visualize/references/engine-routing.md`
- [x] Create Markmap theme config file in `visualize/references/`
- [x] Update `plugins/cortex-engineering/skills/frontmatter/SKILL.md` (add `engine:` field)
- [x] Update `plugins/cortex-engineering/skills/mermaid-diagrams/SKILL.md` (scope clarification)
- [x] Bump version to 0.5.0 in `plugins/cortex-engineering/.claude-plugin/plugin.json`
- [x] Run `bun run validate`
- [x] Update this plan checkboxes during implementation (`[ ]` -> `[x]`)

## Post-Deploy Monitoring & Validation

No additional operational monitoring required: this change is plugin workflow/config behavior with no production service runtime in this repository.

Validation ownership and window:
- Owner: feature implementer/reviewer pair.
- Window: during implementation PR and pre-merge validation run.

## Sources & References

### Origin
- **Brainstorm document:** [docs/brainstorms/2026-03-01-mindmap-engine-routing-brainstorm.md](/Users/nathanvale/code/side-quest-marketplace/docs/brainstorms/2026-03-01-mindmap-engine-routing-brainstorm.md)
  - Carried-forward decisions:
  - Markmap default for mind maps.
  - Mandatory export parity.
  - Configurable engine selection.

### Internal References
- [plugins/cortex-engineering/skills/visualize/SKILL.md](/Users/nathanvale/code/side-quest-marketplace/plugins/cortex-engineering/skills/visualize/SKILL.md)
- [plugins/cortex-engineering/skills/mermaid-diagrams/SKILL.md](/Users/nathanvale/code/side-quest-marketplace/plugins/cortex-engineering/skills/mermaid-diagrams/SKILL.md)
- [plugins/cortex-engineering/skills/design-system/SKILL.md](/Users/nathanvale/code/side-quest-marketplace/plugins/cortex-engineering/skills/design-system/SKILL.md)
- [docs/research/2026-02-28-mind-map-rendering-tools.md](/Users/nathanvale/code/side-quest-marketplace/docs/research/2026-02-28-mind-map-rendering-tools.md)

### External References (Verified 2026-03-02)
- Markmap docs: https://markmap.js.org/docs/markmap
- Markmap CLI docs: https://markmap.js.org/docs/packages--markmap-cli
- Markmap JSON options: https://markmap.js.org/docs/json-options
- Markmap npm package: https://www.npmjs.com/package/markmap-cli (v0.18.12)
- Markmap SVG export issue #66: https://github.com/markmap/markmap/issues/66 (open since 2021)
- Mermaid mindmap docs: https://mermaid.js.org/syntax/mindmap.html (still experimental)

### Alternatives Considered for Export

| Option | Verdict | Why |
|---|---|---|
| Markmap + Puppeteer extraction | **Chosen** | Automation + versioned markdown source-of-truth. Puppeteer already a dependency. ~15 line script. |
| MindNode (Mac GUI) | Rejected | No headless CLI. Click-to-export doesn't fit automated workflows. |
| XMind (GUI + CLI) | Rejected | Markdown import exists but export is GUI-driven. Not automatable. |
| Mermaid mindmap only | Rejected | Inferior visual quality is the whole reason for this plan. |

### What Was Cut (from original plan)

- **Obsidian compatibility section** -- explicitly out of scope per brainstorm. Removed to reduce cognitive load.
- **4-level config precedence chain** -- no config system exists yet. Simplified to auto-default + user override.
- **Phases 1, 5 (Foundation, Backward Compatibility)** -- no foundation to build, nothing to migrate from. These were architecture vocabulary applied to a markdown file edit.
- **Validation matrix as separate phase** -- integrated into Phase 2 as a checklist.
- **Separate markmap-diagrams companion skill** -- deferred until craft knowledge grows. Start with `visualize/references/engine-routing.md`.
