# /para-obsidian:transcribe

Convert voice memos or transcriptions to Obsidian capture notes.

## Usage

Based on what the user provides, run the appropriate CLI command:

### No arguments provided

Run:
```bash
para voice
```

This syncs new Apple Voice Memos from iCloud, transcribes them with parakeet-mlx, and appends log entries to daily notes.

### File path provided (VTT, text file, or transcription file)

Run:
```bash
para voice convert "<path>"
```

This reads the file, extracts text (with VTT parsing if needed), and creates a capture note in the inbox with LLM cleanup.

### Inline transcription text provided

Run:
```bash
para voice convert --text "<text>"
```

This converts the provided transcription text directly to a capture note with LLM cleanup.

## How to Detect Input Type

1. **No arguments**: User just runs `/transcribe` with nothing else
2. **File path**: Input contains a path (starts with `/`, `~`, `./`, or ends with `.vtt`, `.txt`, `.md`)
3. **Inline text**: Everything else - treat as transcription text to convert

## Output

The CLI will create a note at `00 Inbox/🎤 YYYY-MM-DD H-MMam.md` with:
- Frontmatter (type: transcription, source, recorded timestamp)
- LLM-cleaned transcription text
- Summary in frontmatter

Report the created note path and summary to the user.

## Examples

| User Input | Command to Run |
|------------|----------------|
| `/transcribe` | `para voice` |
| `/transcribe ~/Downloads/meeting.vtt` | `para voice convert "~/Downloads/meeting.vtt"` |
| `/transcribe ./notes.txt` | `para voice convert "./notes.txt"` |
| `/transcribe I need to remember to call the dentist tomorrow and pick up groceries` | `para voice convert --text "I need to remember to call the dentist tomorrow and pick up groceries"` |
