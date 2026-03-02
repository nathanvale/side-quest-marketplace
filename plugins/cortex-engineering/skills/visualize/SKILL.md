---
name: visualize
description: Generates diagrams from any document, topic, or concept. Routes mind maps to Markmap, everything else to Mermaid. Use when someone wants to visualize, diagram, or map out anything.
argument-hint: "<path, topic, or concept>"
disable-model-invocation: true
allowed-tools:
  - Bash(bunx *)
  - Bash(node *)
  - Bash(open *)
  - Bash(mkdir *)
  - Bash(rm *.html)
  - Read
  - Glob
  - Grep
  - Write
---

# Visualize

Generate diagrams from any document, topic, or concept. Mind maps auto-route to Markmap for superior visual quality; all other diagram types use Mermaid. Export as print-ready SVG/PDF.

**Companion skills:**
- **mermaid-diagrams** -- auto-loaded background knowledge for Mermaid craft. Consult only when you need specific info (classDef blocks in step 3, export commands in step 4).
- **Markmap reference** (`engine-routing.md` in `visualize/references/`) -- theming config and known issues. Consult when generating mind maps via Markmap.

## Quick Start

```
/cortex-engineering:visualize docs/research/2026-03-01-some-topic.md
```

Provide a file path, topic string, or invoke with no argument to use conversation context. The skill auto-detects diagram type, routes to the appropriate engine, and exports to SVG/PDF.

## Workflow

### 1. Determine source

Resolve from `$ARGUMENTS`:

1. Try as a file path first. If it exists, read it.
2. If not a file, treat as a topic string.
3. No argument: check conversation for the most recent Cortex doc, then ask the user.

**Re-render shortcut:** If the source is an existing diagram directory (index.md with `type: diagram` in frontmatter):
- Read `index.md` frontmatter for `engine:` field
- If `engine: markmap`: read `mindmap.mmd` as markdown, use Markmap pipeline (step 4)
- If `engine: mermaid` or absent: read `.mmd` file as Mermaid syntax, use mmdc pipeline (step 4)
- If directory contains multiple `.mmd` files: list them and ask which to re-render

### 2. Auto-detect and confirm

