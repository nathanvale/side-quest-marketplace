# Cortex Formatter Agent Memory

## Cortex Frontmatter Contract

Source of truth: `plugins/cortex/skills/cortex-frontmatter/SKILL.md`

### Standard research doc frontmatter (base fields only)

```yaml
---
created: YYYY-MM-DD
title: "Human-readable title"
type: research
tags: [tag1, tag2]
project: my-project
status: draft
---
```

### Non-standard fields observed in research docs

`source_url`, `author`, `published_date` are NOT part of the Cortex frontmatter contract.
These fields belong in the `## Sources` section of the doc body, not in frontmatter.

Migration format when moving them to Sources:
`- [author](source_url) -- published published_date`

Prepend this line as the first item in the existing `## Sources` section.

## Research Doc Conventions

- All 6 research docs in `docs/research/2026-02-27-*.md` follow the Cortex `research` type structure.
- Section order: Summary -> Key Findings -> Sources -> Open Questions
- `## Sources` always exists in research docs - no need to create it when relocating metadata.
- The `project: my-agent-dojo` identifier is used across this batch of research docs.

## Validator Known Issues

- YAML `>` or `|` block scalars in `description` fields cause the validator to report "1 chars".
- Always use single-line strings for `description` in SKILL.md and all plugin markdown frontmatter.
- Full validation pipeline: `bun run validate` (typecheck + lint + marketplace structure check).
