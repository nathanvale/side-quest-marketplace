---
status: complete
priority: p2
issue_id: "017"
tags: [naming, skills, cortex-engineering, conventions]
dependencies: []
---

# Fix Cortex-Engineering Skill Naming Convention Violations

## Problem Statement

Three cortex-engineering skills have `name` fields that violate the plugin's own naming conventions skill. The mismatches cause confusion between directory names, command names, and skill names -- breaking Rules 1, 2, and 4 of the hierarchy coherence rules.

## Findings

### 1. `research` skill -- `name: producing-research-documents`

- **Rule 2 violation:** Command is `research`, skill name is `producing-research-documents`
- **Rule 4 violation:** Gerund phrase, should be a verb (action skill)
- **Directory:** `skills/research/` (doesn't match name field)
- **Description (289 chars):** includes implementation details ("YAML frontmatter", "Delegates to frontmatter skill") that are routing noise
- **Files referencing old name:**
  - `plugins/cortex-engineering/skills/research/SKILL.md` (the name field itself)
  - `plugins/cortex-engineering/commands/research.md` (references skill by name)
  - `plugins/cortex-engineering/README.md`
  - `plugins/cortex-engineering/skills/naming-conventions/SKILL.md`
  - `docs/research/2026-03-01-naming-conventions-claude-code-plugins.md`
  - `docs/plans/2026-02-27-feat-cortex-stage-0-dogfood-mvp-plan.md`

### 2. `brainstorm` skill -- `name: brainstorming-with-cortex`

- **Rule 1 violation:** "cortex" in skill name repeats the plugin namespace
- **Rule 2 violation:** Command is `brainstorm`, skill name is `brainstorming-with-cortex`
- **Rule 4 violation:** Gerund phrase, should be a verb (action skill)
- **Directory:** `skills/brainstorm/` (doesn't match name field)
- **Description (247 chars):** includes delegation details not relevant to routing
- **Files referencing old name:**
  - `plugins/cortex-engineering/skills/brainstorm/SKILL.md` (the name field itself)
  - `plugins/cortex-engineering/commands/brainstorm.md` (references skill by name)
  - `plugins/cortex-engineering/README.md`
  - `docs/plans/2026-02-27-feat-cortex-stage-0-dogfood-mvp-plan.md`

### 3. `creating-skills-and-commands` skill

- **Rule 4 violation:** Gerund phrase, knowledge skills should be nouns
- **Length violation:** 4 words (guideline is 1-3)
- **Directory:** `skills/creating-skills-and-commands/` (matches but both are wrong)
- **Suggested rename:** `skill-authoring` (noun-compound, 2 words)
- **Files referencing old name:**
  - `plugins/cortex-engineering/skills/creating-skills-and-commands/SKILL.md`
  - `plugins/cortex-engineering/.claude-plugin/plugin.json` (skills array entry)
- **Note:** Directory rename required -- update plugin.json path too

## Proposed Solutions

### Option A: Fix all three (recommended)

1. `research` skill: change `name:` to `research`, trim description
2. `brainstorm` skill: change `name:` to `brainstorm`, trim description
3. `creating-skills-and-commands` skill: rename directory to `skill-authoring`, update `name:`, update plugin.json path

### Option B: Fix research + brainstorm only

Skip the `creating-skills-and-commands` rename since it requires a directory rename and plugin.json path update.

## Recommended Action

Option A: Fix all three. Change `name:` fields on research and brainstorm, trim their descriptions, rename `creating-skills-and-commands` directory to `skill-authoring`, and update all references across the codebase.

## Acceptance Criteria

- [ ] `research` SKILL.md `name:` field is `research`
- [ ] `research` SKILL.md description is trimmed to routing-focused text (under 200 chars)
- [ ] `brainstorm` SKILL.md `name:` field is `brainstorm`
- [ ] `brainstorm` SKILL.md description is trimmed to routing-focused text (under 200 chars)
- [ ] `creating-skills-and-commands` directory renamed to `skill-authoring`
- [ ] `skill-authoring` SKILL.md `name:` field is `skill-authoring`
- [ ] `plugin.json` skills path updated to `./skills/skill-authoring`
- [ ] All references to old names updated in README.md, commands, and other skills
- [ ] `bun run validate` passes
- [ ] No stale references to old names (grep confirms)

## Work Log

### 2026-03-01 - Initial audit

**By:** Claude Code

**Actions:**
- Reviewed all 7 cortex-engineering skills against naming conventions
- Identified 3 skills with naming violations
- Grepped for all references to old names across the codebase
- Filed this todo

**Learnings:**
- `name` field in SKILL.md wins over directory name for `/slash-command` invocation
- Research and brainstorm are name-only fixes (no directory rename needed)
- `creating-skills-and-commands` requires directory rename + plugin.json update