Auto-detect diagram type from content (see type detection table in the mermaid-diagrams skill's default-theme reference). **Engine routing:** If the detected type is `mindmap`, default engine is Markmap. All other types default to Mermaid.

Present fast-path confirmation:

**For mind maps (Markmap default):**

> "I'll generate a **mind map** for **[Topic]**."
> Defaults: A4, Markmap engine.
>
> 1. Go (use defaults)
> 2. A3 landscape (wall poster)
> 3. Change style (Classic only for Markmap)
> 4. Change diagram type
> 5. Change engine (currently: Markmap)

**For all other diagram types (Mermaid, no engine option):**

> "I'll generate a **[type]** for **[Topic]**."
> Defaults: A4, Classic style.
>
> 1. Go (use defaults)
> 2. A3 landscape (wall poster)
> 3. Change style (Sketch / Blueprint)
> 4. Change diagram type

Option 5 only appears when the auto-detected type supports multiple engines (currently only mind maps).

**Follow-up flows (one decision at a time):**

If user picks **1** (Go): Use defaults, proceed to step 3.

If user picks **2** (A3): Set paper to A3, proceed to step 3.

If user picks **3** (Change style):

For Mermaid engine:
> 1. Classic - bold colors, clean lines (default)
> 2. Sketch - hand-drawn, warm tones (flowcharts + state only)
> 3. Blueprint - monochrome, compact ELK layout (flowcharts + state only)

For Markmap engine: show one-line note:
> "Markmap uses Classic colors (Okabe-Ito palette); hand-drawn/ELK modes are Mermaid-only."

After preset selection, proceed to step 3. If diagram type is NOT flowchart/state and user picked Sketch or Blueprint, show one-line note:

> "Note: hand-drawn/ELK only affects flowcharts and state diagrams. Your [type] will use [preset] colors with classic rendering."

If user picks **4** (Change diagram type): Show current auto-detected type and ask what to change it to. After selection, proceed to step 3 (do NOT loop back to step 2).

If user picks **5** (Change engine, mind maps only): Show engine sub-prompt:
> 1. Markmap - curved branches, auto-colors, beautiful (default)
> 2. Mermaid - basic shapes, themed presets (Classic/Sketch/Blueprint)

After selection, proceed to step 3.

### 3. Generate diagram source

#### Mermaid engine (all non-mind-map types, or mind map with Mermaid override)

Write Mermaid source directly. Rules:

- Include the classDef block matching the chosen preset from the mermaid-diagrams skill's default-theme reference (Classic: semantic, Sketch: muted, Blueprint: monochrome). Except mind maps -- use node shapes only.
- NO `%%{init:}%%` directives (config file handles theme)
- NO `click`, `callback`, or `href` directives (security)
- If source content exceeds 15 nodes: summarize into key concepts first
- Keep labels to 1-2 short lines using `<br/>` (not backtick syntax). Move verbose detail to edge labels or index.md.
- For subgraphs with multiline titles: add an invisible spacer node (see mermaid-diagrams skill's config-engineering reference)

#### Markmap engine (mind maps)

Write standard markdown with heading-based hierarchy. Rules:

- Root topic as `# Heading`
- Branches as `##`, `###`, etc.
- Max 3-5 main branches for readability
- If source content exceeds 15 leaf nodes: summarize into key concepts first
- Include Markmap JSON options in YAML frontmatter (see `engine-routing.md` reference for the Okabe-Ito color config)

**Checkpoint:** Save `<type>.mmd` BEFORE attempting export. Save `index.md` using the detection logic in step 5 (first-write or append mode). Use the **frontmatter** skill for correct YAML frontmatter.

### 4. Export

#### Mermaid engine

Run mmdc with the preset's theme config. Use the paper size from step 2:

| Paper | `-w` | `-H` |
|-------|------|------|
| A4 landscape | 3508 | 2480 |
| A3 landscape | 4961 | 3508 |

| Preset | Config file |
|--------|-------------|
| Classic (default) | `default-theme.json` |
| Sketch | `sketch-theme.json` |
| Blueprint | `blueprint-theme.json` |

```bash
# SVG (primary)
bunx @mermaid-js/mermaid-cli -i <type>.mmd -o <type>.svg \
  -c "$CLAUDE_PLUGIN_ROOT/skills/mermaid-diagrams/references/<PRESET>-theme.json" \
  -b white -w <WIDTH> -H <HEIGHT>

# PDF (secondary -- requires --cssFile for correct text colors)
bunx @mermaid-js/mermaid-cli -i <type>.mmd -o <type>.pdf \
  -c "$CLAUDE_PLUGIN_ROOT/skills/mermaid-diagrams/references/<PRESET>-theme.json" \
  --cssFile "$CLAUDE_PLUGIN_ROOT/skills/mermaid-diagrams/references/pdf-print-fix.css" \
  -b white -w <WIDTH> -H <HEIGHT> --pdfFit
```

Where `<PRESET>` is `default`, `sketch`, or `blueprint` based on the user's choice in step 2.

**If `bunx` fails:** Try `npx -p @mermaid-js/mermaid-cli mmdc` instead (Puppeteer has native Node.js dependencies that Bun may not resolve).

**First-run note:** mmdc downloads Chromium (~150MB) on first use. If this fails, try system Chrome fallback. See the mermaid-diagrams skill's default-theme reference for troubleshooting.

#### Markmap engine

Two-step pipeline: generate HTML with markmap-cli, then extract SVG + PDF with Puppeteer. See `engine-routing.md` reference for full details.

```bash
# Step 1: Generate HTML with embedded SVG
bunx markmap-cli --no-open --no-toolbar --offline -o mindmap.html mindmap.mmd

# Step 2: Extract SVG + print PDF via Puppeteer
node "$CLAUDE_PLUGIN_ROOT/skills/visualize/references/export-markmap.mjs" \
  mindmap.html mindmap \
  --css "$CLAUDE_PLUGIN_ROOT/skills/visualize/references/markmap-theme.css"

# Step 3: Clean up intermediate HTML
rm mindmap.html
```

Produces: `mindmap.svg` + `mindmap.pdf`

**If `bunx` fails:** Try `npx markmap-cli` instead.

#### Fallback chain (both engines)

SVG + PDF -> SVG only -> .mmd source only. Always report what succeeded.

**On syntax error (Mermaid):** Retry generation once with the error message as context. If still invalid, save .mmd source only and report the error.

**No cross-engine fallback.** If Markmap fails, do NOT silently fall back to Mermaid. Report the failure and let the user choose.

### 5. Save

Save to `docs/diagrams/YYYY-MM-DD-<topic-slug>/`:

- `index.md` -- diagram source with frontmatter (via **frontmatter** skill)
- `<type>.mmd` -- raw diagram source (for re-rendering)
- `<type>.svg` -- screen/print viewing
- `<type>.pdf` -- direct printing

**Type-to-slug-to-label mapping** -- resolve `<type>` file slug and `## <Label>` section heading from the diagram type:

| Diagram type | File slug | Section heading label |
|---|---|---|
| flowchart / graph | `flowchart` | Flowchart |
| sequence | `sequence` | Sequence Diagram |
| class | `class` | Class Diagram |
| state | `state` | State Diagram |
| erDiagram | `er` | Entity-Relationship Diagram |
| gantt | `gantt` | Gantt Chart |
| pie | `pie` | Pie Chart |
| mindmap | `mindmap` | Mind Map |
| timeline | `timeline` | Timeline |
| architecture | `architecture` | Architecture Diagram |
| block | `block` | Block Diagram |
| quadrant | `quadrant` | Quadrant Chart |
| sankey | `sankey` | Sankey Diagram |
| xychart | `xychart` | XY Chart |
| gitGraph | `git` | Git Graph |
| C4Context | `c4` | C4 Context Diagram |
| kanban | `kanban` | Kanban Board |
| packet | `packet` | Packet Diagram |
| requirement | `requirement` | Requirement Diagram |
| radar | `radar` | Radar Chart |

**Label fallback:** If the diagram type is not in the table, derive the label by Title Casing the file slug (e.g. `waterfall` -> `## Waterfall`).

**Topic slug:** lowercase, a-z/0-9/hyphens only, max 80 chars. Strip special characters, collapse whitespace to hyphens, trim leading/trailing hyphens. NEVER interpolate raw user input into shell commands -- sanitize the slug first, then use it in `mkdir -p`.

Create `docs/diagrams/` with `mkdir -p` if needed.

**What goes where:** `<type>.mmd` contains the full diagram source. For Mermaid: includes classDef lines; the `-c` config file provides theme variables separately. For Markmap: includes YAML frontmatter with color/spacing options. `index.md` embeds the same source in a fenced code block alongside YAML frontmatter.

**Engine field:** When using Markmap, add `engine: markmap` to the `index.md` YAML frontmatter. This enables correct re-render detection in step 1. Omit for Mermaid (default).

#### index.md write protocol

Every `index.md` for `type: diagram` uses `## <Label>` section headings from the first write. Each section contains exactly: the fenced code block and an `**Export:**` annotation line. A section spans from its `## ` heading to the next `## ` heading or EOF.

**Code block language tag by engine:**
- Mermaid: ` ```mermaid `
- Markmap: ` ```markmap ` (enables Obsidian's markmap plugin for inline preview)

**Export annotation format:**
- Mermaid: `**Export:** Classic theme, A4 landscape.`
- Markmap: `**Export:** Markmap engine, A4 landscape.`

**Detection logic** -- before writing index.md:

1. Check if `index.md` exists in the target directory
2. If no: **FIRST WRITE** -- create with uniform `## <Label>` section structure
3. If yes: read frontmatter
   - If frontmatter has `type: diagram`: **APPEND MODE**
     - Check if a `## <Label>` heading matching this type already exists
     - If yes: REPLACE that section's content (fenced block + export note)
     - If no: append new `## <Label>` section after last diagram section
     - Add source to `source:` list if not already present
     - Set `updated:` date
   - Otherwise: confirm overwrite with user, then first-write

#### Collision handling

Multiple diagram types coexist in the same directory without collision (e.g. `class.mmd` and `er.mmd`). Only prompt for collision when the **same type slug** already exists:

> 1. Overwrite existing
> 2. Create versioned copy (-v2, -v3)

When "Overwrite existing" is chosen for a same-type collision:
- Replace the `<type>.mmd` file with new Mermaid source
- Replace the `<type>.svg` and `<type>.pdf` with new exports
- Find and replace the matching `## <Label>` section in index.md (fenced block + export note)
- If the section doesn't exist in index.md, append it

### 6. Report and open

Report all file paths. Mention the engine used and the chosen paper size (e.g. "Markmap mind map, print the PDF at A4"). For Markmap exports, add: "The SVG renders best in a browser; use the PDF for printing." Offer to open:

> 1. Open diagram (SVG in browser)
> 2. Open in Preview (PDF for print preview)
> 3. Open folder (Finder)
> 4. Skip

Use macOS `open` command.

Say: "Diagram saved to `docs/diagrams/YYYY-MM-DD-<topic>/`".

## Examples

```
# File path argument (Cortex doc)
/cortex-engineering:visualize docs/research/2026-03-01-mermaid-theming.md

# Topic string (no file)
/cortex-engineering:visualize plugin loading architecture

# No argument (uses conversation context)
/cortex-engineering:visualize
```

## Example Frontmatter

```yaml
# Mermaid diagram (engine field omitted -- default)
---
created: 2026-03-01
title: "Plugin Architecture Diagram"
type: diagram
tags: [architecture, cortex, mermaid]
project: side-quest-marketplace
status: draft
source:
  - docs/brainstorms/2026-02-28-visualize-skill-brainstorm.md
---
```

```yaml
# Markmap mind map (engine field explicit)
---
created: 2026-03-01
title: "Cortex Engineering Mind Map"
type: diagram
engine: markmap
tags: [architecture, cortex, mindmap]
project: side-quest-marketplace
status: draft
source:
  - docs/research/2026-03-01-cortex-overview.md
---
```

## Success Criteria

- [ ] Diagram source saved as `<type>.mmd` (always, even if export fails)
- [ ] `index.md` saved with valid YAML frontmatter
- [ ] SVG and/or PDF exported successfully (or fallback reported)
- [ ] All files saved to `docs/diagrams/YYYY-MM-DD-<topic-slug>/`
- [ ] User informed of file paths and print paper size

## Key Principles

- **Visual context is instant** -- diagrams on the wall mean zero cognitive ramp-up
- **Knowledge compounds** -- diagrams evolve alongside research and brainstorms
- **Graceful degradation** -- always save the diagram source, even if export fails
- **Confirm before generating** -- always ask, never auto-invoke
- **Curated visual identity** -- three presets, zero manual styling decisions
