# Classifier Migrations

This directory contains migration infrastructure for upgrading `InboxConverter` schemas
when breaking changes are introduced.

## Overview

The `schemaVersion` field on `InboxConverter` enables forward-compatible changes.
When the converter structure needs breaking changes, we:

1. Increment `CURRENT_SCHEMA_VERSION` in `registry.ts`
2. Add a migration function here to transform old converters
3. Run migrations at registry initialization time

## Current Version

**Schema Version: 1** (initial release)

## Migration Strategy

Migrations run automatically when:
- Loading user-defined converters from config files
- Importing converters from external plugins

Built-in converters (`DEFAULT_INBOX_CONVERTERS`) are always at the current version.

## Adding a New Migration

When you need to make breaking changes to `InboxConverter`:

1. Create a migration file: `v1-to-v2.ts`
2. Export a migration function that transforms the old shape to new
3. Register it in `index.ts`
4. Update `CURRENT_SCHEMA_VERSION` in `registry.ts`

### Example Migration

```typescript
// v1-to-v2.ts
import type { InboxConverter } from "../../converters/types";

/**
 * Migrate converter from schema v1 to v2.
 *
 * Changes in v2:
 * - Renamed `heuristics.threshold` to `heuristics.minScore`
 * - Added required `heuristics.maxScore` field
 */
export function migrateV1ToV2(converter: InboxConverterV1): InboxConverter {
  return {
    ...converter,
    schemaVersion: 2,
    heuristics: {
      ...converter.heuristics,
      minScore: converter.heuristics.threshold ?? 0.3,
      maxScore: 1.0, // New field with sensible default
    },
  };
}
```

## File Structure

```
migrations/
├── README.md          # This file
├── index.ts           # Migration registry and runner
├── migrate.ts         # Migration type definitions
└── v1-to-v2.ts        # Example: future migration
```

## Testing Migrations

Always test migrations with:
1. Converters at the current version (should pass through unchanged)
2. Converters at older versions (should be transformed)
3. Converters at newer versions (should throw an error)

```typescript
describe("migrations", () => {
  test("v1 converter passes through unchanged", () => {
    const v1Converter = { schemaVersion: 1, ... };
    expect(runMigrations(v1Converter)).toEqual(v1Converter);
  });
});
```
