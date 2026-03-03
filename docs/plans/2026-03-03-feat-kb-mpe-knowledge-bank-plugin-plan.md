---
created: 2026-03-03
title: "kb-mpe - Markdown Preview Enhanced Knowledge Bank Plugin"
type: plan
tags: [kb-mpe, knowledge-bank, markdown-preview-enhanced, mpe, vscode, plugin-convention]
project: marketplace
status: completed
origin:
  - Conversation: MPE setup session (2026-03-03) -- configured settings, GitHub dark mode CSS, explored features
---

> Origin: Conversation where Nathan set up MPE in VS Code, configured GitHub dark mode, explored features, and identified the need for opt-in knowledge bank plugins to manage the ~40 skill context budget.

# feat: kb-mpe - Markdown Preview Enhanced Knowledge Bank Plugin

## Enhancement Summary

**Deepened on:** 2026-03-02  
**Sections enhanced:** 8 major sections  
**Skill lenses applied:** deepen-plan, best-practices-researcher, framework-docs-researcher, architecture-strategist, performance-oracle, security-sentinel, spec-flow-analyzer, learnings-researcher  
**Discoveries:** `docs/solutions` learnings found: 0, `.codex/agents` found: 0, plugin `agents/*.md` found: 0

### Section Manifest

1. Overview - strengthen convention framing and success metrics.
2. Problem Statement - tighten constraints and measurable outcomes.
3. Plugin Tier Convention - reduce naming/semver ambiguity and rollout risk.
4. Decisions - validate against routing, budget, and maintainability constraints.
5. Phase 1: Plugin Scaffold - harden validator and registry implementation details.
6. Phase 2: Hub Skill - improve auto-trigger quality and false-positive control.
7. Phase 3: Reference Files - add documentation rigor, edge cases, and source hygiene.
8. Phase 4: Validate and Ship - add deterministic verification gates before merge.

### Key Improvements

1. Added measurable acceptance targets for routing quality, validation, and token budget.
2. Added concrete risk controls for external renderers/exporters (Mermaid, reveal.js, Pandoc, Puppeteer, code execution).
3. Added source-authority guidance to keep references aligned to official docs and reduce drift.

### New Considerations Discovered

- MPE uses Crossnote config layering (`settings.json` + Crossnote config), so docs should explicitly separate scope/precedence.
- Export and rendering paths are sensitive to upstream tool/runtime changes; include version/date stamps in reference files.

## Overview

Create the first `kb-*` (knowledge bank) plugin in the marketplace. This establishes the `kb-` naming convention for toggle-on/off reference knowledge plugins that don't consume context budget when disabled.

### Research Insights

**Best Practices:**
- Treat `kb-*` as a stable product surface: naming becomes API-like once published.
- Keep hub skill minimal and route aggressively to `references/` to preserve base context.

**Performance Considerations:**
- Set an explicit budget target: hub skill <= ~3K tokens, normal invocation <= 2 reference files.
- Add a future guardrail in plan acceptance: "no single reference should require loading all others."

**Implementation Details:**
```text
Release target for kb-mpe:
- 1 always-on hub skill
- 7 on-demand references
- 0 commands/agents/hooks
```

**Edge Cases:**
- Keyword overlap can mis-trigger unrelated knowledge skills; resolve with strong WHEN/WHEN NOT phrasing in description.
- Tier conventions can fragment if exceptions are made too early; defer renames until adoption threshold is reached.

**References:**
- https://code.claude.com/docs/en/skills
- https://semver.org/
- .claude/CLAUDE.md (Plugin Tiers)

## Problem Statement

The ~40 skill context budget means every always-on skill competes for slots. Reference knowledge for tools like MPE, Obsidian, Tailwind, etc. shouldn't be always-on -- it should activate only when relevant and be easy to disable. The marketplace needs a convention for these opt-in knowledge modules.

### Research Insights

**Best Practices:**
- Define success criteria up front: activation quality, validation pass rate, and context footprint.
- Prefer "knowledge bank" packaging for high-reference/low-action domains.

**Performance Considerations:**
- Track three measurements during verification:
  - Validation: `bun run validate` passes with no manual fixes.
  - Routing: test prompts activate `mpe` in >= 3/4 representative cases.
  - Budget: no change to baseline session behavior when plugin is disabled.

