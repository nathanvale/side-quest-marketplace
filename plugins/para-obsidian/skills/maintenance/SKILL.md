---
name: maintenance
description: Audit para-obsidian plugin for convention drift across skills, commands, hooks, and plugin registration.
user-invocable: false
allowed-tools: Read, Glob, Grep, Bash
---

# Maintenance — Convention Drift Audit

Audit the para-obsidian plugin for convention drift. Scans 8 domains: plugin registration, frontmatter schema, completion signals, allowed-tools accuracy, cross-references, brain routing coverage, references directory integrity, and observability gaps.

Not user-invocable — brain routes to it via keywords like "maintenance", "audit", "lint", "health check", "check conventions", "plugin health".

---

## Step 0 — Load Conventions

Read the conventions knowledge base:

```
Read({ file_path: "<plugin-root>/skills/maintenance/references/conventions.md" })
```

Use these rules as the source of truth for all checks. The plugin root is `plugins/para-obsidian` relative to the repo root.

---

## Step 1 — Plugin Registration Audit

Check that every component on disk has a matching entry in `.claude-plugin/plugin.json`.

**1.1 — Discover components on disk:**

```
Glob({ pattern: "plugins/para-obsidian/skills/*/SKILL.md" })
Glob({ pattern: "plugins/para-obsidian/commands/*.md" })
Glob({ pattern: "plugins/para-obsidian/agents/*.md" })
```

**1.2 — Read plugin.json:**

```
Read({ file_path: "<plugin-root>/.claude-plugin/plugin.json" })
```

**1.3 — Compare:**

For each component on disk, verify it has a matching entry in the appropriate plugin.json array (`skills`, `commands`, `agents`). Report:
- **error**: Component on disk missing from plugin.json
- **warning**: Entry in plugin.json pointing to non-existent path

---

## Step 2 — Frontmatter Schema Audit

For each `skills/*/SKILL.md`, parse the YAML frontmatter and check required fields.

**Required fields:** `name`, `description`, `user-invocable`, `allowed-tools`

**Additional checks:**
- `name` must match the directory name
- User-invocable skills should have `argument-hint` (warning if missing)

**Report:**
- **error**: Missing required frontmatter field
- **warning**: User-invocable skill missing `argument-hint`

---

## Step 3 — Completion Signal Audit

For each user-invocable skill, check if the SKILL.md body contains a `SKILL_RESULT` pattern.

```
Grep({ pattern: "SKILL_RESULT", path: "plugins/para-obsidian/skills/*/SKILL.md" })
```

Cross-reference with frontmatter `user-invocable: true` from Step 2.

**Report:**
- **warning**: User-invocable skill missing `SKILL_RESULT` completion signal

---

## Step 4 — Allowed-Tools Accuracy Audit

For each skill, compare tools referenced in the SKILL.md body against the `allowed-tools` frontmatter declaration.

**Detection patterns:**
- MCP tool calls: `para_create(`, `para_list(`, `para_fm_get(`, etc.
- Full MCP names: `mcp__plugin_para-obsidian_para-obsidian__<tool>`
- Built-in tools: `Read(`, `Write(`, `Edit(`, `Glob(`, `Grep(`, `Bash(`, `WebFetch(`, `WebSearch(`
- Meta tools: `AskUserQuestion(`, `Skill(`, `Task(`

**Exclusions:**
- Tool references inside HTML comments (`<!-- ... -->`)
- Tool references in "Rules" or "Do NOT" sections (negative references)

**Report:**
- **warning**: Tool referenced in body but missing from `allowed-tools`
- **info**: Tool in `allowed-tools` but not referenced in body

---

## Step 5 — Cross-Reference Audit

Scan all SKILL.md files for references to other skills, commands, or files, and verify they resolve.

**Reference patterns to detect:**
- `Skill({ skill: "para-obsidian:<name>"` → check `skills/<name>/SKILL.md` exists
- `/para-obsidian:<name>` → check `skills/<name>/SKILL.md` or `commands/<name>.md` exists
- `[text](references/<file>)` → check file exists relative to skill directory

**Report:**
- **error**: Referenced skill/command/file does not exist
- **warning**: Ambiguous reference that could be skill or command

---

## Step 6 — Brain Routing Coverage Audit

Read the brain skill's routing table and verify coverage.

```
Read({ file_path: "<plugin-root>/skills/brain/SKILL.md" })
```

**Checks:**
- Every user-invocable skill (from Step 2) should appear in at least one routing table row
- Every skill/command referenced in the routing table should exist on disk

**Report:**
- **warning**: User-invocable skill not reachable via brain routing
- **error**: Routing table references non-existent skill/command

---

## Step 7 — References Directory Audit

For each skill with a `references/` subdirectory, verify files are actually referenced.

```
Glob({ pattern: "plugins/para-obsidian/skills/*/references/*" })
```

For each file found, check if the parent SKILL.md contains a reference to it (filename match in link text or path).

**Report:**
- **warning**: File in `references/` not referenced from SKILL.md (possible dead content)
- **error**: SKILL.md references a file in `references/` that doesn't exist

---

## Step 8 — Observability Gaps Audit

Check that skills routed through brain have telemetry coverage.

**8.1 — Verify brain-telemetry hook exists:**

```
Read({ file_path: "<plugin-root>/hooks/hooks.json" })
```

Confirm a PostToolUse hook on `Skill` matcher exists and points to `brain-telemetry.ts`.

**8.2 — Check SKILL_RESULT coverage:**

Cross-reference skills in the brain routing table (Step 6) with completion signal coverage (Step 3). Skills in the routing table without `SKILL_RESULT` have an observability gap.

**Report:**
- **warning**: Brain-routed skill lacks `SKILL_RESULT` (telemetry will show undefined status)
- **error**: brain-telemetry hook not registered in hooks.json

---

## Output Format

After all 8 domains are audited, produce a summary:

```
SKILL_RESULT:{"status":"<status>","skill":"maintenance","summary":"<N> domains audited, <M> issues found","issues":[<issue-list>]}
```

**Status logic:**
- `ok` — Zero errors, zero warnings
- `partial` — Zero errors, one or more warnings
- `error` — One or more errors

**Issue format:**
Each issue in the array:
```json
{
  "domain": "<1-8 domain name>",
  "severity": "error|warning|info",
  "file": "<relative path>",
  "message": "<what's wrong>",
  "fix": "<suggested remediation>"
}
```

**Present the results to Nathan as a readable summary**, not raw JSON. Group by domain, show severity with clear markers (e.g., `[ERROR]`, `[WARN]`, `[INFO]`). End with the `SKILL_RESULT` line for brain parsing.

---

## Rules

1. **Read-only audit.** Never modify files. Only detect and report drift.
2. **All paths relative to plugin root** (`plugins/para-obsidian/`).
3. **Conventions are the source of truth.** Always read `references/conventions.md` first.
4. **Deterministic.** Same plugin state = same audit output. No LLM-dependent checks.
5. **Fast.** Use Glob and Grep for bulk operations. Read individual files only when needed.
6. **Complete.** Run all 8 domains every time. Don't short-circuit on first error.
