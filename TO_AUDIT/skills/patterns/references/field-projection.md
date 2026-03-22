# Field Projection: Token-Efficient Output Selection

The `--fields` flag lets agents request only the fields they need, reducing output size dramatically. This is the single most impactful pattern for agent token economy.

## Usage

```bash
# Full output: every field on every event
observability events --json --limit 100

# Projected output: only id, type, and nested data.hookEvent
observability events --json --fields id,type,data.hookEvent --limit 100
```

## Token Economy: Why This Matters

Without field projection, a query returning 100 events might produce 13,000 tokens of output. With projection to 3 fields, the same query produces ~1,000 tokens.

This is the difference between an agent that can process results in one context window and one that truncates or fails. For agents with 4K-8K context budgets, field projection is not optional -- it's essential.

## Implementation

**Field projection** (`command.ts:1585-1594`):

```typescript
function projectFields(
  value: unknown,
  fields: readonly string[],
): Record<string, unknown> {
  const projected: Record<string, unknown> = {}
  for (const field of fields) {
    projected[field] = readPath(value, field)
  }
  return projected
}
```

**Dot-path traversal** (`command.ts:1596-1606`):

```typescript
function readPath(value: unknown, field: string): unknown {
  const segments = field.split('.').filter((s) => s.length > 0)
  let cursor: unknown = value
  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) {
      return undefined
    }
    cursor = (cursor as Record<string, unknown>)[segment]
  }
  return cursor
}
```

Dot-path supports arbitrary nesting: `data.hookEvent`, `data.payload.headers.contentType`.

## Field Validation

Fields are validated during argument parsing (`command.ts:1322-1334`):

```typescript
function parseFields(raw: string | null): readonly string[] | null {
  if (raw === null) return null
  const parsed = raw.split(',')
    .map((field) => field.trim())
    .filter((field) => field.length > 0)
  if (parsed.length === 0) return null
  if (parsed.some((field) => !/^[A-Za-z0-9_.-]+$/.test(field))) {
    return null
  }
  return parsed
}
```

Allowed characters: alphanumeric, dots, hyphens, underscores. This prevents injection through crafted field names.

## Application

Field projection is applied before output formatting (`command.ts:988-991`):

```typescript
const events = options.fields && options.fields.length > 0
  ? payload.map((event) => projectFields(event, options.fields ?? []))
  : payload
```

This works with all output modes -- JSON, JSONL, and human.

## Community Validation

**@flipbit03** (Lineark project): "13K tokens via MCP vs 1K via CLI." This is the killer argument for field projection. When agents can select only the fields they need, the token cost drops by an order of magnitude. Lineark specifically built field selection into their AI-native CLI for this reason.

## Implementation Checklist

- [ ] `--fields` accepts a comma-separated list of field names
- [ ] Dot-path traversal supports nested field access
- [ ] Field names are validated (alphanumeric + dots + hyphens + underscores only)
