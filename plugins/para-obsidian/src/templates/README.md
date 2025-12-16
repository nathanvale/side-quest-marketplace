# Template Services API

Template services for detecting, prompting, and creating Obsidian templates
as part of the classifier creation workflow.

## Quick Reference

| Service | Function | Purpose |
|---------|----------|---------|
| [detection.ts](detection.ts) | `detectTemplate()` | Check if template exists in vault |
| [choice.ts](choice.ts) | `promptTemplateChoice()` | Handle existing template collision |
| [choice.ts](choice.ts) | `promptTemplateCreation()` | Prompt for new template creation |
| [create.ts](create.ts) | `createTemplate()` | Orchestrate template creation |
| [scaffold.ts](scaffold.ts) | `generateBasicScaffold()` | Generate Templater template content |

## Typical Usage

```typescript
import { detectTemplate } from "./detection";
import { promptTemplateChoice, promptTemplateCreation } from "./choice";
import { createTemplate } from "./create";

// 1. Detect if template exists
const detection = await detectTemplate(vaultPath, templateName);

// 2. Get user's choice based on detection result
const choice = detection.exists
  ? await promptTemplateChoice(templateName, detection.path)
  : await promptTemplateCreation();

// 3. Create template if user chose to
const result = await createTemplate({
  vaultPath,
  templateName,
  noteType: classifierId,
  version: 1,
  fields,
  fieldMappings,
  choice,
});

if (result.created) {
  console.log(`Created: ${result.templatePath}`);
}
```

## Service Details

### Detection (`detection.ts`)

Detects existing templates using discriminated unions for type-safe pattern matching.

```typescript
const result = await detectTemplate("/vault", "invoice");

// Type-safe pattern matching
if (result.exists) {
  console.log(`Found at: ${result.path}`);
  console.log(`Content length: ${result.content.length}`);
} else {
  console.log(`Suggested path: ${result.suggestedPath}`);
}
```

**Parameters:**
- `vaultPath` - Path to Obsidian vault
- `templateName` - Template name (without `.md`)
- `templatesDir` - Optional custom templates directory (default: `"Templates"`)

### Choice Wizard (`choice.ts`)

Interactive prompts for template handling decisions.

**When template exists:**
```typescript
const choice = await promptTemplateChoice("invoice", "/vault/Templates/invoice.md");
// Returns: { action: "use-existing" | "create-new" | "skip", ... }
```

**When template doesn't exist:**
```typescript
const choice = await promptTemplateCreation();
// Returns: { action: "create-new" | "skip", mode: "basic" | "rich" }
```

### Creation (`create.ts`)

Orchestrates template creation with atomic file operations.

```typescript
const result = await createTemplate({
  vaultPath: "/vault",
  templateName: "medical-bill",
  noteType: "medical-bill",
  version: 1,
  fields: [...],
  fieldMappings: {...},
  choice: { action: "create-new", mode: "basic" },
});
```

**Returns:**
- `created` - Whether template was created
- `templatePath` - Path to created template (if created)
- `finalName` - Final template name (with suffix if applicable)

### Scaffold Generator (`scaffold.ts`)

Generates basic Templater templates from classifier field definitions.

```typescript
const content = generateBasicScaffold({
  name: "invoice",
  noteType: "invoice",
  version: 1,
  fields: [
    { name: "vendor", type: "string", description: "...", requirement: "required" },
    { name: "amount", type: "currency", description: "...", requirement: "required" },
  ],
  fieldMappings: {
    vendor: "Vendor Name",
    amount: "Total Amount",
  },
});
```

## User Choice Flow

```
Template Detection
       │
       ▼
  ┌─────────────────┐
  │ Template exists?│
  └────────┬────────┘
           │
     ┌─────┴─────┐
     │           │
    Yes          No
     │           │
     ▼           ▼
┌─────────┐  ┌─────────────┐
│ Choose: │  │ Create?     │
│ • use   │  │ • yes/no    │
│ • new   │  └──────┬──────┘
│ • skip  │         │
└────┬────┘    ┌────┴────┐
     │        Yes        No
     ▼         │         │
┌─────────┐   ▼         ▼
│ Suffix? │  Mode:    Skip
│ Mode?   │  • basic
└─────────┘  • rich
```

## Atomic Operations

All file writes use `atomicWriteFile` which:
1. Writes to temp file with UUID suffix
2. Performs atomic rename (OS-level)
3. Cleans up on failure

This prevents partial writes from corrupting data.

## Transaction Integration

Template creation integrates with the classifier transaction:

```typescript
tx.add({
  name: "create-template",
  execute: async () => createTemplate(config),
  rollback: async (result) => {
    if (result?.created && result.templatePath) {
      await fs.unlink(result.templatePath).catch(() => {});
    }
  },
});
```

If any step fails, template is automatically cleaned up.
