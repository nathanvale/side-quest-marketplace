---
title: "Rebuild Visualize Skill with Locked Visual Identity"
type: plan
status: completed
created: 2026-03-01
origin: docs/brainstorms/2026-02-28-visualize-skill-brainstorm.md
reviewed: 2026-03-01
deepened: 2026-03-01
---

# Rebuild Visualize Skill with Locked Visual Identity

## Overview

Rebuild the existing `visualize-cortex-knowledge` skill to leverage the new `mermaid-diagrams` knowledge skill. The rebuild keeps the `visualize` name, stays Cortex-first (but can visualize anything), locks in a consistent visual identity with zero user decisions on styling, and switches from unreliable MCP export to mmdc CLI as the primary export path.

This is driven by Nathan's ADHD -- every diagram should look the same without thinking about it. Consistent type detection, one palette, one theme, one font size. Customization is a future feature.

> Origin: `docs/brainstorms/2026-02-28-visualize-skill-brainstorm.md`
> Previous plan: `docs/plans/2026-02-28-feat-add-visualize-skill-plan.md` (status: final)

## Problem Statement

1. **No visual consistency** -- the current skill has templates but no locked-in defaults. Every diagram can look different.
2. **MCP export is unreliable** -- `export_diagram_formats` produces placeholder files. The skill defaults to MCP-first when mmdc CLI is reliable.
3. **Duplicated knowledge** -- `diagram-templates.md` and `print-guide.md` are now fully superseded by the `mermaid-diagrams` skill.
4. **Too many choices** -- user is asked about diagram type, theme, paper size. For ADHD, decisions are cognitive load.

## Proposed Solution

### Two-layer consistency model

