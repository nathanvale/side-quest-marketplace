---
name: vscode-bookmarks
description: Create and manage VS Code Bookmarks extension labeled bookmarks in .vscode/bookmarks.json. Use when the user wants to add navigation bookmarks to a codebase, trace data flows through code, mark important code locations, or set up labeled waypoints for code walkthroughs. Also use when user says "bookmark", "label this code", "mark this flow", or "add waypoints".
---

# VS Code Bookmarks

Create labeled bookmarks in `.vscode/bookmarks.json` for the alefragnani Bookmarks extension.

## Prerequisites

Ensure `"bookmarks.saveBookmarksInProject": true` is set in VS Code settings. Without this, bookmarks are stored in VS Code internal state and this skill cannot manage them.

## Bookmark JSON Format

```json
{
  "files": [
    {
      "path": "relative/path/from/project-root.ts",
      "bookmarks": [
        { "line": 42, "column": 0, "label": "PREFIX:LABEL" }
      ]
    }
  ]
}
```

Rules:
- `path` is relative to the project root (no leading `./` or `/`)
- `line` is 0-indexed (line 1 in editor = line 0 in JSON)
- `column` is always 0
- Multiple bookmarks per file go in the same `bookmarks` array
- Each file appears once in the `files` array

## Workflow

1. **Read existing bookmarks** - Check for `.vscode/bookmarks.json`. If it exists, read it to avoid overwriting.
2. **Identify the pattern** - Ask user what they want to trace or mark. See [references/patterns.md](references/patterns.md) for labelling patterns.
3. **Find the lines** - Use Grep/Read to find exact line numbers for each bookmark target.
4. **Verify line numbers** - Read each file to confirm the line content matches what you expect. Off-by-one errors are common.
5. **Write bookmarks** - Merge new bookmarks into existing file, or create new `.vscode/bookmarks.json`.
6. **Sort by namespace** - Apply the sorting rules below before writing.
7. **Tell user to refresh** - They may need to click the refresh icon in the Bookmarks panel.

## Sorting Rules (CRITICAL)

The Bookmarks sidebar renders entries in **JSON array order** -- there is no automatic alphabetical sort. You control the display order by controlling the JSON order. After every write, the bookmarks.json must be sorted:

1. **Within each file**: sort the `bookmarks` array alphabetically by `label`
2. **Across files**: sort the `files` array by the **first bookmark label** in each file (alphabetically)

This ensures the sidebar groups bookmarks by prefix (AUTH:* together, then CONNECT:*, then MSG:*, then TOKEN:*, etc.).

When a file contains bookmarks from multiple prefixes (e.g. socket-handlers.ts has both AUTH: and MSG:), the file is placed according to its **first** (alphabetically earliest) label. The remaining labels from later prefixes will appear in the middle of that group -- this is unavoidable since each file can only appear once.

## Label Convention

Labels use `PREFIX:N-SUFFIX` format. The number provides click-through order within each group.

- Prefix: uppercase, 2-8 chars, describes the domain (AUTH, MSG, DB, ROUTE)
- Number: step order within the group (1-based)
- Suffix: uppercase, describes the specific point (EMIT, VALIDATE, PERSIST)
- Separator: single colon after prefix, hyphen between number and suffix

Format: `PREFIX:N-SUFFIX`

Good: `AUTH:1-REST-CALL`, `AUTH:2-GUARD`, `MSG:1-EMIT`, `MSG:2-VALIDATE`
Bad: `AUTH:MIDDLEWARE` (no step number), `auth:1-middleware` (lowercase), `MSG:EMIT` (no step number)

The step numbers let the user click through each group in narrative order during walkthroughs or interviews. Each prefix group has its own independent numbering starting at 1.

## Line Number Accuracy

Line numbers in the JSON are **0-indexed**. When you read a file and see content on line 47 (1-indexed from the Read tool), write `"line": 46` in the JSON.

**Always verify** by reading the target file before writing bookmarks. Code changes shift line numbers -- never assume a line number from a previous session is still correct.
