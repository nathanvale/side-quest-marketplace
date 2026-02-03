# Monorepo Conversion Guide

How to convert a `bun-typescript-starter` single-package repo into a Bun workspace monorepo.

## Real-World Example

`nathanvale/side-quest-runners` was built by converting the template into a monorepo with 3 packages:
- `@side-quest/bun-runner`
- `@side-quest/biome-runner`
- `@side-quest/tsc-runner`

## Conversion Steps

### 1. Root package.json

Make it private with workspaces:

```json
{
  "name": "@scope/monorepo",
  "version": "0.0.0",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "bun run --filter '*' build",
    "test": "bun run --filter '*' test",
    "typecheck": "bun run --filter '*' typecheck",
    "clean": "bun run --filter '*' clean"
  }
}
```

**CRITICAL — Bun filter syntax:** The `--filter` flag goes **after** `run`, not before:

```bash
bun run --filter '*' build    # Correct
bun --filter '*' run build    # WRONG — "No packages matched the filter"
```

### 2. Delete template source

Remove the single-package scaffolding:

```bash
rm -rf src/ tests/ scripts/setup.ts scripts/version-gen.ts
rm -f bunup.config.ts tsconfig.eslint.json
```

### 3. Create packages directory

```bash
mkdir -p packages/
```

### 4. Per-package structure

Each package under `packages/<name>/`:

```
packages/<name>/
├── mcp/                    # or src/ — your source
│   ├── index.ts
│   └── index.test.ts
├── bunup.config.ts         # Entry point for bundle
├── tsconfig.json           # Extends ../../tsconfig.base.json
├── package.json            # Publishable
├── CHANGELOG.md
├── README.md
└── LICENSE
```

### 5. Per-package package.json

```json
{
  "name": "@scope/package-name",
  "version": "0.0.0",
  "type": "module",
  "bin": {
    "package-name": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist/**", "README.md", "LICENSE", "CHANGELOG.md"],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/owner/repo.git",
    "directory": "packages/package-name"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "scripts": {
    "build": "bunx bunup",
    "clean": "rimraf dist 2>/dev/null || true",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  }
}
```

**bin field:** Use object format with a short name. String format causes npm to use the scoped package name, which gets auto-corrected.

### 6. TypeScript configuration