**Implementation Details:**
```text
Acceptance signal set:
1) Plugin validates
2) Skill routes correctly
3) Disabled plugin consumes no runtime task context
```

**Edge Cases:**
- Overly broad keywords may cause noisy auto-loading.
- Under-specified keywords may hide the skill when needed.

**References:**
- https://marketplace.visualstudio.com/items?itemName=shd101wyy.markdown-preview-enhanced
- plugins/cortex-engineering/skills/skill-authoring/references/description-writing.md

## Plugin Tier Convention

The `kb-` prefix is established by this PR. Other tier prefixes are proposed conventions pending real examples.

| Tier | Prefix | Lifecycle | Status |
|------|--------|-----------|--------|
| Core | none | Always-on, foundational | Established (`cortex-engineering`) |
| Knowledge bank | `kb-*` | Toggle per-session | **Established in this PR** |
| Developer experience | `dx-*` | Toggle per-project | Proposed (no current examples) |
| Integration | `int-*` | Toggle as needed | Proposed (no current examples) |

Note: existing `git` plugin stays as-is. Renaming is a semver-major change -- only rename when the tier convention has 3+ adopters. The tier convention is also documented in `.claude/CLAUDE.md` under "Plugin Tiers".

### Research Insights

**Best Practices:**
- Keep tier definitions orthogonal (lifecycle first, capability second) to prevent category confusion.
- Require one real plugin example before promoting proposed tiers to established.

**Performance Considerations:**
- Avoid tier churn: each rename/refactor increases migration and docs overhead.

**Implementation Details:**
```text
Tier governance rule:
- Establish: >= 1 shipped exemplar
- Rename/breaking change: defer until >= 3 adopters
```

**Edge Cases:**
- Plugin may fit multiple tiers (e.g., integration + knowledge). Choose lifecycle owner tier, then document exceptions.

**References:**
- https://semver.org/
- .claude/CLAUDE.md

## Decisions

| Decision | Rationale |
|----------|-----------|
| Category: `learning` | Only unused category. Valid per marketplace validator. Knowledge banks are reference material, not productivity tools. |
| Single skill, 7 references | 1 skill slot (~3K tokens always-on). References load on demand via progressive disclosure. Reduced from 9: `frontmatter.md` and `known-issues.md` dissolved into feature files (cross-cutting concern + too few items). |
| `user-invocable: false` | Auto-loads when Claude detects MPE keywords. Description field is the sole routing mechanism -- keyword density is critical. |
| No `context: fork` | Knowledge bank skills provide reference context, not task isolation. |
| No GitHub dark CSS in plugin | Custom CSS reference documents the mechanism, not opinionated theme choices. Theme config stays in dotfiles. |
| Hub pattern (routing table) | Adapted from `git-expert` SKILL.md. Routing table is for Claude's internal navigation, not a user-facing menu. No interactive menus or `$ARGUMENTS`. |
| No `allowed-tools` restriction | Pure reference skill with no side effects. |
| Standalone plugin | MPE knowledge is unrelated to cortex-engineering's concern (knowledge capture workflow). Separate plugin gives toggle-on/off lifecycle. |

### Research Insights

**Best Practices:**
- Keep `user-invocable: false` for passive knowledge hubs, but add robust keyword coverage in description.
- Preserve plugin isolation when concerns are distinct, even if authoring patterns are shared.

**Performance Considerations:**
- Routing quality is highly description-dependent; include synonyms and failure-language ("not rendering", "export failing") to catch support intents.

**Implementation Details:**
```yaml
# Keep this pattern for background knowledge
user-invocable: false
# Avoid side-effect tool grants for pure docs skills
```

**Edge Cases:**
- YAML folded scalars can break validator expectations; keep description as explicit quoted single-line.
- Missing negative scope in description can collide with other markdown/diagram skills.

**References:**
- plugins/cortex-engineering/skills/skill-authoring/SKILL.md
- plugins/cortex-engineering/skills/skill-authoring/workflows/audit-skill.md

---

## Phase 1: Plugin Scaffold

**Goal:** Create the plugin directory structure and manifest so `bun run validate` passes.

### 1.1 Create directory structure

