---
description: Full blast radius analysis for a code location
argument-hint: <file:line> or <symbol-name>
allowed-tools: Bash(kit-index:*)
model: claude-haiku-4-5-20251001
---

# Blast Radius Analysis

Comprehensive impact analysis: direct callers, transitive impact, and affected tests.

## Usage

```bash
bun run ${CLAUDE_PLUGIN_ROOT}/src/cli.ts blast $ARGUMENTS
```

The CLI accepts either `file:line` format (e.g., `src/utils.ts:42`) or a symbol name. It will show multi-level impact with direct callers, transitive callers, and affected tests.

## Analysis Steps

### 1. Identify the Symbol

```bash
cat PROJECT_INDEX.json | jq --arg name "$SYMBOL" '
  [.symbols | to_entries[] | .value[] | select(.name == $name)] | .[0]
'
```

### 2. Find Direct Callers (Level 1)

Use Grep to find immediate call sites:
- Pattern: `$SYMBOL\s*\(`
- Exclude definition file
- Parse results to extract caller functions

### 3. Find Transitive Callers (Level 2+)

For each direct caller found:
- Look up that function in the index
- Find its callers
- Build a call tree (limit depth to 3 levels)

### 4. Identify Affected Tests

```bash
# Find test files that import or call the affected code
cat PROJECT_INDEX.json | jq -r '.files[] | select(test("test|spec"))'
```

Cross-reference with callers to find relevant tests.

## Output Format

```
BLAST RADIUS: validateEmail (src/lib/validation.ts:42)
═══════════════════════════════════════════════════════

DIRECT CALLERS (Level 1):
├── createReferral (src/services/referral-service.ts:89)
├── updateContact (src/services/contact-service.ts:45)
└── validateForm (src/lib/form-utils.ts:123)

TRANSITIVE IMPACT (Level 2):
├── via createReferral:
│   ├── migrateCommand (src/commands/migrate.ts:56)
│   └── createCommand (src/commands/create.ts:34)
├── via updateContact:
│   └── syncCommand (src/commands/sync.ts:78)
└── via validateForm:
    └── FormComponent (src/components/Form.tsx:23)

FILES AFFECTED: 8
━━━━━━━━━━━━━━━━
src/services/referral-service.ts
src/services/contact-service.ts
src/lib/form-utils.ts
src/commands/migrate.ts
src/commands/create.ts
src/commands/sync.ts
src/components/Form.tsx
src/lib/validation.ts (definition)

TESTS TO RUN:
━━━━━━━━━━━━━
✓ tests/unit/validation.test.ts (direct)
✓ tests/unit/referral-service.test.ts (via referral-service)
✓ tests/integration/migrate.test.ts (via migrate command)
```

## Recommendations

Based on blast radius, provide guidance:
- **Small (< 5 files)**: Safe to refactor
- **Medium (5-15 files)**: Consider incremental changes
- **Large (> 15 files)**: Plan migration strategy, use feature flags
