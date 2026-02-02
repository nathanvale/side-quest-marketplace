# Path Workflows — Inline Text & VTT

Phase 1 workflows for converting raw input into a transcription note in the vault. Both use the same CLI under the hood — the difference is input format and whether a date prompt is needed.

---

## Path A: Inline Text

Converts raw text (pasted transcription, clipboard content) into a transcription note.

### Why the CLI

Shell escaping breaks with long transcription text containing quotes, newlines, and special characters. Writing to a temp file first avoids this entirely.

### Steps

**1. Write Text to Temp File**

Write the raw text to a scratchpad temp file:

```
Write tool:
  file_path: "<scratchpad_dir>/meeting-input-<timestamp>.txt"
  content: <the raw text>
```

**2. Convert via CLI**

```bash
cd ${CLAUDE_PLUGIN_ROOT} && bun src/cli.ts voice convert "<temp_file_path>" --format json
```

The CLI:
- Creates a transcription note in `00 Inbox/` with `type: transcription` frontmatter
- Generates a title and summary via LLM
- Returns JSON with `notePath`, `noteTitle`, and `summary`

**3. Parse Output**

```json
{
  "notePath": "00 Inbox/🎤 2026-02-02 3-45pm.md",
  "noteTitle": "🎤 2026-02-02 3-45pm",
  "summary": "Team discussion about sprint priorities"
}
```

Extract `notePath` — this is the transcription note to pass to Phase 2.

**4. Clean Up**

Delete the temp file after successful conversion.

### Date Handling

The CLI uses the current timestamp by default. If the user provided `--date`, pass it through:

```bash
cd ${CLAUDE_PLUGIN_ROOT} && bun src/cli.ts voice convert "<temp_file>" --date "2026-02-02T15:00:00" --format json
```

### Error Handling

| Error | Action |
|-------|--------|
| CLI exits non-zero | Report the stderr output, suggest checking text format |
| No JSON in stdout | Report raw output, suggest running CLI manually to debug |
| `notePath` missing | Report partial output, suggest manual transcription creation |

---

## Path B: VTT File

Converts a WebVTT subtitle/caption file into a transcription note.

### Steps

**1. Validate File Exists**

Check the VTT file path is accessible. If a relative path, resolve from the vault root or current working directory.

**2. Prompt for Date (if not provided)**

VTT files don't carry a recording timestamp. If `--date` was not passed:

```
AskUserQuestion:
  question: "When did this meeting take place?"
  options:
    - "Today" → use current date/time
    - "Yesterday" → use yesterday's date
    - Other → user provides ISO date
```

**3. Convert via CLI**

```bash
cd ${CLAUDE_PLUGIN_ROOT} && bun src/cli.ts voice convert "<vtt_file_path>" --format json
```

With date (if provided):

```bash
cd ${CLAUDE_PLUGIN_ROOT} && bun src/cli.ts voice convert "<vtt_file_path>" --date "<ISO_DATE>" --format json
```

The CLI detects `.vtt` extension automatically and:
- Extracts text content from VTT format (strips timestamps and formatting)
- Creates a transcription note in `00 Inbox/` with `type: transcription` frontmatter
- Returns JSON with `notePath`, `noteTitle`, and `summary`

**4. Parse Output**

Same as inline text — extract `notePath` from the JSON response to pass to Phase 2.

```json
{
  "notePath": "00 Inbox/🎤 2026-02-02 3-45pm.md",
  "noteTitle": "🎤 2026-02-02 3-45pm",
  "summary": "Sprint planning discussion with team"
}
```

### Error Handling

| Error | Action |
|-------|--------|
| File not found | Report exact path tried, suggest checking path |
| Invalid VTT format | Report CLI error, suggest checking file is valid WebVTT |
| CLI exits non-zero | Report stderr, suggest running CLI manually to debug |
