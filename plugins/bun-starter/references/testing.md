# Testing

## Framework

Bun's native test runner (`bun:test`). No external test framework needed.

## Test Structure

```
tests/
└── index.test.ts     # Tests alongside or mirroring src/ structure
```

Tests use `describe`/`it`/`expect` from `bun:test`:

```typescript
import { describe, expect, it } from 'bun:test'
import { greet } from '../src/index'

describe('greet', () => {
  it('returns a greeting message', () => {
    expect(greet('World')).toBe('Hello, World!')
  })
})
```

## Commands

| Command | Purpose |
|---------|---------|
| `bun test` | Run all tests recursively |
| `bun test --watch` | Watch mode |
| `bun test --coverage` | Run with V8 coverage |
| `bun run test:ci` | CI mode (`TF_BUILD=true`, deterministic output) |

## CI Mode

Setting `TF_BUILD=true` enables CI-optimized output:
- Deterministic ordering
- JUnit-compatible reporter
- No interactive features

The `standard-ci-env` composite action sets this automatically.

## Coverage

Coverage uses Bun's built-in V8 coverage:

```bash
bun test --coverage
# Outputs lcov.info to test-results/coverage/lcov.info
```

### Coverage in CI (`pr-quality.yml`)

1. Tests run with `--coverage`, outputting `lcov.info`
2. `coverage-metrics.mjs` script parses lcov and extracts line/branch/function percentages
3. `coverage-comment` composite action posts a sticky PR comment with:
   - Coverage table (lines, branches, functions)
   - Per-file breakdown for files below threshold
   - Pass/fail status based on configurable thresholds

### Default Thresholds

| Metric | Threshold |
|--------|-----------|
| Lines | 80% |
| Branches | 80% |
| Functions | 80% |

## Troubleshooting

### Tests pass locally but fail in CI

- Check `TF_BUILD=true` is set (changes output format)
- Bun 1.3.x linker bug: CI workflows clean leaked package folders before tests (see `ci-cd-pipelines.md`)
- Timezone: CI uses `TZ=UTC` via `standard-ci-env` action

### Coverage not generating

- Ensure `--coverage` flag is passed
- Check lcov output path matches what `coverage-metrics.mjs` expects
