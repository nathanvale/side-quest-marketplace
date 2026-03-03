---
created: 2026-03-03
title: "kb-mpe - Markdown Preview Enhanced Knowledge Bank Plugin"
type: plan
tags: [kb-mpe, knowledge-bank, markdown-preview-enhanced, mpe, vscode, plugin-convention]
project: marketplace
status: draft
origin:
  - Conversation: MPE setup session (2026-03-03) -- configured settings, GitHub dark mode CSS, explored features
---

> Origin: Conversation where Nathan set up MPE in VS Code, configured GitHub dark mode, explored features, and identified the need for opt-in knowledge bank plugins to manage the ~40 skill context budget.

# feat: kb-mpe - Markdown Preview Enhanced Knowledge Bank Plugin

## Overview

Create the first `kb-*` (knowledge bank) plugin in the marketplace. This establishes the convention for toggle-on/off reference knowledge plugins that don't consume context budget when disabled.

## Problem Statement

The ~40 skill context budget means every always-on skill competes for slots. Reference knowledge for tools like MPE, Obsidian, Tailwind, etc. shouldn't be always-on -- it should activate only when relevant and be easy to disable. The marketplace needs a convention for these opt-in knowledge modules.

## Plugin Tier Convention (Established in This PR)

| Tier | Prefix | Lifecycle | Examples |
|------|--------|-----------|---------|
| Core | none | Always-on, foundational | `cortex-engineering` |
| Knowledge bank | `kb-*` | Toggle per-session | `kb-mpe`, `kb-obsidian`, `kb-tailwind` |
| Developer experience | `dx-*` | Toggle per-project | `dx-biome`, `dx-git` (future rename) |
| Integration | `int-*` | Toggle as needed | `int-firecrawl`, `int-rclone` |

Note: existing `git` plugin stays as-is for now. The `dx-` prefix is a future convention.

## Decisions

| Decision | Rationale |
|----------|-----------|
| Category: `learning` | Only unused category. Knowledge banks are reference material, not productivity tools. |
| Single skill, 9 references | 1 skill slot (~3K tokens always-on). References load on demand via progressive disclosure. |
| `user-invocable: false` | Auto-loads when Claude detects MPE keywords. No `/mpe` slash command needed. |
| No GitHub dark CSS in plugin | Custom CSS reference documents the mechanism, not opinionated theme choices. Theme config stays in dotfiles. |
| Hub pattern (routing table) | Matches `workflow` SKILL.md pattern. Quick-reference inline for most common queries. |

---

## Phase 1: Plugin Scaffold

**Goal:** Create the plugin directory structure and manifest so `bun run validate` passes.

### 1.1 Create directory structure

```
plugins/kb-mpe/
  .claude-plugin/
    plugin.json
  README.md
  skills/
    mpe/
      SKILL.md
      references/
```

### 1.2 Create plugin manifest

**File:** `plugins/kb-mpe/.claude-plugin/plugin.json`

- name: `kb-mpe`
- version: `1.0.0`
- skills: `["./skills/mpe"]`
- No commands, agents, or hooks

### 1.3 Create README.md

**File:** `plugins/kb-mpe/README.md`

- What MPE is and why this plugin exists
- How to enable/disable (toggle on/off)
- Summary of the 9 reference areas
- Link to official MPE docs

### 1.4 Update marketplace registry

**File:** `.claude-plugin/marketplace.json`

- Version bump: `0.2.0` -> `0.3.0` (minor -- adding a plugin)
- Add `kb-mpe` entry: category `learning`, tags for discoverability

### 1.5 Validate scaffold

Run `bun run validate` -- should pass with empty SKILL.md.

---

## Phase 2: Hub Skill

**Goal:** Write the SKILL.md hub that routes to reference files.

### 2.1 Write SKILL.md

**File:** `plugins/kb-mpe/skills/mpe/SKILL.md`

Frontmatter:
```yaml
name: mpe
description: Reference knowledge for Markdown Preview Enhanced (MPE) VS Code extension -- all settings, code chunks, @import file syntax, diagram engines (Mermaid, PlantUML, GraphViz, Vega-Lite, Kroki, WaveDrom), reveal.js presentations, Puppeteer/HTML/eBook export, custom CSS via style.less, and front-matter config. Use when working with MPE preview, export, or configuration.
user-invocable: false
```

Body sections:
- Routing table (9 rows mapping user intent -> reference file)
- Most Common Settings quick-reference table (8 settings inline)
- Quick code chunk syntax example
- Quick @import syntax example