**Root `tsconfig.json`:**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "declaration": true,
    "outDir": "dist",
    "types": ["bun-types"]
  },
  "include": ["packages/*/mcp/**/*.ts", "packages/*/src/**/*.ts"]
}
```

**Per-package `tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.json",
  "include": ["mcp/**/*.ts"],
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "dist"
  }
}
```

## Changesets Configuration

Update `.changeset/config.json` for monorepo:

```json
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "access": "public",
  "baseBranch": "main",
  "changelog": [
    "@changesets/changelog-github",
    { "repo": "owner/repo" }
  ],
  "commit": false,
  "packages": ["packages/*"]
}
```

**Key change:** Add `"packages": ["packages/*"]` so changesets discovers workspace packages.

## CI/CD Workflow Adaptations

### changeset-generate-if-missing.sh

The template script hardcodes a single package name. For monorepo, dynamically discover all packages:

```bash
# Instead of: printf 'package-name: %s\n' "$TYPE"
# Use dynamic package discovery:
PACKAGES=$(node -e "
  const fs = require('fs');
  const path = require('path');
  const dirs = fs.readdirSync('packages', { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => path.join('packages', d.name, 'package.json'))
    .filter(p => fs.existsSync(p));
  dirs.forEach(p => {
    const pkg = JSON.parse(fs.readFileSync(p, 'utf-8'));
    if (!pkg.private) console.log(pkg.name);
  });
")

for PKG in $PACKAGES; do
  printf '"%s": %s\n' "$PKG" "$TYPE"
done
```

### publish.yml — Per-package GitHub Releases

The template creates a single release. For monorepo, iterate over `publishedPackages`:

```yaml
- name: Create GitHub Releases (stable)
  if: steps.intent.outputs.value == 'auto' && steps.changesets.outputs.published == 'true'
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    PUBLISHED='${{ steps.changesets.outputs.publishedPackages }}'
    echo "$PUBLISHED" | jq -c '.[]' | while read -r PKG; do
      NAME=$(echo "$PKG" | jq -r '.name')
      VERSION=$(echo "$PKG" | jq -r '.version')
      TAG="${NAME}@${VERSION}"
      echo "Creating release for ${TAG}"
      if ! git rev-parse "${TAG}" >/dev/null 2>&1; then
        git tag "${TAG}"
        git push origin "${TAG}"
      fi
      if ! gh release view "${TAG}" >/dev/null 2>&1; then
        gh release create "${TAG}" --title "${TAG}" --generate-notes
      fi
    done
```

### pr-quality.yml

Replace single-package commands with filter commands:

```yaml
# Instead of: bun run build
# Use: bun run --filter '*' build

# Instead of: bun test
# Use: bun run --filter '*' test
```

### changesets-publish.sh

Update build step:

```bash
# Instead of: bun run build
bun run --filter '*' build
```

## First Publish (Scoped Packages)

First publish of scoped packages must be done locally:

```bash
# For each package:
cd packages/<name>
npm publish --access public --no-provenance
```

**Why:** npm OIDC trusted publishing requires the package to already exist. First publish bootstraps it.

After first publish, configure OIDC trusted publishing at npmjs.com for CI automation.

## Bun + Node.js Module Resolution

When using `changesets/action` in a Bun-managed repo, the action's bundled Node.js runtime cannot resolve packages installed by Bun. This is because Bun uses a `.bun/` symlink layout inside `node_modules/` that Node.js `require()` cannot traverse.

### The Problem

1. `changesets/action` internally does `require("@changesets/cli")` using Node.js
2. Bun installs packages into `node_modules/.bun/` with symlinks — Node.js can't follow these
3. `npm install --no-save @changesets/cli` fails because npm can't parse Bun's `node_modules` layout
4. Result: "Have you forgotten to install and build your dependencies?" error

### The Solution

Install changesets into a separate prefix directory and export `NODE_PATH`:

```yaml
- name: Ensure changesets CLI is Node-resolvable
  run: |
    npm install --prefix .npm-changesets @changesets/cli @changesets/changelog-github
    echo "NODE_PATH=$(pwd)/.npm-changesets/node_modules" >> "$GITHUB_ENV"
```

This keeps Bun's layout intact while giving Node.js a clean resolution path.

### Related Requirements

- **Never delete `node_modules/.bun`** — Bun uses this directory for package resolution (symlinks, subpath exports). Removing it breaks `@scope/pkg/subpath` imports.
- **Add `.npm-changesets/` to `.gitignore`** — The changesets action runs `git add .` when creating version PRs, which picks up the prefix directory if not ignored.
- **Don't use `@*` cleanup patterns** — The `find . -name '@*'` pattern deletes ALL scoped directories, including legitimate ones like `@changesets/`. Only clean `*@@@*` suffixed artifacts (actual Bun linker bugs).

## Known Gotchas

| Issue | Cause | Fix |
|-------|-------|-----|
| "No packages matched the filter" | Wrong `--filter` position | Use `bun run --filter '*' build` not `bun --filter '*' run build` |
| npm auto-corrects bin field | String bin format with scoped name | Use object format: `"bin": { "short-name": "./dist/index.js" }` |
| Changeset generates for wrong package | Hardcoded package name in script | Use dynamic package discovery (see above) |
| Package 404 after publish | npm CDN propagation delay | Wait 2-5 minutes, check `curl -s 'https://registry.npmjs.org/-/package/@scope/name/dist-tags'` |
| First publish fails with OIDC | Package doesn't exist yet | Must do first publish locally with `--no-provenance` |
