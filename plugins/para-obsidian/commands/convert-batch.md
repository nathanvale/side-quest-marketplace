# /para-obsidian:convert-batch

Batch convert multiple unsorted notes to PARA-compliant notes using the note-creator subagent.

## Usage

```
/para-obsidian:convert-batch <source-dir> <template> <dest-folder> [prefix] [project-arg]
```

## Parameters

- `source-dir` - Directory containing source notes (e.g., `_Sort/2025 Tassie Holiday/01_Bookings`)
- `template` - Template name (e.g., `booking`, `itinerary`, `research`, `checklist`)
- `dest-folder` - Destination folder path (e.g., `01 Projects/2025 Tassie Holiday`)
- `prefix` - (optional) Filename prefix for created notes (e.g., `Booking - `)
- `project-arg` - (optional) Project wikilink to inject (e.g., `project=[[2025 Tassie Holiday]]`)

## Examples

```
# Convert all booking files
/para-obsidian:convert-batch "_Sort/2025 Tassie Holiday/01_Bookings" booking "01 Projects/2025 Tassie Holiday" "Booking - " "project=[[2025 Tassie Holiday]]"

# Convert itinerary files
/para-obsidian:convert-batch "_Sort/2025 Tassie Holiday/02_Itinerary" itinerary "01 Projects/2025 Tassie Holiday" "Day {N} - " "project=[[2025 Tassie Holiday]]"
```

## How It Works

1. Invokes the `note-creator` subagent
2. Subagent lists all .md files in source directory
3. For each file: runs `para-obsidian create` with proper arguments
4. Validates all files were created successfully
5. Creates atomic git commit with conventional format
6. Reports results (created files, commit hash, any errors)

## Notes

- Source files must be in vault directory (relative paths)
- Destination folder is created if it doesn't exist
- Requires clean git state (no uncommitted changes)
- Each batch is one atomic commit
