---
status: complete
priority: p3
issue_id: "032"
tags: [code-review, typescript]
dependencies: []
---

## Problem Statement

Type guards use `value as { ... }` assertion after typeof check. The `in` operator provides safer narrowing without casts.

## Findings

Several files use a pattern like:

```ts
if (typeof value === 'object' && value !== null) {
  const obj = value as { prop?: string };
  return typeof obj.prop === 'string';
}
```

This is unsafe because the `as` cast bypasses type checking. If the shape assumption is wrong, no error is raised at compile time.

## Proposed Solutions

Replace `as` casts with `in` operator narrowing:

```ts
if (typeof value === 'object' && value !== null && 'prop' in value) {
  return typeof value.prop === 'string';
}
```

## Technical Details

- **Files**: `plugins/git/hooks/auto-commit-on-stop.ts`, `plugins/git/hooks/command-logger.ts`, `plugins/git/hooks/git-context-loader.ts`, `plugins/git/hooks/session-summary.ts`
- The `in` operator narrows the type to include the checked property, making subsequent access type-safe

## Acceptance Criteria

- Type guard functions use `in` operator checks instead of `as` casts
- No `value as { ... }` patterns remain in type guard functions