Target: 150-200 lines. Under 500 line limit.

---

## Phase 3: Reference Files (Research + Write)

**Goal:** Create the 9 reference files with accurate, comprehensive content.

### Content sourcing strategy

Scrape remaining MPE doc pages via Firecrawl during implementation. Already fetched in conversation: settings (package.json), code chunks, presentations, Puppeteer export.

### 3.1 settings.md

All configurable VS Code settings. Grouped by area: preview, parser, image, diagram, export, math, misc. Each entry: key, type, default, valid values, one-line description.

Source: MPE `package.json` `contributes.configuration` (already fetched).

### 3.2 code-chunks.md

{cmd} syntax, all chunk options (cmd, output, hide, continue, id, run_on_save, matplotlib, class, element), keyboard shortcuts, language aliases, session continuity, output mode examples.

Source: MPE docs `#/code-chunk` (already fetched).

### 3.3 file-imports.md

@import syntax for all file types. Supported types table, options syntax, path resolution, remote imports, recursive imports.

Source: MPE docs `#/file-imports` (needs fetch).

### 3.4 diagrams.md

Each engine: fenced code block syntax, requirements, one minimal example. Engines: Mermaid, PlantUML, GraphViz/DOT, Vega-Lite, Kroki, WaveDrom, Nomnoml.

Source: MPE docs `#/diagrams` (needs fetch).

### 3.5 presentations.md

reveal.js front-matter config, slide syntax (`<!-- slide -->`), built-in themes, custom styling, fragment animations, keyboard shortcuts, export.

Source: MPE docs `#/presentation` (already fetched).

### 3.6 export.md

Puppeteer (PDF/PNG/JPEG), HTML export, eBook, GFM compilation, `export_on_save` front-matter, Prince (brief mention).

Source: MPE docs `#/puppeteer` (already fetched) + HTML/eBook pages (need fetch).

### 3.7 custom-css.md

style.less location (global vs project), crossnote config path, LESS syntax basics, preview selectors, dark mode technique, print CSS, code block theming, front-matter CSS injection.

Source: MPE docs `#/customize-css` (needs fetch) + conversation learnings.

### 3.8 frontmatter.md

All MPE-specific front-matter keys: title, author, date, output, presentation, toc, numberedHeaders, print_background, export_on_save, html, math, puppeteer. YAML gotchas.

Source: Aggregated from all other MPE doc pages.

### 3.9 known-issues.md

VS Code editorAssociations bug #192954 and workaround, PlantUML Java path issues, Puppeteer on CI, code chunk security, PDF background color, large file performance.

Source: Conversation experience + GitHub issues.

---

## Phase 4: Validate and Ship

### 4.1 Full validation gate

```bash
bun run validate    # marketplace + typecheck + lint
```

### 4.2 Structure checks

- [ ] All 9 reference files exist and are linked from SKILL.md routing table
- [ ] SKILL.md under 500 lines
- [ ] Each reference file under 300 lines
- [ ] No broken relative links in SKILL.md

### 4.3 Commit

Single conventional commit: `feat(kb-mpe): add Markdown Preview Enhanced knowledge bank plugin`

---

## Files to Create

| File | Purpose |
|------|---------|
| `plugins/kb-mpe/.claude-plugin/plugin.json` | Plugin manifest |
| `plugins/kb-mpe/README.md` | Orientation doc |
| `plugins/kb-mpe/skills/mpe/SKILL.md` | Hub skill with routing table |
| `plugins/kb-mpe/skills/mpe/references/settings.md` | All configurable settings |
| `plugins/kb-mpe/skills/mpe/references/code-chunks.md` | Code chunk execution reference |
| `plugins/kb-mpe/skills/mpe/references/file-imports.md` | @import syntax reference |
| `plugins/kb-mpe/skills/mpe/references/diagrams.md` | Diagram engine reference |
| `plugins/kb-mpe/skills/mpe/references/presentations.md` | reveal.js presentations |
| `plugins/kb-mpe/skills/mpe/references/export.md` | All export modes |
| `plugins/kb-mpe/skills/mpe/references/custom-css.md` | Styling and theming |
| `plugins/kb-mpe/skills/mpe/references/frontmatter.md` | Per-file YAML config |
| `plugins/kb-mpe/skills/mpe/references/known-issues.md` | Bugs and workarounds |

## Files to Modify

| File | Change |
|------|--------|
| `.claude-plugin/marketplace.json` | Version 0.2.0 -> 0.3.0, add kb-mpe entry |
