---
title: "<% tp.system.prompt("Resource title") %>"
created: <% tp.date.now("YYYY-MM-DD") %>
type: resource
source: <% tp.system.prompt("Source type (book/article/video/course/podcast/etc.)") %>
source_url: "<% tp.system.prompt("Source URL (optional)", "") %>"
author: "<% tp.system.prompt("Author (optional)", "") %>"
projects:
  - "[[<% tp.system.prompt("Related project (optional)", "") %>]]"
areas:
  - "[[<% tp.system.prompt("Primary area this relates to") %>]]"
reviewed: <% tp.date.now("YYYY-MM-DD") %>
tags:
  - resource
  - <% tp.system.prompt("Main topic") %>
template_version: "5"
---

# <% tp.system.prompt("Resource title") %>

## Source Information

| Field | Value |
|-------|-------|
| **Type** | <% tp.system.prompt("Source type (book/article/video/course/podcast/etc.)") %> |
| **Author** | <% tp.system.prompt("Author (optional)", "") %> |
| **URL** | <% tp.system.prompt("Source URL (optional)", "") %> |
| **Date Consumed** | <% tp.date.now("YYYY-MM-DD") %> |

## Summary

<!-- Key points in 2-3 sentences. What is the core message? -->



## Key Insights

<!-- The most valuable ideas from this resource -->

1.
2.
3.

## Notable Quotes

<!-- Passages worth remembering (use progressive summarization) -->

>

>

## Progressive Summary

### Layer 1: Captured Notes

<!-- Raw notes and highlights -->



### Layer 2: Bold Passages

<!-- **Bold** the most important 10-20% -->



### Layer 3: Highlighted Core

<!-- ==Highlight== the top 10% of bold passages -->



### Layer 4: Executive Summary

<!-- Your own words: the essence in 1-2 paragraphs -->



## Connections

<!-- How does this relate to your existing knowledge? -->

**Related Projects:**
```dataview
LIST
FROM "01 Projects"
WHERE contains(file.outlinks, this.file.link)
```

**Related Areas:**
```dataview
LIST
FROM "02 Areas"
WHERE contains(file.outlinks, this.file.link)
```

- **Related to**: [[other note]]
- **Supports**: [[similar concept]]
- **Useful for**: See projects/areas above

## Action Items

<!-- What will you DO with this knowledge? -->

- [ ]
- [ ]

## Questions Raised

<!-- What do you still want to know? -->

-

## Personal Reflection

<!-- How does this change your thinking or behavior? -->



---

**Source Types**: book, article, video, course, podcast, paper, web, conversation
