# Phase 4 Implementation: Template Detection & Integration

**Status:** ✅ Complete
**Date:** 2025-12-16
**Implements:** Phase 4 from validated-soaring-shannon.md plan

---

## Overview

Phase 4 adds template detection, choice flow, and automatic template creation to the create-classifier workflow. Users can now:

1. **Detect existing templates** in the vault
2. **Choose** to use existing, create new (with suffix), or skip
3. **Create templates** in basic or rich mode
4. **Integrate** template creation into the classifier transaction with proper rollback

---

## Files Created

### Template Detection Service
**`src/templates/detection.ts`** - Template detection with discriminated union results

```typescript
export async function detectTemplate(
  vaultPath: string,
  templateName: string
): Promise<TemplateDetectionResult>
```

**Returns:**
- `{ exists: true, path: string, content: string }` - Template found
- `{ exists: false, suggestedPath: string }` - Template not found

### Template Choice Wizard
**`src/templates/choice.ts`** - Interactive prompts for template handling

```typescript
export async function promptTemplateChoice(
  templateName: string,
  existingPath: string
): Promise<TemplateChoice>

export async function promptTemplateCreation(): Promise<TemplateChoice>
```

**Returns:**
- `{ action: "use-existing" }` - Use existing template
- `{ action: "create-new", suffix?: string, mode: "basic" | "rich" }` - Create new
- `{ action: "skip" }` - Don't create template

### Basic Template Scaffold
**`src/templates/scaffold.ts`** - Basic Templater template generator

```typescript
export function generateBasicScaffold(config: ScaffoldConfig): string
```

Generates simple Templater templates with:
- YAML frontmatter with field prompts
- Title prompt
- Details section with field mappings
- Notes section
- Processed timestamp

### Template Creation Service
**`src/templates/create.ts`** - Orchestrates template creation

```typescript
export async function createTemplate(
  config: CreateTemplateConfig
): Promise<CreateTemplateResult>
```

Handles:
- Basic scaffold generation
- Rich mode (TODO: integrate template-assistant skill)
- Atomic file writes
- Template name with suffix

---

## Integration Points

### CLI Integration
**Updated: `src/cli/create-classifier.ts`**

Added template detection and creation after field mappings:

```typescript
// Step 4.5: Template Detection & Choice
const templateDetection = await detectTemplate(config.vault, templateName);

let templateChoice: TemplateChoice;
if (templateDetection.exists) {
  templateChoice = await promptTemplateChoice(templateName, templateDetection.path);
} else {
  templateChoice = await promptTemplateCreation();
}

// Add template creation to transaction
tx.add({
  name: "create-template",
  execute: async () => {
    templateResult = await createTemplate({
      vaultPath: config.vault,
      templateName,
      noteType: id,
      version: 1,
      fields,
      fieldMappings,
      choice: templateChoice,
    });
    return templateResult;
  },
  rollback: async (result) => {
    // Clean up template file if it was created
    if (result?.created && result.templatePath) {
      await fs.unlink(result.templatePath).catch(() => {});
    }
  },
});
```

### Success Messages
Updated success output to show template status:

```
✅ Classifier created: /path/to/classifier.ts
✅ Registry updated: /path/to/index.ts
✅ Template created: /vault/Templates/invoice.md

📝 Next steps:
  1. Run: bun typecheck
  2. Test with: bun run src/cli.ts process-inbox scan
```

---

## Tests

### Detection Tests
**`src/templates/detection.test.ts`** - 4 tests, all passing

- Returns exists: true when template exists
- Returns exists: false when template doesn't exist
- Handles kebab-case template names
- Returns full content for existing templates

### Scaffold Tests
**`src/templates/scaffold.test.ts`** - 9 tests, all passing

- Generates valid Templater template
- Marks optional fields correctly
- Handles date/currency/number fields
- Generates valid YAML frontmatter
- Uses field mappings for prompt labels
- Handles empty field mappings