```text
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

Validation constraints:
- `name` must be kebab-case matching `/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`
- `name` must exactly match basename of `source` path
- Skill folder name `mpe` must match frontmatter `name: mpe`
- Plugin namespace becomes `kb-mpe:mpe` when fully qualified

### 1.3 Create README.md

**File:** `plugins/kb-mpe/README.md`

- What MPE is and why this plugin exists
- How to enable/disable (toggle on/off)
- Summary of the 7 reference areas
- Link to official MPE docs: https://shd101wyy.github.io/markdown-preview-enhanced/

### 1.4 Update marketplace registry

**File:** `.claude-plugin/marketplace.json`

- Version bump: `0.1.0` -> `0.2.0` (minor -- adding a plugin)
- A patch bump (0.1.1) would fail validation -- validator checks `newSemver.minor > oldSemver.minor`
- Add `kb-mpe` entry:

```json
{
  "name": "kb-mpe",
  "source": "./plugins/kb-mpe",
  "description": "Reference knowledge for Markdown Preview Enhanced (MPE) VS Code extension. Covers settings, code chunks, @import, diagram engines, presentations, export modes, and custom CSS. Enable when actively working with MPE.",
  "category": "learning",
  "tags": ["knowledge-bank", "markdown-preview-enhanced", "vscode", "mpe", "diagrams", "export"]
}
```

### 1.5 Validate scaffold

Run `bun run validate` -- should pass with empty SKILL.md.

### Research Insights

**Best Practices:**
- Validate in this order: marketplace schema, typecheck/lint, then full gate to isolate failures quickly.
- Ensure registry/source/plugin manifest names stay identical to avoid namespace drift.

**Performance Considerations:**
- Keep early scaffold phase lightweight so failures surface before long doc authoring work.

**Implementation Details:**
```bash
bun run validate:marketplace
bun run typecheck
bun run lint
bun run validate
```

**Edge Cases:**
- Minor bump is required for plugin additions by validator logic; patch bump will fail.
- Source path traversal or missing `.claude-plugin/plugin.json` fails validation even with correct marketplace entry.

**References:**
- scripts/validate-marketplace.ts
- scripts/validate-marketplace.test.ts

---

## Phase 2: Hub Skill (via skill-authoring)

**Goal:** Write the SKILL.md hub that routes to reference files.

**Use the `cortex-engineering:skill-authoring` skill** ("Create new skill" workflow) to build this. Provide the following as input context:

### Input for skill-authoring

**Skill type:** Complex skill (router pattern) -- single hub SKILL.md + 7 reference files in `references/`.

**Location:** `plugins/kb-mpe/skills/mpe/SKILL.md`

**Frontmatter requirements:**
- name: `mpe`
- `user-invocable: false` (background knowledge, auto-triggered)
- No `context: fork`, no `allowed-tools`, no `$ARGUMENTS`
- Description must be single-line quoted string (YAML `>` block scalar causes validator to see "1 chars")

**Description keywords to include** (these are the auto-triggering signal):
MPE, Markdown Preview Enhanced, VS Code, settings, code chunks, @import, Mermaid, PlantUML, GraphViz, Vega-Lite, WaveDrom, Kroki, reveal.js, presentations, Puppeteer, export, PDF, HTML, eBook, custom CSS, style.less, front-matter, "not rendering", "export failing"

**Routing table** (7 rows, maps user intent to reference file):

| User Intent | Reference | Quick Hint |
|-------------|-----------|------------|
| Configure VS Code settings / extension options | references/settings.md | `markdown-preview-enhanced.*` in settings.json |
| Execute code in preview / {cmd} blocks / output modes | references/code-chunks.md | Requires `enableScriptExecution: true` |
| Import files, images, or other markdown into a doc | references/file-imports.md | `@import "path"` syntax |
| Embed diagrams (Mermaid, PlantUML, GraphViz, etc.) | references/diagrams.md | Fenced code blocks with engine name |
| Build reveal.js presentations / slides | references/presentations.md | `<!-- slide -->` separator |
| Export to PDF, HTML, eBook, or PNG | references/export.md | Right-click preview > Export |
| Style the preview / custom CSS / dark mode | references/custom-css.md | Edit `style.less` via Customize CSS command |

**Inline quick-reference content** (keep in SKILL.md to answer simple queries without loading references):
- 5 most-configured settings: `previewTheme`, `codeBlockTheme`, `enableScriptExecution`, `mermaidTheme`, `mathRenderingOption`
- Code chunk quick syntax: ` ```python {cmd=true output="markdown"} `
- @import quick syntax (escape with space after `@` to prevent loader execution)
- Common questions decision tree (5-6 FAQ with inline answers)

