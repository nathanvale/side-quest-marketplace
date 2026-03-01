# Argument Hints

The `argument-hint` frontmatter field appears in Claude Code's `/` autocomplete menu next to the skill/command name. It tells users what input is expected.

## POSIX/GNU Placeholder Conventions

| Syntax | Meaning | Example |
|--------|---------|---------|
| `<name>` | Required argument | `<topic>` |
| `[name]` | Optional argument | `[format]` |
| `{a\|b}` | Mutually exclusive choices | `{json\|markdown}` |
| `...` | Repeatable | `<file>...` |

## Rules

1. **Under 30 characters** -- the hint competes for horizontal space in autocomplete
2. **Use lowercase, descriptive nouns** that match what the user would type
3. **Angle brackets for required, square brackets for optional**
4. **Drop surrounding quotes** -- `argument-hint: <topic>` not `argument-hint: "<topic>"`

## Good Examples

```yaml
argument-hint: <issue-number>
argument-hint: <file> [format]
argument-hint: [search-term]
argument-hint: <source> <target>
argument-hint: <topic>
argument-hint: [branch-name]
```

## Bad Examples

```yaml
# Too long -- exceeds 30 chars, clutters autocomplete
argument-hint: <the topic you want to research in detail>

# No brackets -- unclear if required or optional
argument-hint: topic

# Too generic -- doesn't tell user what to type
argument-hint: <input>

# Meaningless -- zero information
argument-hint: <arg>

# Quoted -- unnecessary, adds visual noise
argument-hint: "<topic>"
```

## Combined Patterns

For skills that accept multiple arguments:

```yaml
# Two required args
argument-hint: <source> <target>

# Required + optional
argument-hint: <file> [format]

# Required + choices
argument-hint: <name> {json|markdown}

# Optional with repeatable
argument-hint: [file]...
```

## Accessing Arguments in Skill Content

Use `$ARGUMENTS` placeholder for all user input. Individual args are available as `$ARG1`, `$ARG2`, `$ARG3`.

If `$ARGUMENTS` is not present in the skill content, arguments are appended automatically at the end.
