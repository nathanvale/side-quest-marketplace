---
status: complete
priority: p3
issue_id: "018"
tags: [naming, skills, cortex-engineering, conventions, mermaid]
dependencies: []
---

# Trim mermaid-diagrams Skill Description

## Problem Statement

The `mermaid-diagrams` skill description is 296 chars -- long for a non-user-invoked knowledge skill. Since it has `user-invocable: false`, Claude doesn't need to route to it directly (the `visualize` skill references it explicitly). The description carries unnecessary routing weight.

## Findings

Current description:
> Expert knowledge for creating visually attractive, print-ready Mermaid diagrams. Covers syntax for all diagram types, styling patterns, theme configuration, node shapes, color palettes, and print optimization for A3/A2 wall printing. Use when generating, improving, or reviewing any Mermaid diagram, flowchart, sequence diagram, mind map, or architecture visual.

The "Covers syntax for all diagram types, styling patterns, theme configuration, node shapes, color palettes, and print optimization for A3/A2 wall printing" section is an exhaustive feature list that doesn't improve routing. The "Use when..." clause also over-enumerates diagram subtypes.

## Proposed Solutions

### Option A: Trim to essentials (recommended)

```yaml
description: Expert knowledge for creating print-ready Mermaid diagrams -- syntax, styling, theming, and print optimization. Use when generating or reviewing any Mermaid diagram.
```

~170 chars. Keeps WHAT + WHEN pattern, drops the feature inventory.

### Option B: Minimal

```yaml
description: Mermaid diagram syntax, styling, and print optimization knowledge. Use when generating or reviewing Mermaid diagrams.
```

~128 chars. Shorter but may lose some routing signal.

## Recommended Action

Option A: Trim to ~170 chars keeping WHAT + WHEN pattern. Drop the feature inventory list.

## Acceptance Criteria

- [ ] `mermaid-diagrams` SKILL.md description trimmed to under 200 chars
- [ ] Retains WHAT + WHEN pattern
- [ ] `bun run validate` passes

## Work Log

### 2026-03-01 - Initial audit

**By:** Claude Code

**Actions:**
- Identified during naming conventions review of all cortex-engineering skills
- Current description is 296 chars, flagged as WARN

**Learnings:**
- Non-user-invoked skills with `user-invocable: false` don't need aggressive routing language since they're referenced explicitly by other skills
