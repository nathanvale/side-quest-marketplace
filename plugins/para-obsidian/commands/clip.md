---
description: Inbox capture with Web Clipper parity — fetches page titles and content for URLs, generates titles for inline text
argument-hint: <url1> [url2 url3 ...] or <inline text to capture>
---

# Clip

Inbox capture that matches Obsidian Web Clipper output. Fetches real page titles and content for URLs, or generates concise titles for inline text. No classification, no area/project assignment — triage handles that.

## Usage

```
/para-obsidian:clip <url>
/para-obsidian:clip <url1> <url2> <url3>
/para-obsidian:clip <inline text to capture>
```

## Examples

```
/para-obsidian:clip https://kentcdodds.com/blog/aha-programming
/para-obsidian:clip https://github.com/anthropics/claude-code https://youtube.com/watch?v=abc123
/para-obsidian:clip Check if React Server Components solve the waterfall problem
```

## Instructions

When invoked, load the `clip` skill for full workflow details:

```
@plugins/para-obsidian/skills/clip/SKILL.md
```