**MPE-specific gotcha:** `@import` syntax in code examples must be escaped (space after `@`) to prevent skill loader execution. Wrap in code fences.

The skill-authoring workflow handles structure decisions, frontmatter validation, progressive disclosure, naming checks, and the "Done When" section.

### Research Insights

**Best Practices:**
- Use router pattern with concise SKILL hub + scoped reference files for progressive disclosure.
- Keep description in third person with WHAT + WHEN (+ WHEN NOT if needed) to improve activation quality.

**Performance Considerations:**
- High-signal routing table + quick-reference block reduces unnecessary reference loading for simple questions.

**Implementation Details:**
```text
Hub contains:
- Intake/routing table
- Inline quick answers for top FAQs
- Explicit links to 7 detailed references
```

**Edge Cases:**
- `@import` examples must be escaped in skill content to avoid accidental loader execution.
- Overloading hub with exhaustive config tables defeats progressive disclosure and harms context efficiency.

**References:**
- plugins/cortex-engineering/skills/skill-authoring/workflows/create-new-skill.md
- plugins/cortex-engineering/skills/skill-authoring/references/recommended-structure.md
- plugins/cortex-engineering/skills/skill-authoring/references/description-writing.md

---

## Phase 3: Reference Files (Research + Write)

**Goal:** Create 7 reference files with accurate, comprehensive content. This is the bulk of the implementation work -- 7 files to research and write.

### Content sourcing

Fetch MPE doc pages during implementation. Raw GitHub URLs for each topic:

| Topic | URL |
|-------|-----|
| Config/Settings | `https://raw.githubusercontent.com/shd101wyy/markdown-preview-enhanced/master/docs/config.md` |
| Code Chunks | `https://raw.githubusercontent.com/shd101wyy/markdown-preview-enhanced/master/docs/code-chunk.md` |
| File Imports | `https://raw.githubusercontent.com/shd101wyy/markdown-preview-enhanced/master/docs/file-imports.md` |
| Diagrams | `https://raw.githubusercontent.com/shd101wyy/markdown-preview-enhanced/master/docs/diagrams.md` |
| Presentations | `https://raw.githubusercontent.com/shd101wyy/markdown-preview-enhanced/master/docs/presentation.md` |
| HTML Export | `https://raw.githubusercontent.com/shd101wyy/markdown-preview-enhanced/master/docs/html.md` |
| Puppeteer Export | `https://raw.githubusercontent.com/shd101wyy/markdown-preview-enhanced/master/docs/puppeteer.md` |
| Pandoc Export | `https://raw.githubusercontent.com/shd101wyy/markdown-preview-enhanced/master/docs/pandoc.md` |
| GFM Markdown | `https://raw.githubusercontent.com/shd101wyy/markdown-preview-enhanced/master/docs/markdown.md` |
| Custom CSS | `https://raw.githubusercontent.com/shd101wyy/markdown-preview-enhanced/master/docs/customize-css.md` |
| FAQ | `https://raw.githubusercontent.com/shd101wyy/markdown-preview-enhanced/master/docs/faq.md` |

### Reference file rules

Standard progressive disclosure rules apply (enforced by skill-authoring audit). MPE-specific note: MPE uses the **crossnote** engine -- config.js follows crossnote schema, separate from VS Code settings.json.

### 3.1 settings.md (150-250 lines, needs ToC)

All configurable VS Code settings grouped by area: preview, parser, image, diagram, export, math, misc. Each entry: key, type, default, valid values, one-line description.

Also include:
- Crossnote `config.js` location (global: `~/.crossnote/config.js`, workspace) and Command Palette access
- Relationship between VS Code settings.json and config.js
- "Known Issues" section: VS Code `editorAssociations` bug #192954 and workaround (`{"*.md": "default"}`)

