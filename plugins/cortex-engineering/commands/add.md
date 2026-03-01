---
name: add
description: Capture existing conversation research as a Cortex document
allowed-tools: Bash(cortex *:*), Read, Glob, Grep, Write
argument-hint: "[topic]"
---

# Capture Research to Cortex

Capture research that already happened in the current conversation as a Cortex document.

## Workflow

### 1. Review conversation context

Scan the conversation for:
- Research findings, key decisions, and conclusions
- Sources and links mentioned
- Technical details and code patterns discussed

### 2. Confirm with user

Ask the user to confirm:
- **Topic/title**: Suggest based on conversation content
- **Project**: Infer from working directory or ask
- **Tags**: Suggest relevant tags based on content

### 3. Synthesize

Use the **frontmatter** skill to create a properly structured document:
- Use the `research` doc type (or `decision`/`meeting` if more appropriate)
- Organize conversation findings into the correct section structure
- Include all sources and links mentioned in the conversation

### 4. Write and confirm

Save to the appropriate location:
- If in a project repo: `./docs/research/YYYY-MM-DD-<slug>.md`
- If no project context: `~/code/my-agent-cortex/docs/research/YYYY-MM-DD-<slug>.md`

Confirm: "Captured to `<path>`."

$ARGUMENTS
