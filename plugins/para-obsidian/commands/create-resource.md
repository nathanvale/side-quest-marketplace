---
description: Create a new resource note for reference material
argument-hint: <title> <source> [areas] [dest]
allowed-tools: Bash(para-obsidian:*)
---

## Variables

```bash
TITLE="$1"
SOURCE="$2"
AREAS="${3:-}"
DEST="${4:-03_Resources}"
```

**source options**: book | article | video | course | podcast | paper | web

## Command

```bash
para-obsidian create --template resource \
  --title "$TITLE" \
  --dest "$DEST" \
  --arg "Source type=$SOURCE" \
  --arg "Related areas=$AREAS"
```

## Frontmatter Hints

- **Suggested tags**: resource, reference, learning, work

## Examples

```
/para-obsidian:create-resource "Atomic Habits" book "[[Health]],[[Learning]]"
/para-obsidian:create-resource "TypeScript Best Practices 2025" article "[[Career]]"
/para-obsidian:create-resource "React Server Components" video
```