Source: MPE `package.json` `contributes.configuration` + config.md.

### 3.2 code-chunks.md (120-150 lines, needs ToC)

`{cmd}` syntax, all chunk options (cmd, output, hide, continue, id, run_on_save, matplotlib, class, element, args, stdin, modify_source), keyboard shortcuts (`Shift-Enter` run current, `Ctrl-Shift-Enter` run all), language aliases, session continuity, output mode examples, `$input_file` macro.

"Gotchas" section: security implications (enableScriptExecution), incompatible with ebook export, partially unreliable with pandoc export.

Source: code-chunk.md.

### 3.3 file-imports.md (80-100 lines)

All four @import syntax forms: `@import "path"`, `<!-- @import "path" -->`, `![]("path")`, `[[ path ]]`. Supported types table with rendering behavior per type, advanced curly-brace attributes (width, height, line_begin, line_end, cmd, code_block, page_no), path resolution, remote imports, refresh button to clear cache.

Source: file-imports.md.

### 3.4 diagrams.md (150-180 lines, needs ToC)

Each engine: fenced code block syntax, requirements, one minimal example. Engines: Mermaid (3 CSS themes, icon packs), PlantUML (requires Java), GraphViz/DOT (Viz.js, engines: circo/dot/neato/osage/twopi), Vega-Lite (JSON/YAML), Kroki (external service), WaveDrom (timing/bitfield diagrams).

Common attributes: `{code_block=true}`, `{align="center"}`, `{filename="name.png"}`.

"Gotchas" section: PlantUML Java path issues, several diagram types don't work with PDF or pandoc export, WaveDrom unsupported in GFM markdown export.

Source: diagrams.md.

### 3.5 presentations.md (100-120 lines, may need ToC)

reveal.js config under `presentation:` frontmatter key, slide syntax (`<!-- slide -->`), built-in themes (11), all presentation frontmatter options, slide-level customization (id, class), per-slide CSS targeting, fragment animations, speaker notes, keyboard shortcuts, deployment notes (CDN-hosted resources needed).

Source: presentation.md.

### 3.6 export.md (150-200 lines, needs ToC)

All export pipelines with their frontmatter:

- **Puppeteer (PDF/PNG/JPEG):** Chrome detection, `chromePath`, `puppeteer:` frontmatter, print styles via `@media print`
- **HTML:** Two modes (offline vs CDN), `html:` frontmatter
- **Pandoc:** `pandoc_args` frontmatter, bibliography auto-detection, formats (PDF, Word, RTF, Beamer)
- **GFM Markdown:** `markdown:` frontmatter, diagram-to-PNG conversion
- **eBook:** Brief mention
- **`export_on_save`:** Unified trigger across all formats

