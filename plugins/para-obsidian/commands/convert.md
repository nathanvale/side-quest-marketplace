---
description: Convert a freeform note into a structured template using local LLM
argument-hint: <source-file> --template <type> [--model name] [--title override] [--dest path] [--dry-run]
allowed-tools: Bash(para-obsidian:*)
---

# Convert Note to Template

Transform an unstructured note into a PARA-compliant template using Ollama LLM inference.

The command reads your existing note, extracts structured data and sections using a local LLM model (default: `qwen2.5:14b`), then creates a new note with proper frontmatter and organized content sections.

## Usage

```bash
/para-obsidian:convert <source-file> --template <type> [options]
```

## Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `<source-file>` | Path to note to convert (relative to vault) | Yes |
| `--template <type>` | Target template type (project, booking, area, resource, etc.) | Yes |
| `--model <name>` | Ollama model name (default: qwen2.5:14b) | No |
| `--title <override>` | Custom title for new note | No |
| `--dest <path>` | Override default destination folder | No |
| `--dry-run` | Preview extraction without creating file | No |

## Examples

**Convert flight booking email to structured booking note:**
```bash
/para-obsidian:convert "01_Projects/2025 Tassie Holiday/01_Bookings/Flights Virgin Australia.md" \
  --template booking \
  --title "Virgin Australia Flights Tasmania 2025"
```

**Preview extraction before committing:**
```bash
/para-obsidian:convert "My Notes/Random Project Ideas.md" \
  --template project \
  --dry-run
```

**Convert with custom model:**
```bash
/para-obsidian:convert "Draft Notes.md" \
  --template area \
  --model llama2:13b
```

**Convert and place in specific folder:**
```bash
/para-obsidian:convert "Unsorted.md" \
  --template resource \
  --dest "02_Areas/Learning"
```

## Workflow

1. **Read** the source note (with or without existing frontmatter)
2. **Extract** structured data using local LLM (JSON format mode)
3. **Create** new note from template with extracted frontmatter
4. **Inject** content sections into corresponding template headings
5. **Validate** frontmatter against rules for template type
6. **Output** result or errors

## Requires

- **Ollama running locally** on `http://localhost:11434`
- **Model installed**: `ollama pull qwen2.5:14b` (or your preferred model)
- **PARA_VAULT** environment variable set

## Result

After conversion, you'll have:
- New note in appropriate PARA folder (or `--dest` if specified)
- Frontmatter extracted and validated
- Body sections organized under h2 headings matching template
- Original note left untouched
- Optional auto-commit (if enabled in config)

## Recommended Models

Choose based on your speed/quality preference:

```bash
# qwen2.5:14b — Default, balanced quality & speed
/para-obsidian:convert "file.md" --template booking --model qwen2.5:14b

# qwen2.5-coder:14b — Better for structured data extraction
/para-obsidian:convert "file.md" --template booking --model qwen2.5-coder:14b

# qwen2.5:7b — Faster, lighter, good for quick conversions
/para-obsidian:convert "file.md" --template booking --model qwen2.5:7b

# qwen2.5-coder:7b — Fastest, smaller model for quick extractions
/para-obsidian:convert "file.md" --template booking --model qwen2.5-coder:7b
```

## Tips

- **Dry-run first**: Use `--dry-run` to preview extraction before creating
- **Check model availability**: Run `ollama list` to see installed models
- **Install missing models**: `ollama pull qwen2.5:14b` or preferred model
- **Better quality**: Use coder variants for structured data (booking, project, etc.)
- **Faster extraction**: Use 7b variants for quicker results
