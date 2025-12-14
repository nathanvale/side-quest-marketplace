# Classifier Definitions

Each file in this folder defines a document classifier that can:

1. **Detect** documents via filename patterns and content markers
2. **Extract** structured fields using LLM
3. **Map** extracted fields to Obsidian templates

## Adding a New Classifier

### 1. Copy the template

```bash
cp _template.ts my-type.ts
```

### 2. Update the classifier definition

Edit `my-type.ts`:

```typescript
export const myTypeClassifier: InboxConverter = {
  schemaVersion: 1,
  id: "my-type",           // Unique ID, used as template name
  displayName: "My Type",  // Shown in UI
  enabled: true,
  priority: 80,            // Higher = checked first (0-100)

  heuristics: {
    filenamePatterns: [...],  // Regex patterns for filename
    contentMarkers: [...],    // Regex patterns for content
    threshold: 0.3,           // Min score to activate
  },

  fields: [...],              // Fields to extract
  extraction: {...},          // LLM hints
  template: {...},            // Obsidian template mapping
  scoring: {...},             // Confidence thresholds
};
```

### 3. Export from index.ts

```typescript
// In index.ts
export { myTypeClassifier } from "./my-type";

export const DEFAULT_CLASSIFIERS: readonly InboxConverter[] = [
  invoiceClassifier,
  bookingClassifier,
  myTypeClassifier,  // Add here
] as const;
```

### 4. Create Obsidian template

Create `Templates/my-type.md` in your vault with Templater prompts matching your `fieldMappings`.

## Classifier Structure

| Field | Purpose |
|-------|---------|
| `id` | Unique identifier, matches template filename |
| `displayName` | Human-readable name for UI |
| `enabled` | Toggle classifier on/off |
| `priority` | Order of checking (higher first) |
| `heuristics` | Pattern matching for detection |
| `fields` | Schema for LLM extraction |
| `extraction` | LLM prompt hints |
| `template` | Maps fields to Templater prompts |
| `scoring` | Confidence thresholds |

## Field Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text value | "Dr Smith Medical" |
| `date` | ISO date | "2024-12-01" |
| `currency` | Numeric amount | "220.00" |
| `number` | Integer/float | "42" |

## Requirement Levels

| Level | Description |
|-------|-------------|
| `required` | Must be present for valid extraction |
| `optional` | Nice to have, extraction succeeds without |
| `conditional` | Required only when `conditionalOn` field matches |

## Testing a New Classifier

```bash
# Run classifier tests
bun test classifiers

# Test with a specific file
bun run src/inbox/cli.ts scan --file path/to/test.pdf
```
