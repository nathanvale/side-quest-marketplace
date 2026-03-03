---
status: complete
priority: p3
issue_id: "033"
tags: [code-review, testing]
dependencies: []
---

## Problem Statement

Some test fetch mocks use `as unknown as typeof fetch` double-cast because the mock signature doesn't match the real fetch signature. The mocks accept zero parameters instead of matching the real signature with unused params.

## Findings

In `event-bus-client.test.ts`, fetch mocks are created with signatures like:

```ts
const mockFetch = (() => Promise.resolve(...)) as unknown as typeof fetch;
```

The double-cast (`as unknown as typeof fetch`) is needed because the arrow function takes no parameters, so TypeScript can't directly assign it to the `fetch` type.

## Proposed Solutions

Make mock functions match the real fetch signature by accepting (but ignoring) the expected parameters:

```ts
const mockFetch = ((_input: RequestInfo | URL, _init?: RequestInit) =>
  Promise.resolve(...)
) as typeof fetch;
```

This eliminates the need for the `as unknown` intermediate cast.

## Technical Details

- **File**: `plugins/git/hooks/event-bus-client.test.ts`
- The real `fetch` signature is `(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>`
- Matching the signature allows a single `as typeof fetch` cast instead of double-casting

## Acceptance Criteria

- No `as unknown as typeof fetch` patterns in test files
- Mock functions match the real fetch parameter signature