### Creation Tests
**`src/templates/create.test.ts`** - 7 tests, all passing

- Skips creation when action is 'skip'
- Skips creation when action is 'use-existing'
- Creates basic template when action is 'create-new'
- Creates template with suffix when provided
- Uses atomic file write
- Handles rich mode by falling back to basic
- Creates Templates directory if it doesn't exist

---

## Type Safety

### Discriminated Unions

All template operations use discriminated unions for type-safe pattern matching:

```typescript
// Detection result
type TemplateDetectionResult =
  | { exists: true; path: string; content: string }
  | { exists: false; suggestedPath: string }

// User choice
type TemplateChoice =
  | { action: "use-existing" }
  | { action: "create-new"; suffix?: string; mode: "basic" | "rich" }
  | { action: "skip" }
```

This enables exhaustive pattern matching and prevents runtime errors.

---

## Atomic Operations

All file writes use `atomicWriteFile` from `src/shared/atomic-fs.ts`:

1. Write to temp file with UUID suffix
2. Atomic rename (OS-level operation)
3. Clean up temp file on failure

This prevents partial writes from corrupting data.

---

## Transaction Rollback

Template creation is part of the classifier transaction:

```typescript
const tx = new Transaction();
tx.add({ name: "create-classifier-file", ... });
tx.add({ name: "update-registry", ... });
tx.add({ name: "create-template", ... });

const result = await tx.execute();
if (!result.success) {
  // All operations rolled back automatically
  throw new Error(`Transaction failed at ${result.failedAt}`);
}
```

If any step fails, all completed operations are rolled back in reverse order.

---

## Future Enhancements

### Rich Mode (TODO)

Currently falls back to basic scaffold. Future implementation will:

1. Invoke template-assistant skill
2. Pass classifier context and fields
3. Generate enhanced template with:
   - Better section organization
   - Contextual prompts
   - Field-specific validation
   - Examples and help text

```typescript
// Future implementation
if (choice.mode === "rich") {
  content = await invokeTemplateAssistant({
    templateName: finalName,
    fields: config.fields,
    fieldMappings: config.fieldMappings,
    noteType: config.noteType,
    context: `Template for ${config.noteType} inbox items`
  });
}
```

---

## Validation Results

**TypeScript:** ✅ All types valid, no errors
**Biome:** ✅ All checks pass, code formatted
**Tests:** ✅ 125 tests pass, 223 assertions
**Coverage:** Detection, scaffold, creation services fully tested

---

## Usage Example

```bash
# Create a new classifier
bun run src/cli.ts create-classifier medical-bill

# Wizard flow:
# 1. Basic info (id, display name, priority, area)
# 2. Heuristic patterns (filename, content markers)
# 3. Field extraction definitions
# 4. Template configuration
#    → Detects existing template
#    → Prompts: use existing / create new / skip
#    → If create new: basic / rich mode
#    → Optional suffix for new template
# 5. Scoring configuration (optional)
# 6. Validation
# 7. Transaction execution
#    → Create classifier file
#    → Update registry
#    → Create template (if chosen)
# 8. Success message with next steps
```

---

## Key Decisions

1. **Discriminated unions** - Type-safe pattern matching prevents runtime errors
2. **Atomic writes** - Temp + rename pattern prevents corruption
3. **Transaction integration** - Template creation rolls back with classifier
4. **Basic mode first** - Rich mode deferred to future iteration
5. **Suffix support** - Allows multiple versions without overwriting
6. **Templates dir auto-creation** - ensureParentDir handles directory creation

---

## Related Files

- Plan: `~/.claude/plans/validated-soaring-shannon.md`
- Types: `src/inbox/classify/classifiers/types.ts` (TemplateDetectionResult, TemplateChoice)
- Atomic FS: `src/shared/atomic-fs.ts`
- Transaction: `src/shared/transaction.ts`
- Validation: `src/shared/validation.ts`
- Command spec: `commands/create-classifier.md`
