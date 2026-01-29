---
name: create-from-context
description: Create PARA notes (resource or meeting) from data gathered during conversation. Interactive workflow that classifies, proposes, and creates with content injection. Use when structured information exists in conversation context and needs capturing as a vault note.
argument-hint: "[optional title or topic hint]"
user-invocable: true
allowed-tools: AskUserQuestion, mcp__plugin_para-obsidian_para-obsidian__para_create, mcp__plugin_para-obsidian_para-obsidian__para_replace_section, mcp__plugin_para-obsidian_para-obsidian__para_list_areas, mcp__plugin_para-obsidian_para-obsidian__para_list_projects, mcp__plugin_para-obsidian_para-obsidian__para_commit
---

# Create From Context

Create PARA-compliant resource or meeting notes from information gathered during the current conversation. This is the **inline companion to triage** -- use it when you already have rich context (e.g., from reading meeting notes, pulling Jira tickets, researching a topic) and want to capture it as a vault note without going through the inbox pipeline.

## When to Use This Skill

- Data has been gathered during conversation (web scrapes, API responses, file reads)
- User wants to capture conversation output as a vault note
- Creating a resource or meeting note without an inbox source file

## When NOT to Use This Skill

- Creating a **project** -- use `/para-obsidian:create-project`
- Creating an **area** -- use `/para-obsidian:create-area`
- Processing **inbox items** -- use `/para-obsidian:triage`

## Critical Rules

1. **ALWAYS load vault context first** (Phase 0) -- never suggest areas/projects that don't exist
2. **One question at a time** -- ADHD-friendly, no walls of questions
3. **Pre-fill from context** -- suggest values from conversation, ask "Good?" not "What is X?"
4. **Classification, not invention** -- AI classifies into existing categories; user provides facts
5. **Confirm before creating** -- always show full proposal for approval
6. **DRY references** -- load classification/formatting rules from `@` paths, never duplicate

## Workflow Overview

```
Phase 0: Load Vault Context (ALWAYS FIRST)
    |
Phase 1: Classify Note Type
    |-- Has arguments? -> pre-fill title + infer type
    |-- No arguments? -> ask what to capture
    |-- Apply decision tree -> resource or meeting
    |
Phase 2: Gather Details (template-specific)
    |-- Resource: title, source_format, URL, resource_type, area, summary
    |-- Meeting: title, meeting_type, date, attendees, area/project, summary
    |
Phase 3: Gather Content
    |-- Resource: Layer 1 content from conversation
    |-- Meeting: notes, decisions, action items, follow-up
    |
Phase 4: Present Proposal & Confirm
    |
Phase 5: Execute (create + inject + commit)
    |
Phase 6: Report & Next Steps
```

---

## Phase 0: Load Vault Context

**ALWAYS fetch vault context before doing anything else:**

```
para_list_areas({ response_format: "json" })
para_list_projects({ response_format: "json" })
```

Store these lists for:
- Area/project validation in Phase 2
- Offering numbered selection lists
- Understanding user's current vault structure

**Even if the user provides context in `$ARGUMENTS`, load vault context first.**

---

## Phase 1: Classify Note Type

### If `$ARGUMENTS` provided

Pre-fill the title from `$ARGUMENTS` and infer the template type:

```
You mentioned: "$ARGUMENTS"

Based on the conversation context, I suggest creating a **[resource/meeting]** note.

Does that sound right? (resource / meeting / something else)
```

### If no arguments

Ask what to capture:

```
What information from this conversation would you like to capture as a vault note?

I can create:
1. **Resource** -- knowledge to learn from (article, video, idea, reference)
2. **Meeting** -- notes from a discussion (attendees, decisions, action items)
```

### Classification Decision Tree

Reference: @../para-classifier/references/classification-decision-tree.md

**Apply these checks from conversation context:**

| Signal | Template |
|--------|----------|
| Attendees, agenda, action items, discussion date | **meeting** |
| Knowledge to distill, article/video/reference content | **resource** |
| Both present | Ask: "Is this primarily a record of an event, or knowledge to learn from?" |
| Neither clear | Default to **resource** with `document` source_format |

---

## Phase 2: Gather Details

Ask **one question at a time**. Pre-fill from conversation context wherever possible.

### Resource Path

Gather these fields in order:

