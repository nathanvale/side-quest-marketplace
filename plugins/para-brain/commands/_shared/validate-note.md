# Note Validation

Validates frontmatter against PARA schemas. Call this when reading a note to detect outdated formats.

## Schemas by Type

### Project Schema (Required Fields)

```yaml
title: string          # Required
created: date          # Required
type: project          # Required
status: string         # Required: active, on-hold, completed, archived
start_date: date       # Required
target_completion: date # Required
area: "[[Link]]"       # Required
reviewed: date         # Required
review_period: string  # Optional, default 7d
tags: [project]        # Required
```

### Area Schema (Required Fields)

```yaml
title: string          # Required
created: date          # Required
type: area             # Required
status: string         # Required: active
reviewed: date         # Required
review_period: string  # Optional, default 14d
tags: [area]           # Required
```

### Resource Schema (Required Fields)

```yaml
title: string          # Required
created: date          # Required
type: resource         # Required
source: string         # Required: book, article, video, course, podcast, paper, web
areas: ["[[Link]]"]    # Required - array of area links (NEW)
reviewed: date         # Required (NEW)
tags: [resource]       # Required
```

### Task Schema (Required Fields)

```yaml
title: string          # Required
created: date          # Required
type: task             # Required
task_type: string      # Required: task, reminder, habit, chore
status: string         # Required: not-started, in-progress, blocked, done, cancelled
priority: string       # Required: low, medium, high, urgent
effort: string         # Required: small, medium, large
reviewed: date         # Required
tags: [task]           # Required
```

## Validation Function

When a command reads a note:

1. **Check `type:` field exists** - If missing, note is unformatted
2. **Look up schema for that type**
3. **Compare frontmatter to schema**
4. **Return missing/outdated fields**

## Validation Response Format

```markdown
### Note Validation: [[Note Title]]

**Type**: resource
**Status**: ⚠️ Needs update

**Missing fields**:
- `areas` - Required array of linked areas
- `reviewed` - Last review date

**Would you like to update this note?**
```

## Update Prompt

When validation finds issues, offer to fix:

```markdown
I can add the missing fields:
- `areas`: Which area(s) does this relate to?
- `reviewed`: I'll set to today's date

Update now? (y/n)
```

## How Commands Use This

```markdown
### In search.md, process.md, review.md:

After reading a note with `obsidian_get_file_contents`:

1. Parse frontmatter
2. Check against schema (see above)
3. If missing required fields:
   - Show validation warning
   - Ask if user wants to update
4. If user says yes:
   - Prompt for missing values
   - Use `obsidian_patch_content` to update frontmatter
5. Continue with original command purpose
```

## Common Migration Patterns

### Old Resource → New Resource

**Missing**: `areas`, `reviewed`

**Fix**:
1. Ask "Which area(s) does this resource relate to?"
2. Set `reviewed: [today]`
3. Patch frontmatter

### Unformatted Note → Typed Note

**Missing**: Everything

**Fix**:
1. Ask "What type is this? (project/area/resource/task)"
2. Apply appropriate template schema
3. Prompt for required fields by type

## Token Efficiency

- Only validate when note is already being read
- Don't re-validate if `reviewed` date is recent (< 7 days)
- Batch field prompts into single question when possible
