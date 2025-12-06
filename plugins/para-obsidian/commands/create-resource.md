Create a new resource note for reference material.

Resources are topic-based collections of information you may want to reference later.

## Required Arguments
- `$TITLE` - Resource title
- `$SOURCE` - Source type: book | article | video | course | podcast | paper | web

## Optional Arguments
- `$AREAS` - Related areas as comma-separated wikilinks (e.g. "[[Health]],[[Learning]]")
- `$DEST` - Destination folder (default: 03_Resources)

## Auto-filled Fields
- `created` - Today's date
- `template_version` - 2
- `tags` - Always includes "resource"

## Frontmatter Hints
- **source**: book | article | video | course | podcast | paper | web
- **Suggested tags**: resource, reference, learning, work

## Command
```bash
para-obsidian create --template resource \
  --title "$TITLE" \
  --dest "${DEST:-03_Resources}" \
  --arg "Source type=$SOURCE" \
  --arg "Related areas=${AREAS:-}"
```

## Example Usage

For book notes: "Atomic Habits by James Clear"

```
TITLE: "Atomic Habits"
SOURCE: "book"
AREAS: "[[Health]],[[Learning]]"
```

For article reference: "TypeScript Best Practices 2025"

```
TITLE: "TypeScript Best Practices 2025"
SOURCE: "article"
AREAS: "[[Career]]"
```
