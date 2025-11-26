---
title: "<% tp.system.prompt("Title") %>"
created: <% tp.date.now("YYYY-MM-DD HH:mm") %>
type: capture
status: inbox
captured_from: <% tp.system.prompt("Captured from (thought/article/conversation/etc.)") %>
resonance: <% tp.system.prompt("Resonance (inspiring/useful/personal/surprising)") %>
urgency: <% tp.system.prompt("Urgency (high/medium/low)") %>
tags:
  - inbox
---

# <% tp.system.prompt("Title") %>

## Capture

<!-- The raw content you're saving -->

<% tp.system.prompt("Content") %>

## Why I Saved This

<!-- What resonated? Why is this worth keeping? (1-2 sentences) -->

**Resonance**: <% tp.system.prompt("Resonance (inspiring/useful/personal/surprising)") %>
- **inspiring**: Uplifting quote, story, or idea
- **useful**: Template, process, or mental model
- **personal**: Experience, reflection, or lesson learned
- **surprising**: Challenges assumptions, new perspective



## Context

<!-- Where did this come from? What were you doing? -->

- **Source**: <% tp.system.prompt("Captured from (thought/article/conversation/etc.)") %>
- **Date**: <% tp.date.now("YYYY-MM-DD HH:mm") %>

## Processing Notes

<!-- To be filled during inbox processing -->

### PARA Decision

- [ ] **Project** - Has end date, actionable goal
- [ ] **Area** - Ongoing responsibility, no end date
- [ ] **Resource** - Reference material, topic of interest
- [ ] **Archive** - No longer relevant, completed

### Destination

**Move to**:

### Additional Tags

-

## Connections

<!-- What does this relate to? -->

-

## Next Actions

- [ ] Process within 48 hours

---

**Urgency Levels**:
- **high**: Time-sensitive, needs action within 24h
- **medium**: Important but can wait a few days
- **low**: Reference material, no time pressure

**Captured From Options**: thought, conversation, article, book, video, podcast, email, meeting
