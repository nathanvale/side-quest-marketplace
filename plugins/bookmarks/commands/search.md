---
description: Search bookmarks by title or URL
arguments:
  - name: query
    description: Search terms (space-separated words)
    required: true
---

# Bookmark Search

Search through exported browser bookmarks by title or URL.

## Instructions

Run the Python search script with the user's query:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/search.py $ARGUMENTS --json
```

Parse the JSON output and present results to the user in a readable format:

1. Show the bookmark title as a clickable markdown link
2. Include the folder path for context
3. Limit to top 10 most relevant results by default

## Example Output

For `/bookmarks:search react hooks`:

1. **[React Hooks in TypeScript](https://medium.com/@jrwebdev/react-hooks-in-typescript-88fce7001d0d)**
   - Folder: Bookmarks bar > Imported From Safari

2. **[React as a UI Runtime](https://overreacted.io/react-as-a-ui-runtime/)**
   - Folder: Bookmarks bar > Imported From Safari

## Options

- `--folder NAME` - Filter to bookmarks in a specific folder
- `--limit N` - Change result limit (default: 20)
