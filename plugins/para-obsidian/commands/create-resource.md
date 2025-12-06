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
bun src/cli.ts create --template resource \
  --title "$TITLE" \
  --dest "$DEST" \
  --arg "Resource title=$TITLE" \
  --arg "Source type (book/article/video/course/podcast/etc.)=$SOURCE" \
  --arg "Primary area this relates to=$AREAS" \
  --content '{
    "Summary": "...",
    "Key Insights": "1. ...\n2. ...\n3. ...",
    "Notable Quotes": "> ...",
    "Connections": "- **Related to**: [[...]]\n- **Useful for**: [[...]]",
    "Action Items": "- [ ] ...",
    "Personal Reflection": "..."
  }'
```

## Content Sections

| Section | Purpose |
|---------|---------|
| `Summary` | Key points in 2-3 sentences |
| `Key Insights` | Most valuable ideas |
| `Notable Quotes` | Passages worth remembering |
| `Connections` | How it relates to existing knowledge |
| `Action Items` | What will you DO with this? |
| `Personal Reflection` | How does this change your thinking? |

## Frontmatter Hints

- **Suggested tags**: resource, reference, learning, work

## Examples

```
/para-obsidian:create-resource "Atomic Habits" book "[[Health]]"
/para-obsidian:create-resource "TypeScript Best Practices 2025" article "[[Career]]"
/para-obsidian:create-resource "React Server Components" video
```
