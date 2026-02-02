---
description: Create a meeting note from transcription text, VTT file, or inbox note
argument-hint: "[text|file.vtt|file.md] [--type TYPE] [--date DATETIME]"
---

# Create Meeting

> **Deprecated:** Brain now routes directly to `create-meeting` skill. This command exists for backward compatibility with direct `/meeting` invocations.

Invoke the `create-meeting` skill.

## Instructions

Use the Skill tool to invoke `create-meeting` with the user's arguments:

```
Skill tool:
  skill: "para-obsidian:create-meeting"
  args: "$ARGUMENTS"
```

The skill handles:
- Inline text → creates transcription note, then meeting
- `.vtt` file → converts to transcription, then meeting
- `.md` file → validates type: transcription, then meeting
- Structured proposal → creates meeting directly (triage pipeline)
- No argument → asks what meeting to create
