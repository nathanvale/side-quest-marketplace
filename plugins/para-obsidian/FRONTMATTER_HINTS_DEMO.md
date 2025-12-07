# Frontmatter Hints Enhancement

This document demonstrates the enhanced `frontmatter_set` MCP tool with enum value suggestions and type hints.

## Overview

The `para_frontmatter_set` tool now provides **helpful hints** when setting frontmatter fields, including:

- **Allowed enum values** for fields with restricted choices
- **Expected data types** (string, date, array, wikilink, enum)
- **Example values** demonstrating the correct format
- **Field descriptions** (when available)

## Example Outputs

### Setting Project Status

**Request:**
```json
{
  "file": "Projects/My Project.md",
  "set": { "status": "on-hold" }
}
```

**Response:**
```markdown
## Updated Frontmatter: Projects/My Project.md

**Changes:**
- set status ("active" → "on-hold")

---

**Hint for status:**
Type: enum
Allowed values: active, on-hold, completed, archived
Example: status: active
```

### Setting Task Priority

**Request:**
```json
{
  "file": "Tasks/Important Task.md",
  "set": { "priority": "high" }
}
```

**Response:**
```markdown
## Updated Frontmatter: Tasks/Important Task.md

**Changes:**
- set priority ("medium" → "high")

---

**Hint for priority:**
Type: enum
Allowed values: low, medium, high, urgent
Example: priority: low
```

### Setting Multiple Fields

**Request:**
```json
{
  "file": "Tasks/My Task.md",
  "set": {
    "status": "in-progress",
    "priority": "high",
    "effort": "large"
  }
}
```

**Response:**
```markdown
## Updated Frontmatter: Tasks/My Task.md

**Changes:**
- set status ("not-started" → "in-progress")
- set priority ("low" → "high")
- set effort ("small" → "large")

---

**Hint for status:**
Type: enum
Allowed values: not-started, in-progress, blocked, done, cancelled
Example: status: not-started

**Hint for priority:**
Type: enum
Allowed values: low, medium, high, urgent
Example: priority: low

**Hint for effort:**
Type: enum
Allowed values: small, medium, large
Example: effort: small
```

### Setting Array Field (Tags)

**Request:**
```json
{
  "file": "Projects/My Project.md",
  "set": { "tags": ["project", "work", "important"] }
}
```

**Response:**
```markdown
## Updated Frontmatter: Projects/My Project.md

**Changes:**
- set tags (["project"] → ["project","work","important"])

---

**Hint for tags:**
Type: array
Example: tags: ["project"]
```

### Setting Date Field

**Request:**
```json
{
  "file": "Projects/My Project.md",
  "set": { "start_date": "2024-02-01" }
}
```

**Response:**
```markdown
## Updated Frontmatter: Projects/My Project.md

**Changes:**
- set start_date ("2024-01-01" → "2024-02-01")

---

**Hint for start_date:**
Type: date
Example: start_date: 2025-12-06
```

### Setting Wikilink Field

**Request:**
```json
{
  "file": "Projects/My Project.md",
  "set": { "area": "[[Personal]]" }
}
```

**Response:**
```markdown
## Updated Frontmatter: Projects/My Project.md

**Changes:**
- set area ("[[Work]]" → "[[Personal]]")

---

**Hint for area:**
Type: wikilink
Example: area: [[Note Name]]

**IMPORTANT:** Wikilinks in YAML frontmatter must NOT be quoted for Dataview compatibility.
Use `area: [[Note Name]]` not `area: "[[Note Name]]"`
```

### Setting Resource Source

**Request:**
```json
{
  "file": "Resources/Learning Material.md",
  "set": { "source": "book" }
}
```

**Response:**
```markdown
## Updated Frontmatter: Resources/Learning Material.md

**Changes:**
- set source ("article" → "book")

---

**Hint for source:**
Type: enum
Allowed values: book, article, video, course, podcast, paper, web
Example: source: book
```

## Benefits

### 1. Discoverability
Users can discover valid values for enum fields without referring to documentation or templates.

### 2. Error Prevention
Clear hints reduce the likelihood of setting invalid values, making the tool more user-friendly.

### 3. Consistency
Examples demonstrate the expected format for different field types (dates, wikilinks, arrays).

### 4. Self-Documenting
The tool's responses serve as inline documentation for frontmatter schemas.

## Implementation Details

### Helper Functions

**`computeFrontmatterHint(config, noteType, field)`**
- Looks up field rules from `config.frontmatterRules`
- Returns hint object with allowed values, type, examples, and description
- Handles all field types: enum, array, date, wikilink, string

**`formatFrontmatterHint(field, hint)`**
- Formats hint object as human-readable markdown
- Includes type, allowed values, and examples
- Returns empty string if no hints available

### Integration Points

The `para_frontmatter_set` tool:
1. Reads current frontmatter to determine note type
2. Updates frontmatter using existing `updateFrontmatterFile` function
3. Computes hints for each field being set
4. Appends formatted hints to the response (after a separator line)

## Field Types Supported

| Type | Hint Includes | Example |
|------|---------------|---------|
| **enum** | Allowed values, first value as example | `status: active, on-hold, completed, archived` |
| **array** | Required includes (if any), format example | `tags: ["project"]` |
| **date** | Current date as example | `start_date: 2025-12-06` |
| **wikilink** | Format example | `area: [[Note Name]]` |
| **string** | Type only | `title: string` |

## Note Types with Enum Fields

### Project
- **status**: active, on-hold, completed, archived

### Task
- **task_type**: task, reminder, habit, chore
- **status**: not-started, in-progress, blocked, done, cancelled
- **priority**: low, medium, high, urgent
- **effort**: small, medium, large

### Resource
- **source**: book, article, video, course, podcast, paper, web

### Capture
- **status**: inbox
- **resonance**: inspiring, useful, personal, surprising
- **urgency**: high, medium, low

### Area
- **status**: active

## Testing

The implementation includes comprehensive test coverage:

### Unit Tests (`mcp/frontmatter-hints.test.ts`)
- 19 tests covering all hint computation scenarios
- Tests for all field types (enum, array, date, wikilink)
- Tests for hint formatting
- Tests for different note types

### Integration Tests (`mcp/frontmatter-hints-integration.test.ts`)
- 8 tests demonstrating complete workflow
- Tests with realistic note fixtures
- Verifies hints appear in tool responses
- Tests multiple fields, different note types

**Total: 27 new tests, all passing**

## Backward Compatibility

The enhancement is **fully backward compatible**:
- Existing tool behavior unchanged (still sets/unsets fields)
- Hints are **additive** (appended after changes section)
- JSON output format unchanged (hints only in markdown mode)
- No changes to input schema or required parameters

## Future Enhancements

Potential future improvements:
- Interactive prompts for invalid enum values
- Field-specific validation with suggestions for corrections
- Context-aware hints based on current field values
- Custom descriptions for commonly-used fields
