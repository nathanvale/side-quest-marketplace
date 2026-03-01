---
description: Generates Mermaid diagrams from any document, topic, or concept. Use when someone wants to visualize, diagram, or map out anything.
argument-hint: "<path, topic, or concept>"
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
---

# Visualize

Generate Mermaid diagrams from any document, topic, or concept. Export as print-ready SVG/PDF.

**Companion skill:** The **mermaid-diagrams** skill provides Mermaid syntax, styling patterns, the locked visual identity, and print optimization knowledge. It loads automatically. This skill handles the workflow.

## Workflow

### 1. Determine source

Resolve from `$ARGUMENTS`:

1. Try as a file path first. If it exists, read it.
2. If not a file, treat as a topic string.
3. No argument: check conversation for the most recent Cortex doc, then ask the user.

**Re-render shortcut:** If the source is an existing diagram (`type: diagram` with a `source` field in frontmatter), read the existing `.mmd` file and skip to step 4 (export).

### 2. Auto-detect and confirm

Auto-detect diagram type from content (see type detection table in the mermaid-diagrams skill's default-theme reference). Present confirmation with paper size as a numbered list:

> "I'll generate a **mind map** for **YAML Frontmatter Research**."
> 1. A4 landscape (desk/home printer)
> 2. A3 landscape (wall poster)
> 3. Change diagram type

Default: 1 (A4). If user picks 3, ask: "What type of diagram would you prefer?" Do not re-suggest the same type.

### 3. Generate Mermaid

Write Mermaid source directly. Rules:

- Include the semantic classDef block from the mermaid-diagrams skill (except mind maps -- use node shapes only)
- NO `%%{init:}%%` directives (config file handles theme)
- NO `click`, `callback`, or `href` directives (security)
- If source content exceeds 15 nodes: summarize into key concepts first

**Checkpoint:** Save `index.md` (with frontmatter via the **cortex-engineering-frontmatter** skill) and `diagram.mmd` BEFORE attempting export.

### 4. Export

Run mmdc with the locked theme config. Use the paper size from step 2:

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

**First-run note:** mmdc downloads Chromium (~150MB) on first use. If this fails, try system Chrome fallback. See the mermaid-diagrams skill's default-theme reference for troubleshooting.

### 5. Save

Save to `docs/diagrams/YYYY-MM-DD-<topic-slug>/`:

- `index.md` -- Mermaid source with frontmatter (via **cortex-engineering-frontmatter** skill)
- `diagram.mmd` -- raw Mermaid source (for re-rendering)
- `diagram.svg` -- screen/print viewing
- `diagram.pdf` -- direct printing

**Topic slug:** lowercase, a-z/0-9/hyphens only, max 80 chars. Strip special characters, collapse whitespace to hyphens, trim leading/trailing hyphens. NEVER interpolate raw user input into shell commands -- sanitize the slug first, then use it in `mkdir -p`.

**Collision:** if folder exists, ask the user:

> 1. Overwrite existing
> 2. Create versioned copy (-v2, -v3)

Create `docs/diagrams/` with `mkdir -p` if needed.

**What goes where:** `diagram.mmd` contains the full Mermaid source INCLUDING classDef lines. The `-c` config file provides theme variables (colors, fonts, spacing) -- separate from classDef. `index.md` embeds the same Mermaid in a fenced code block alongside YAML frontmatter.

### 6. Report and open

Report all file paths. Mention the chosen paper size ("Print the PDF at A4/A3"). Offer to open:

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
---
created: 2026-03-01
title: "Plugin Architecture Diagram"
type: diagram
tags: [architecture, cortex, mermaid]
project: side-quest-marketplace
status: draft
source: docs/brainstorms/2026-02-28-visualize-skill-brainstorm.md
---
```

## Key Principles

- **Visual context is instant** -- diagrams on the wall mean zero cognitive ramp-up
- **Knowledge compounds** -- diagrams evolve alongside research and brainstorms
- **Graceful degradation** -- always save the Mermaid source, even if export fails
- **Confirm before generating** -- always ask, never auto-invoke
- **Locked visual identity** -- one theme, one palette, zero styling decisions
