# File Naming Convention

Standard for all para-brain note creation.

## Convention: Title Case with Spaces

**Format**: `Title Case with Spaces.md`

### Rules

1. **Use spaces** - Not underscores, not hyphens
2. **Title Case** - Capitalize first letter of each significant word
3. **No special characters** - Avoid `/ \ : * ? " < > |`
4. **Dates in ISO format** - Use `YYYY-MM-DD` when dates are part of title
5. **Numbers are fine** - `2025 Tassie Holiday.md`

### Examples

| User Input | Filename |
|------------|----------|
| "tassie holiday 2025" | `Tassie Holiday 2025.md` |
| "react best practices" | `React Best Practices.md` |
| "learn piano" | `Learn Piano.md` |
| "Q1 2025 goals" | `Q1 2025 Goals.md` |
| "nathan's birthday" | `Nathans Birthday.md` |

### Title Case Rules

- Capitalize: First word, nouns, verbs, adjectives, adverbs
- Lowercase: Articles (a, an, the), prepositions (in, on, at), conjunctions (and, but, or)
- Exception: Always capitalize first and last word

### Why This Convention

1. **Most readable** - Natural language, easy to scan
2. **Obsidian-friendly** - Handles spaces perfectly in wikilinks `[[Title Case]]`
3. **No cognitive load** - Write titles naturally
4. **Consistent** - Same format across all note types
5. **Unique names prevent conflicts** - Descriptive names avoid wikilink resolution issues

### Conversion Function (Pseudocode)

```
function toTitleCaseFilename(input):
  1. Trim whitespace
  2. Remove special characters: / \ : * ? " < > |
  3. Replace apostrophes with nothing (nathan's → nathans)
  4. Convert to Title Case
  5. Append .md
  return filename
```

### What NOT to Do

| Wrong | Right |
|-------|-------|
| `tassie_holiday_2025.md` | `Tassie Holiday 2025.md` |
| `tassie-holiday-2025.md` | `Tassie Holiday 2025.md` |
| `TASSIE HOLIDAY 2025.md` | `Tassie Holiday 2025.md` |
| `tassie holiday 2025.md` | `Tassie Holiday 2025.md` |

---

## Critical: Avoid Duplicate Filenames

### Why This Matters

Obsidian wikilinks `[[Note Name]]` search **the entire vault** by filename. If two files have the same name in different folders, wikilinks will resolve to the wrong file.

### Generic Names to Avoid

❌ **Never use these generic names:**
- `Overview.md`
- `README.md`
- `Index.md`
- `Notes.md`
- `Project.md`
- `Ideas.md`

✅ **Instead, use descriptive, specific names:**
- `2025 Tasmania Holiday.md` (not `Overview.md`)
- `React Best Practices.md` (not `Notes.md`)
- `Levi School Term 1.md` (not `Project.md`)

### Example: Project Overview Files

```
❌ BAD - Causes wikilink conflicts:
/01_Projects/Tassie Holiday/Overview.md
/01_Projects/Home Renovation/Overview.md
/01_Projects/Learn Piano/Overview.md

✅ GOOD - Unique, descriptive names:
/01_Projects/2025 Tassie Holiday/2025 Tasmania Holiday.md
/01_Projects/Home Renovation/Home Renovation Project.md
/01_Projects/Learn Piano/Learn Piano Journey.md
```

### Rule of Thumb

**Include the project/area name in the filename:**
- Project folder: `My Project/`
- Main note: `My Project.md` or `My Project Overview.md`
- Never just: `Overview.md`

This ensures wikilinks `[[My Project]]` work correctly across your entire vault.
