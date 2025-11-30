# Validators

Plugin validation utilities for the SideQuest marketplace.

## Available Validators

### `validateHooksJson`

Validates `hooks.json` files in Claude Code plugins.

**Usage:**

```typescript
import { validateHooksJson } from "./validators/hooks-json.ts";

const issues = await validateHooksJson("/path/to/plugin/hooks/hooks.json");

if (issues.length === 0) {
  console.log("hooks.json is valid!");
} else {
  for (const issue of issues) {
    console.log(`${issue.severity}: ${issue.message}`);
  }
}
```

**Validation Rules:**

| Rule ID | Description |
|---------|-------------|
| `hooks/file-not-found` | hooks.json file does not exist |
| `hooks/invalid-json` | File contains invalid JSON |
| `hooks/missing-hooks-object` | Missing or invalid "hooks" object |
| `hooks/invalid-event` | Invalid event type (must be SessionStart, PreToolUse, PostToolUse, Stop, or PreCompact) |
| `hooks/invalid-matchers-array` | Event value must be an array of matcher entries |
| `hooks/missing-hooks-array` | Matcher entry missing "hooks" array |
| `hooks/missing-type` | Hook entry missing "type" field |
| `hooks/invalid-type` | Hook type must be "command" |
| `hooks/missing-command` | Hook entry missing "command" field |
| `hooks/invalid-command-type` | Command must be a string |
| `hooks/empty-command` | Command cannot be empty |

**Valid Event Types:**

- `SessionStart` - Fires when Claude Code session starts
- `PreToolUse` - Fires before a tool is executed
- `PostToolUse` - Fires after a tool is executed
- `Stop` - Fires when session ends
- `PreCompact` - Fires before context compaction

**Example Valid hooks.json:**

```json
{
  "description": "My plugin hooks",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun run ${CLAUDE_PLUGIN_ROOT}/setup.ts",
            "timeout": 30
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bun run ${CLAUDE_PLUGIN_ROOT}/lint.ts"
          }
        ]
      }
    ]
  }
}
```

## Testing

Run validator tests:

```bash
# Unit tests
bun test src/validate/validators/hooks-json.test.ts

# Integration tests (validates real plugins)
bun test src/validate/validators/integration.test.ts

# All validator tests
bun test src/validate/validators/
```

## Adding New Validators

1. Create validator file: `src/validate/validators/my-validator.ts`
2. Export validation function that returns `ValidationIssue[]`
3. Create test file: `src/validate/validators/my-validator.test.ts`
4. Export from `src/validate/validators/index.ts`

**Validator Template:**

```typescript
import type { ValidationIssue } from "../types.ts";
import { Severity } from "../types.ts";

export async function validateMyThing(
  path: string
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Validation logic here
  if (somethingWrong) {
    issues.push({
      ruleId: "my-thing/rule-id",
      message: "Description of the problem",
      severity: Severity.ERROR,
      file: path,
      suggestion: "How to fix it"
    });
  }

  return issues;
}
```