**Layer 1: Locked visual identity (never changes)**
- Theme: `base` with Wong palette themeVariables (NOT `neutral` -- neutral silently ignores themeVariables, GitHub #4264)
- Font size: `16px` (always)
- Palette: Wong colorblind-safe (always)
- classDef block: 7 semantic classes injected into every diagram source (except mind maps -- node shapes only)
- Max 15 nodes per diagram (summarize before diagramming if content exceeds this)
- Edge labels on all non-obvious connections
- No `%%{init:}%%` directives in diagram source -- config file is the single source of truth

**Layer 2: Smart type detection (auto-selected, user confirms yes/no)**
- Diagram type auto-detected from content and frontmatter type (not a menu of options)
- Direction (TD/LR) auto-selected from diagram type
- Node shapes semantically mapped (databases get cylinders, decisions get diamonds)
- User sees: "I'll generate a **mind map** for **Plugin Architecture**. OK?" -- not a type picker
- Always confirm, even with file path arguments (one yes/no question is low cognitive load)

**Paper size choice (A4 or A3):**
- User picks paper size at confirmation time (step 2), bundled with diagram type -- one interaction
- A4 landscape: 3508 x 2480px (default -- home printer, desk reference)
- A3 landscape: 4961 x 3508px (wall poster, team board)
- Affects `-w` and `-H` mmdc viewport flags only -- everything else stays the same

**No further overrides.** No theme picker, no custom dimensions.

### Architecture change

```
BEFORE (current):
  visualize/SKILL.md          -- workflow + some craft knowledge
  visualize/references/        -- duplicated templates + print guide
  mermaid-diagrams/SKILL.md   -- comprehensive craft knowledge (NEW)

AFTER (rebuilt):
  visualize/SKILL.md          -- workflow only (NO references/ directory)
  mermaid-diagrams/SKILL.md   -- comprehensive craft knowledge (updated)
  mermaid-diagrams/references/
    default-theme.json        -- mmdc config file (locked visual identity)
    default-theme.md          -- documentation of the locked visual identity
    styling-patterns.md       -- (existing, updated: base vs neutral guidance)
    syntax-reference.md       -- (existing, unchanged)
    print-optimization.md     -- (existing, updated: base theme in examples)
```

**Cross-skill delegation:** The visualize SKILL.md references the mermaid-diagrams skill **by name**, never by file path. The mermaid-diagrams skill's progressive disclosure loads its references when diagram generation is detected. The mmdc `-c` flag necessarily uses a runtime file path (resolved via `$CLAUDE_PLUGIN_ROOT`) -- this is distinct from the delegation-by-name principle which applies to SKILL.md prose.

**Config precedence:** Init directives in diagram source override the `-c` config file. Therefore, generated diagrams must NEVER contain `%%{init:}%%` directives. The `default-theme.json` config file is the single source of truth for theme. Init directives in reference docs (syntax-reference.md, styling-patterns.md) are educational examples and should remain.

### JSON config file: `default-theme.json`

mmdc config with Wong palette themeVariables and flowchart/mindmap layout settings:

```json
{
  "theme": "base",
  "themeVariables": {
    "primaryColor": "#0072B2",
    "primaryTextColor": "#ffffff",
    "primaryBorderColor": "#005a8c",
    "secondaryColor": "#56B4E9",
    "secondaryTextColor": "#000000",
    "secondaryBorderColor": "#2A8ABF",
    "tertiaryColor": "#E69F00",
    "tertiaryTextColor": "#000000",
    "tertiaryBorderColor": "#b87d00",
    "lineColor": "#333333",
    "textColor": "#333333",
    "background": "#FFFFFF",
    "noteBkgColor": "#F0E442",
    "noteTextColor": "#333333",
    "noteBorderColor": "#C4B800",
    "edgeLabelBackground": "#FFFFFF",
    "clusterBkg": "#F5F5F5",
    "clusterBorder": "#666666",
    "errorBkgColor": "#D55E00",
    "errorTextColor": "#FFFFFF",
    "fontFamily": "Helvetica, Arial, sans-serif",
    "fontSize": "16px"
  },
  "flowchart": {
    "curve": "basis",
    "nodeSpacing": 60,
    "rankSpacing": 60,
    "padding": 20,
    "diagramPadding": 30,
    "htmlLabels": true,
    "useMaxWidth": false,
    "wrappingWidth": 200
  },
  "mindmap": {
    "useMaxWidth": false,
    "padding": 20
  }
}
```

**Design notes:** Sky Blue (`#56B4E9`) as secondary creates a dark blue -> light blue -> orange visual hierarchy; green is preserved as the `success` classDef. JSON must be flat -- no `"init"` wrapper (#5357). `htmlLabels: true` is required for classDef text color (#6209). `wrappingWidth` only applies to backtick-delimited labels; subgraph labels ignore it (#6110). Full gotcha details go in `default-theme.md`.

### Semantic classDef block (injected into every diagram source)

```
classDef primary fill:#0072B2,stroke:#005a8c,color:#fff,stroke-width:2px
classDef info fill:#56B4E9,stroke:#2A8ABF,color:#000,stroke-width:2px
classDef success fill:#009E73,stroke:#006B4F,color:#fff,stroke-width:2px
classDef warning fill:#E69F00,stroke:#B37A00,color:#000,stroke-width:2px
classDef danger fill:#D55E00,stroke:#A34800,color:#fff,stroke-width:2px
classDef highlight fill:#F0E442,stroke:#C4B800,color:#000,stroke-width:3px
classDef accent fill:#CC79A7,stroke:#A35E85,color:#000,stroke-width:2px
```

White text on dark fills (primary, success, danger); black text on light fills (info, warning, highlight, accent). Unstyled nodes inherit `primaryColor` as an implicit 8th state. Avoid `classDef default` (#684). Mind maps don't support classDef -- use node shapes only. Full usage notes go in `default-theme.md`.

## Technical Approach

### New file: `skills/mermaid-diagrams/references/default-theme.json`

The mmdc config file (JSON from "Proposed Solution" section above). Used via `mmdc -c default-theme.json`.

### New file: `skills/mermaid-diagrams/references/default-theme.md`

Documents the locked visual identity (for Claude to read when generating diagrams):

1. **Why `base` theme, not `neutral`** -- neutral ignores themeVariables. Base is the blank slate.
2. **No init directives rule** -- generated diagrams must not contain `%%{init:}%%`. Config file handles it.
3. **Semantic classDef block** -- 7 classes, copy-paste ready. Note: mind maps don't support classDef.
4. **Diagram type auto-detection table:**

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

5. **Node shape mapping** -- semantic role -> Mermaid syntax
6. **Paper sizes** -- A4 landscape (3508 x 2480px) or A3 landscape (4961 x 3508px), both at 300 DPI. SVG has no intrinsic DPI -- the width/height set the Puppeteer viewport for layout. A4 is the default.
7. **mmdc export commands** -- exact flags using `-c default-theme.json`
8. **mmdc troubleshooting** -- first-run Chromium download, system Chrome fallback, bunx cache corruption fix

### Rebuilt file: `skills/visualize/SKILL.md`

```yaml
description: Generates Mermaid diagrams from any document, topic, or concept and exports print-ready SVG/PDF via mmdc CLI. Auto-detects diagram type. Use when someone wants to visualize, diagram, or create a visual of anything.
argument-hint: "<document path, topic, or concept>"
disable-model-invocation: true
allowed-tools:
  - Bash(bunx *)
  - Bash(open *)
  - Bash(mkdir *)
  - Read
  - Glob
  - Grep
  - Write
  - Task
```

**Frontmatter decisions:**
- `name` omitted -- defaults to directory name `visualize`, matching the command router
- `disable-model-invocation: true` -- skill writes files, runs mmdc (downloads Chromium), opens apps. Must be user-initiated only.
- `Bash(cortex *:*)` removed -- workflow uses Write tool for saving files, not cortex CLI. Frontmatter delegation to cortex-engineering-frontmatter skill happens via prose, not shell commands.

6-step workflow:

1. **Determine source** -- `$ARGUMENTS` file path, topic string, or conversation context. Cortex docs are primary (checks `type` frontmatter), but any document or topic works.

   Input disambiguation: try to resolve as a file path first. If it doesn't exist as a file, treat as a topic string. No argument: check conversation for recent Cortex doc, then ask user.

   **Re-render shortcut:** If the source is an existing diagram (`type: diagram` with a `source` field in frontmatter), read the existing `.mmd` file and skip to step 4 (export).

2. **Auto-detect and confirm** -- Apply the type detection table from the mermaid-diagrams skill. Present confirmation with paper size as a plain text prompt (no `AskUserQuestion` -- must work in Codex and agent-to-agent contexts):

   > "I'll generate a **mind map** for **YAML Frontmatter Research**."
   > 1. A4 landscape (desk/home printer)
   > 2. A3 landscape (wall poster)
   > 3. Change diagram type

   Default: 1 (A4). If user picks 3, ask: "What type of diagram would you prefer?" Do not re-suggest the same type. Paper size choice carries forward to a second prompt.

3. **Generate Mermaid** -- Write Mermaid source. Rules:
   - Include the semantic classDef block (except mind maps -- use node shapes only)
   - NO `%%{init:}%%` directives (config file handles theme)
   - NO `click`, `callback`, or `href` directives (security -- these execute JS in browsers)
   - If source content exceeds 15 nodes: summarize into key concepts first

   **Checkpoint:** Save `index.md` (with frontmatter) and `diagram.mmd` BEFORE attempting export. This ensures the source is preserved even if mmdc crashes.

4. **Export** -- Run mmdc with `-c` pointing to default-theme.json (resolved via `$CLAUDE_PLUGIN_ROOT`). Use the paper size selected in step 2:

   | Paper | `-w` | `-H` |
   |-------|------|------|
   | A4 landscape | 3508 | 2480 |
   | A3 landscape | 4961 | 3508 |

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

   Fallback chain: SVG + PDF -> SVG only -> .mmd source only. Always report what succeeded.

   **On syntax error:** Retry generation once with the error message as context. If still invalid, save .mmd source only and report the error.

   **If `bunx --bun` fails:** Drop the `--bun` flag (Puppeteer has native Node.js dependencies that Bun may not resolve).

   **First-run note:** mmdc downloads Chromium (~150MB) on first use. If this fails, try system Chrome fallback via `-p puppeteer-config.json` with `"executablePath": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.

5. **Save** -- `docs/diagrams/YYYY-MM-DD-<topic-slug>/` with:
   - `index.md` -- Mermaid source with frontmatter (via cortex-engineering-frontmatter)
   - `diagram.mmd` -- raw Mermaid source (for re-rendering)
   - `diagram.svg` -- screen/print viewing
   - `diagram.pdf` -- direct printing

   Topic slug: lowercase, a-z/0-9/hyphens only, max 80 chars. Strip special characters, collapse whitespace to hyphens, trim leading/trailing hyphens. NEVER interpolate raw user input into shell commands -- sanitize the slug first, then use it in `mkdir -p`. Examples: "YAML Frontmatter Research" -> `yaml-frontmatter-research`, "Plugin Architecture (v2)" -> `plugin-architecture-v2`, "C4 Model -- System Context" -> `c4-model-system-context`.

   Collision: if folder exists, ask the user whether to overwrite or create a versioned copy (`-v2`, `-v3`).

   Create `docs/diagrams/` with `mkdir -p` if needed. For non-Cortex use: save to project root `docs/diagrams/` if in a git repo, otherwise ask the user.

6. **Report and open** -- Report all file paths. Mention the chosen paper size ("Print the PDF at A4/A3"). Offer macOS `open` (SVG in browser, PDF in Preview, folder in Finder). Say: "Diagram saved to `docs/diagrams/YYYY-MM-DD-<topic>/`".

**Example invocations** (for the SKILL.md):

```
# File path argument (Cortex doc)
/cortex-engineering:visualize docs/research/2026-03-01-mermaid-theming.md

# Topic string (no file)
/cortex-engineering:visualize plugin loading architecture

# No argument (uses conversation context)
/cortex-engineering:visualize
```

**What goes where:** `diagram.mmd` contains the full Mermaid source INCLUDING classDef lines (they're part of the diagram syntax). The `-c` config file provides theme variables (colors, fonts, spacing) -- these are separate from classDef. `index.md` embeds the same Mermaid content in a fenced code block alongside YAML frontmatter for Cortex indexing.

### Files to delete

- `skills/visualize/references/diagram-templates.md`
- `skills/visualize/references/print-guide.md`
- `skills/visualize/references/` (directory)

### Files to create

- `skills/mermaid-diagrams/references/default-theme.json`
- `skills/mermaid-diagrams/references/default-theme.md`

### Files to modify

- `skills/visualize/SKILL.md` -- complete rewrite (6-step workflow)
- `skills/mermaid-diagrams/SKILL.md` -- update line 9 cross-reference ("the visualize skill provides the workflow"), add default-theme note, reconcile neutral vs base guidance, update palette table to note semantic classDef names supersede it, update line 179 `export_diagram_formats` reference to recommend mmdc primary
- `skills/mermaid-diagrams/references/styling-patterns.md` -- add base vs neutral section; reconcile dual-palette conflict (lines 75-80 use `#2c5f8a` while lines 140-147 use Wong `#0072B2` -- same semantic names, different hex values; standardize on Wong palette)
- `skills/mermaid-diagrams/references/print-optimization.md` -- update mmdc recipes with `-c` config file, update MCP Server Warning section (lines 212-218) to note mmdc is now the primary path
- `commands/visualize.md` -- update description and allowed-tools (add `Bash(bunx *)`, `Bash(open *)`, `Bash(mkdir *)`; remove `Bash(cortex *:*)`). Remains as user-facing entry point since skill has `disable-model-invocation: true`.
- `.claude-plugin/plugin.json` -- bump version `0.2.0` -> `0.3.0`

### Files unchanged

- `skills/mermaid-diagrams/references/syntax-reference.md`
- `skills/research/SKILL.md` -- already references `/cortex-engineering:visualize`
- `skills/brainstorm/SKILL.md` -- already references `/cortex-engineering:visualize`

## Acceptance Criteria

- [x] `skills/visualize/SKILL.md` rewritten with 6-step workflow (references/ directory removed)
- [x] `default-theme.json` created with `theme: "base"` and Wong palette
- [x] `default-theme.md` created with visual identity docs
- [x] `commands/visualize.md` updated with all required allowed-tools
- [x] Cross-references updated (mermaid-diagrams SKILL.md, styling-patterns.md, print-optimization.md)
- [x] `plugin.json` version bumped to `0.3.0`
- [x] `bun run validate` passes
- [x] No stale references to deleted files (grep check)
- [x] No `%%{init:}%%` in visualize skill workflow

## Implementation Order

### Phase 1: Create theme files

1. Write `skills/mermaid-diagrams/references/default-theme.json`
2. Write `skills/mermaid-diagrams/references/default-theme.md`

### Phase 2: Rebuild skill and command

3. Rewrite `skills/visualize/SKILL.md` and delete `skills/visualize/references/`
4. Update `commands/visualize.md`

### Phase 3: Cross-references and validation

5. Update mermaid-diagrams files (SKILL.md, styling-patterns.md, print-optimization.md)
6. Bump `plugin.json` to `0.3.0`
7. Run `bun run validate` and grep for stale references

## Verification

- `bun run validate` passes clean
- `grep -r "diagram-templates" plugins/cortex-engineering/` returns nothing
- `grep -r "print-guide" plugins/cortex-engineering/` returns nothing
- `grep -r "%%{init:" plugins/cortex-engineering/skills/visualize/` returns nothing
- `grep -r "lepion\|mcp-server-mermaid" plugins/cortex-engineering/skills/visualize/` returns nothing
- `default-theme.json` contains `"theme": "base"`
- `visualize/references/` directory does not exist

## Sources

- **Origin brainstorm:** [docs/brainstorms/2026-02-28-visualize-skill-brainstorm.md](docs/brainstorms/2026-02-28-visualize-skill-brainstorm.md)
- **Previous plan:** [docs/plans/2026-02-28-feat-add-visualize-skill-plan.md](docs/plans/2026-02-28-feat-add-visualize-skill-plan.md)
- **Mermaid knowledge skill:** `plugins/cortex-engineering/skills/mermaid-diagrams/SKILL.md`
- **MCP export issue:** MEMORY.md -- `export_diagram_formats` writes placeholder files; mmdc CLI is reliable
- **Research (2026-03-01):** 2 rounds, 10 agents -- base vs neutral fix (GitHub #4264), config precedence, classDef limitations, cross-skill delegation patterns, Wong palette verification, mmdc Puppeteer gotchas
- **Technical review (2026-03-01):** 5 reviewers -- simplified from 7 to 5 steps, removed YAGNI (structured result block, pie/timeline colors), fixed auto-invocation heuristic (always confirm), added syntax error recovery, trimmed to 9 acceptance criteria
- **Deepening round 3 (2026-03-01):** 5 agents -- mmdc CLI flag validation (--scale no-op for SVG, --pdfFit camelCase confirmed, -H 3508 added), classDef + config layering (inline styles win, htmlLabels required, classDef default unreliable #684), A3 print export (SVG no DPI concept, PDF embeds font subsets, --pdfFit overrides page size), cross-reference audit (9 files with visualize refs, lepion/MCP refs in 3 files), topic slug spec (a-z/0-9/hyphens, max 80 chars)
- **Deepening round 4 (2026-03-01):** 10 agents (full deepen-plan) -- agent-native architecture, create-agent-skills audit, architecture strategist, pattern recognition, code simplicity, agent-native reviewer, spec flow analyzer, security sentinel, Context7 Mermaid docs, repo research. Key patches: argument-hint added, description trimmed, "no" confirmation behavior defined, click/callback/href prohibition, slug sanitization, checkpoint before export, re-render existing diagrams, collision reverted to ask-user, dual-palette conflict flagged, concrete examples added, .mmd-is-unstyled documented, completion signal added
- **Mermaid issues referenced:** #4264 (neutral ignores themeVariables), #5357 (config must be flat, no init wrapper), #684 (classDef default unreliable), #6110 (wrappingWidth ignored for subgraphs), quarto-dev #6209 (htmlLabels required for classDef text color)