1. **Title** -- suggest from context: "I suggest: '[Title]'. Good?"
2. **Source format** -- infer from context using emoji mapping (@../para-classifier/references/emoji-mapping.md):
   - Web article/blog -> `article` (📰)
   - YouTube/video -> `video` (🎬)
   - Podcast -> `podcast` (🎙️)
   - Twitter/X thread -> `thread` (🧵)
   - Book -> `book` (📖)
   - Course -> `course` (🎓)
   - Research paper -> `paper` (📑)
   - PDF/DOCX -> `document` (📄)
   - Screenshot/diagram -> `image` (🖼️)
   - Voice/audio -> `audio` (🎧)
   - **Unsure** -> `document` (📄) as fallback
3. **Source URL** -- if a URL exists in context, suggest it. Otherwise ask or skip.
4. **Resource type** -- one of: `article`, `tutorial`, `reference`, `thread`, `video`, `idea`
5. **Area** -- present numbered list from Phase 0 vault data. User selects or creates new.
6. **Project** (optional) -- if relevant, offer from list
7. **Summary** -- generate 2-3 sentence summary from context, confirm with user
8. **Author** (optional) -- if known from context

### Meeting Path

Gather these fields in order:

1. **Title** -- suggest from context: "I suggest: '[Title]'. Good?"
2. **Meeting type** -- infer from context using meeting types reference (@../create-meeting/references/meeting-types.md):
   - `1-on-1`, `standup`, `planning`, `retro`, `review`, `interview`, `stakeholder`, `general`
3. **Meeting date** -- extract from context or ask. ISO format: `YYYY-MM-DDTHH:mm:ss`
4. **Attendees** -- extract names from context, confirm with user. Format as comma-separated string.
5. **Area/Project** -- present numbered list from Phase 0 vault data
6. **Summary** -- generate concise summary, confirm

---

## Phase 3: Gather Content

### Resource Content

Extract content from conversation for Layer 1 injection.

Reference: @../analyze-web/references/layer1-formatting.md

**Key rules:**
- Target 2-3k tokens (~1500-2000 words)
- Use H3 subsections under the "Layer 1: Captured Notes" H2
- Include truncation note if content was shortened
- Preserve code blocks for technical content
- Bold key terms for progressive summarization

Present the formatted Layer 1 content:

```
Here's the Layer 1 content I'll inject:

---
## Layer 1: Captured Notes

### Overview
[extracted content]

### Key Points
- **Point 1**: [detail]
- **Point 2**: [detail]

---
*Captured from conversation context. Use /distill-resource for deeper analysis.*
---

Does this look right? (yes / edit / add more)
```

### Meeting Content

Extract from conversation and format as structured sections:

- **Notes** -- key discussion points as bullet list
- **Decisions Made** -- decisions as bullet list
- **Action Items** -- checkbox format: `- [ ] [[Assignee]] - Task (due: YYYY-MM-DD)`
- **Follow-up** -- follow-up items as bullet list

Present for confirmation:

```
Here are the meeting sections I'll populate:

**Notes:**
- [point 1]
- [point 2]

**Decisions:**
- [decision 1]

**Action Items:**
- [ ] [[Person]] - Task (due: date)

**Follow-up:**
- [item 1]

Does this look right? (yes / edit)
```

---

## Phase 4: Present Proposal

Show the complete note preview before creating:

### Resource Proposal

```
## Note Proposal

**Type:** Resource
**Title:** [emoji] [Title]
**Source format:** [format] ([emoji])
**Resource type:** [type]
**Source:** [URL or "conversation context"]
**Area:** [[Area Name]]
**Project:** [[Project Name]] (or "none")
**Author:** [name or "—"]
**Summary:** [2-3 sentences]

**Layer 1 content:** [word count] words prepared

---

**Ready to create?** (yes / tell me what to change)
```

### Meeting Proposal

```
## Note Proposal

**Type:** Meeting
**Title:** [Title]
**Meeting type:** [type]
**Date:** [date]
**Attendees:** [names]
**Area:** [[Area Name]]
**Project:** [[Project Name]] (or "none")
**Summary:** [1-2 sentences]

**Sections populated:** Notes, Decisions Made, Action Items, Follow-up

---

**Ready to create?** (yes / tell me what to change)
```

### Handle Response

