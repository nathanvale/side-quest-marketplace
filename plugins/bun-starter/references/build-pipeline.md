# Build Pipeline

## Bunup Configuration

```typescript
// bunup.config.ts
import { defineConfig } from 'bunup'

export default defineConfig({
  entry: './src/index.ts',
  outDir: './dist',
  format: 'esm',
  dts: true,
  clean: true,
  splitting: false,
})
```

| Option | Value | Purpose |
|--------|-------|---------|
| `entry` | `./src/index.ts` | Single entry point |
| `outDir` | `./dist` | Output directory |
| `format` | `esm` | ESM-only output |
| `dts` | `true` | Generate `.d.ts` declaration files |
| `clean` | `true` | Remove `dist/` before build |
| `splitting` | `false` | No code splitting (single bundle) |

## TypeScript Configuration

Three tsconfig files serve different purposes:

### `tsconfig.base.json` (shared strict settings)

```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "allowJs": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "resolveJsonModule": true,
    "types": ["bun-types"]
  }
}
```

### `tsconfig.json` (build - excludes tests)

- Extends `tsconfig.base.json`
- Sets `declaration: true`, `declarationMap: true`, `sourceMap: true`
- `rootDir: ./src`, `outDir: dist`
- Excludes test files from declaration output

### `tsconfig.eslint.json` (typecheck - includes tests)

- Extends `tsconfig.base.json`
- Includes `src/**/*.ts` and `tests/**/*.ts`
- Used by `bun run typecheck` command

## Package Exports

```json
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist/**", "README.md", "LICENSE", "CHANGELOG.md"]
}
```

Key points:
- **Types-first**: `types` condition before `import` (required by `@arethetypeswrong/cli`)
- **Package.json export**: Allows consumers to import package metadata
- **Files whitelist**: Only ships `dist/`, docs, and changelog

## Quality Checks

| Command | Tool | What it checks |
|---------|------|----------------|
| `bun run check:publint` | publint | Package structure (exports, files, types) |
| `bun run check:types` | @arethetypeswrong/cli | Type resolution correctness |
| `bun run hygiene` | Both above | Combined package health check |
| `bun run pack:dry` | bun pm pack | Dry-run pack to inspect tarball contents |

## Build Commands

```bash
bun run build        # Build with Bunup (ESM + DTS)
bun run clean        # Remove dist/ directory
bun run dev          # Watch mode (bun --watch src/index.ts)
```
