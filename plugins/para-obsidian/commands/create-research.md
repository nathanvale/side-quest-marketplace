Create a research note for investigation and analysis.

Research notes capture findings, comparisons, and decision-making context.

## Required Arguments
- `$TITLE` - Research topic title
- `$RESEARCH_TYPE` - Type: comparison | investigation | decision | exploration
- `$PROJECT` - Related project as wikilink

## Optional Arguments
- `$STATUS` - Status: in-progress | completed | abandoned (default: in-progress)
- `$DEST` - Destination folder (default: 00_Inbox)

## Auto-filled Fields
- `created` - Today's date
- `template_version` - 2
- `tags` - Always includes "research"

## Frontmatter Hints
- **research_type**: comparison, investigation, decision, exploration
- **status**: in-progress | completed | abandoned
- **Suggested tags**: research, analysis, decision

## Command
```bash
para-obsidian create --template research \
  --title "$TITLE" \
  --dest "${DEST:-00_Inbox}" \
  --arg "Research title=$TITLE" \
  --arg "Research type=$RESEARCH_TYPE" \
  --arg "Project=$PROJECT" \
  --arg "Status=${STATUS:-in-progress}"
```

## Example Usage

For tool comparison: "Comparing testing frameworks"

```
TITLE: "Jest vs Vitest vs Bun Test Comparison"
RESEARCH_TYPE: "comparison"
PROJECT: "[[Website Redesign]]"
```

For decision making: "Which cloud provider to use"

```
TITLE: "Cloud Provider Selection - AWS vs GCP vs Azure"
RESEARCH_TYPE: "decision"
PROJECT: "[[Infrastructure Migration]]"
STATUS: "in-progress"
```

For exploration: "Understanding WebAuthn"

```
TITLE: "WebAuthn and Passkeys Deep Dive"
RESEARCH_TYPE: "exploration"
PROJECT: "[[Auth System Upgrade]]"
```
