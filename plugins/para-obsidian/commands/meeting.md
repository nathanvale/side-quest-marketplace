---
description: Create a meeting note from a transcription
argument-hint: [transcription] [--type 1-on-1|standup|planning|retro|review|interview|stakeholder|general] [--date DATETIME]
---

# Create Meeting from Transcription

Invoke the `meeting-from-transcription` skill to create a meeting note from a transcription file.

## Usage

```
/para-obsidian:meeting [transcription] [--type TYPE] [--date DATETIME]
```

## Instructions

Use the Skill tool to invoke `meeting-from-transcription` with the user's arguments:

```
Skill tool:
  skill: "meeting-from-transcription"
  args: "$ARGUMENTS"
```

The skill handles:
- No argument → Lists available transcriptions in inbox
- `.vtt` file → Converts to transcription first (requires `--date`)
- `.md` file → Validates `type: transcription` in frontmatter
- Bare name → Expands to `00 Inbox/<name>.md`

See the skill for full workflow details.