"Gotchas" section: Puppeteer browser launch failure (#2141), Pandoc `--reference-docx` deprecated (#2145), WaveDrom unsupported in GFM/pandoc, code chunks incompatible with ebook, large file performance.

Source: puppeteer.md + html.md + pandoc.md + markdown.md.

### 3.7 custom-css.md (80-100 lines)

Three approaches: (1) global/workspace `style.less` via "Customize Css" command, (2) per-file styles via frontmatter `id`/`class` + imported stylesheet, (3) custom fonts.

Crossnote path: `~/.crossnote/style.less`. LESS syntax basics, preview selectors, `@media print` for PDF, dark mode technique, code block theming.

"Frontmatter" section: `id`, `class` for per-file CSS targeting, `html:` frontmatter for toc/print_background.

Source: customize-css.md.

### Research Insights

**Best Practices:**
- Timestamp each reference file with "Last verified" date and source links to reduce stale docs risk.
- Separate "syntax/how-to" from "gotchas/troubleshooting" for faster scanning.
- Prefer official upstream docs for canonical behavior; use issues for troubleshooting only.

**Performance Considerations:**
- For diagram/export sections, prioritize minimal examples that are copy-pasteable and test quickly.
- Include compatibility notes for heavyweight paths (Puppeteer, Pandoc, code chunks) to reduce debug loops.

**Implementation Details:**
```text
Per reference file include:
1) Quick Start
2) Key options table
3) Gotchas
4) Troubleshooting checklist
5) Sources + verification date
```

**Edge Cases:**
- VS Code markdown association behavior can interfere with extension expectations.
- Code execution features increase security exposure; documentation must call this out prominently.
- Diagram/theme behavior can vary with Mermaid/reveal.js version and rendering context.

**References:**
- https://shd101wyy.github.io/markdown-preview-enhanced/
- https://crossnote.app/docs/api/interfaces/notebookconfig/
- https://github.com/microsoft/vscode/issues/192954
- https://github.com/mermaid-js/mermaid/blob/develop/docs/config/theming.md
- https://pandoc.org/MANUAL
- https://nvd.nist.gov/vuln/detail/CVE-2023-26152

---

## Phase 4: Validate and Ship

### 4.1 Full validation gate

```bash
bun run validate    # marketplace + typecheck + lint
```

### 4.2 Audit skill (via skill-authoring)

**Use `cortex-engineering:skill-authoring`** ("Audit existing skill" workflow) on `plugins/kb-mpe/skills/mpe/SKILL.md`. This checks frontmatter, structure, description quality, progressive disclosure, and naming against best practices.

### 4.3 Auto-trigger verification

Test that Claude activates the skill on these queries:
- "How do I configure MPE settings?"
- "How do I run Python in a code chunk?"
- "MPE preview is not rendering"
- "How do I export to PDF from MPE?"

Debug: ask Claude "When would you use the mpe skill?" -- it should quote the description back.

### 4.4 Commit

Single conventional commit: `feat(kb-mpe): add Markdown Preview Enhanced knowledge bank plugin`

### Research Insights

**Best Practices:**
- Add deterministic verification checklist before commit (validation, auto-trigger probes, docs source spot-check).
- Capture expected trigger prompts and outcomes in PR notes for reviewer reproducibility.

**Performance Considerations:**
- Run shortest checks first (marketplace validate) before full gate to reduce iteration time.

**Implementation Details:**
```text
Pre-commit checks:
- bun run validate
- 4 auto-trigger prompts pass
- spot-check 1 example per reference file
```

**Edge Cases:**
- False positives in activation can look like success unless intent-specific prompts are used.
- Export/diagram samples may pass in preview but fail in export formats; verify representative export paths.

**References:**
- package.json scripts (`validate`, `validate:marketplace`)
- plugins/cortex-engineering/skills/skill-authoring/workflows/audit-skill.md

---

## Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `plugins/kb-mpe/.claude-plugin/plugin.json` | Plugin manifest | ~15 |
| `plugins/kb-mpe/README.md` | Orientation doc | ~40 |
| `plugins/kb-mpe/skills/mpe/SKILL.md` | Hub skill with routing table | ~120 |
| `plugins/kb-mpe/skills/mpe/references/settings.md` | All settings + editorAssociations bug | 150-250 |
| `plugins/kb-mpe/skills/mpe/references/code-chunks.md` | Code chunk execution + security gotchas | 120-150 |
| `plugins/kb-mpe/skills/mpe/references/file-imports.md` | @import syntax (all 4 forms) | 80-100 |
| `plugins/kb-mpe/skills/mpe/references/diagrams.md` | Diagram engines + PlantUML Java gotcha | 150-180 |
| `plugins/kb-mpe/skills/mpe/references/presentations.md` | reveal.js + presentation frontmatter | 100-120 |
| `plugins/kb-mpe/skills/mpe/references/export.md` | All export pipelines + gotchas | 150-200 |
| `plugins/kb-mpe/skills/mpe/references/custom-css.md` | Styling, theming + CSS frontmatter | 80-100 |

## Files to Modify

| File | Change |
|------|--------|
| `.claude-plugin/marketplace.json` | Version `0.1.0` -> `0.2.0`, add kb-mpe entry |

## Token Budget

| Component | Tokens | Load Condition |
|-----------|--------|----------------|
| Skill description (always-on) | ~150 | Every session |
| SKILL.md body | ~3,000 | When Claude detects MPE relevance |
| 1 reference file (typical) | ~2,000-5,000 | Per-query |
| All references (worst case) | ~20,000 | Never expected in practice |

Typical session: ~5,000-8,000 tokens (SKILL.md + 1-2 references).