| Response | Action |
|----------|--------|
| `yes` / `y` / `looks good` | Create immediately (Phase 5) |
| Specific feedback | Adjust and re-present |
| `cancel` / `no` | Abort gracefully |

---

## Phase 5: Execute

### Resource Execution

**Step 1: Create note**

```
para_create({
  template: "resource",
  title: "[Title without emoji - template adds it]",
  dest: "03 Resources",
  args: {
    summary: "[confirmed summary]",
    source: "[URL or 'Conversation context']",
    resource_type: "[confirmed type]",
    source_format: "[confirmed format]",
    areas: "[[Area Name]]",
    projects: "[[Project Name]]" or null,
    author: "[author]" or null,
    distilled: "false"
  },
  response_format: "json"
})
```

**Step 2: Inject Layer 1 content**

```
para_replace_section({
  file: "[created file path from step 1]",
  heading: "Layer 1: Captured Notes",
  content: "[formatted Layer 1 content from Phase 3]",
  response_format: "json"
})
```

**Step 3: Commit**

```
para_commit({
  message: "Add resource: [Title]",
  response_format: "json"
})
```

### Meeting Execution

**Step 1: Create note with body sections**

```
para_create({
  template: "meeting",
  title: "[Title]",
  dest: "04 Archives/Meetings",
  args: {
    meeting_date: "[ISO date]",
    meeting_type: "[type]",
    summary: "[confirmed summary]",
    attendees: "[comma-separated names]",
    area: "[[Area Name]]",
    project: "[[Project Name]]" or null
  },
  content: {
    "Notes": "[formatted notes]",
    "Decisions Made": "[formatted decisions]",
    "Action Items": "[formatted action items]",
    "Follow-up": "[formatted follow-up]"
  },
  response_format: "json"
})
```

**Step 2: Commit**

```
para_commit({
  message: "Add meeting: [Title]",
  response_format: "json"
})
```

---

## Phase 6: Report & Next Steps

```
Created: [emoji] [Title].md -> [destination folder]
Linked to: [[Area Name]]
[For resources: Layer 1 content injected ([word count] words)]
[For meetings: Sections populated: Notes, Decisions, Action Items, Follow-up]
Committed to vault.

Would you like to:
1. **Create another note** from this conversation
2. **Distill** the resource (extract key insights)
3. **Done** - note is ready
```

---

## Error Handling

| Error | Recovery |
|-------|----------|
| `para_create` fails | Show error, preserve all gathered data, offer retry |
| `para_replace_section` fails | Note exists without Layer 1 -- inform user, they can add content manually |
| `para_commit` fails (dirty tree) | Inform user, suggest committing existing changes first |
| No areas exist | Offer to create one first (same pattern as create-project Phase 2.3) |
| User cancels | Graceful exit, no cleanup needed |

---

## Example Interactions

### Resource from Web Research

```
User: [earlier in conversation, scraped an article about TypeScript generics]
User: /para-obsidian:create-from-context TypeScript generics guide

AI: Loading vault context...

    Based on the article we just read, I suggest creating a **resource** note.

    **Title:** "TypeScript Generics - A Practical Guide"
    **Source format:** article (📰)

    Does that look right? (yes / adjust)

User: yes

AI: Which area does this belong to?

    1. 🤖 AI Practice
    2. 💼 Career
    3. 📝 Note Taking

User: 2

AI: [presents full proposal with Layer 1 content preview]

User: yes

AI: Created: 📰 TypeScript Generics - A Practical Guide.md -> 03 Resources
    Linked to: [[💼 Career]]
    Layer 1 content injected (1,240 words)
    Committed to vault.
```

### Meeting from Discussion

```
User: [earlier, discussed sprint retro with notes about what went well/badly]
User: /para-obsidian:create-from-context

AI: What information from this conversation would you like to capture?

    1. **Resource** -- knowledge to learn from
    2. **Meeting** -- notes from a discussion

User: 2

AI: I suggest:

    **Title:** "Sprint 42 Retrospective"
    **Meeting type:** retro

    Good? (yes / adjust)

User: yes

AI: When did this meeting happen?

User: today at 2pm

AI: [extracts attendees, presents sections for confirmation]

User: yes

AI: [presents full proposal]

User: yes

AI: Created: Sprint 42 Retrospective.md -> 04 Archives/Meetings
    Sections populated: Notes, Decisions Made, Action Items, Follow-up
    Committed to vault.
```
