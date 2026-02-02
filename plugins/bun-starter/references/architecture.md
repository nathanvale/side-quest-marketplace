# Architecture

## Overview

`nathanvale/bun-typescript-starter` is a production-ready GitHub template for TypeScript libraries published to npm. It uses Bun as the primary runtime with Node.js compatibility, Biome for linting/formatting, and Changesets for versioning.

## Tool Versions

| Tool | Version | Purpose |
|------|---------|---------|
| Bun | `.bun-version` file | Runtime, test runner, package manager |
| Node.js | `.nvmrc` (>=22.20) | npm publish (OIDC), compatibility testing |
| TypeScript | ~5.9.x | Type checking, declaration generation |
| Biome | ~2.3.x | Linting + formatting (replaces ESLint + Prettier) |
| Bunup | ~0.16.x | Build tool (ESM bundling + DTS generation) |
| Husky | ~9.1.x | Git hooks |
| Changesets | ~2.29.x | Version management + changelogs |
| Commitlint | ~20.x | Conventional commit enforcement |

## File Tree

```
bun-typescript-starter/
├── src/
│   └── index.ts                    # Library entry point
├── tests/
│   └── index.test.ts               # Bun native tests
├── scripts/
│   └── setup.ts                    # One-time setup wizard (self-deleting)
├── dist/                           # Build output (gitignored)
├── .changeset/
│   ├── config.json                 # Changesets config (public access, GitHub changelog)
│   └── README.md
├── .github/
│   ├── workflows/                  # 17 CI/CD workflows
│   ├── scripts/                    # 7 helper scripts (shell + JS)
│   ├── actions/                    # 4 composite actions
│   └── dependabot.yml              # Weekly GHA dependency updates
├── .husky/
│   ├── pre-commit                  # lint-staged (Biome check --write)
│   ├── commit-msg                  # commitlint validation
│   └── pre-push                    # Block direct push to main
├── .claude/
│   └── CLAUDE.md                   # Claude Code project instructions
├── package.json                    # Scripts, exports, publishConfig
├── tsconfig.json                   # Build config (ESNext, declaration)
├── tsconfig.base.json              # Shared strict settings
├── tsconfig.eslint.json            # Typecheck config (includes tests)
├── biome.json                      # Linting + formatting rules
├── bunup.config.ts                 # Build config (ESM, DTS, clean)
├── commitlint.config.mjs           # Conventional commits rules
├── .bun-version                    # Pinned Bun version
├── .nvmrc                          # Pinned Node version
└── .editorconfig                   # Editor settings
```

## Design Decisions

### Changesets vs Release Please

The template uses **Changesets** (not Release Please) because:

- **Developer intent**: Changesets require explicit changeset files per PR, making version bumps intentional rather than inferred from commit messages
- **Pre-release support**: Built-in `pre enter beta/rc/next` mode with snapshot publishing
- **Monorepo-ready**: Same tool works for single packages and workspaces
- **GitHub changelog**: `@changesets/changelog-github` auto-links PRs and contributors

Trade-off: More manual than Release Please's fully automatic approach. Each user-facing PR needs a changeset file (auto-generated if missing).

### Dual Runtime (Bun + Node)

- **Bun**: Primary runtime for development, testing, and building (fast, native TS)
- **Node.js**: Used only for `npm publish` (OIDC trusted publishing requires npm 11.6+)
- **Compatibility**: `node-compat.yml` workflow verifies built output works on Node.js

### ESM Only

- `"type": "module"` in package.json
- Single `"import"` condition in exports map
- No CJS fallback (modern ecosystem assumption)

## Future Enhancements

- **JSR publishing**: Dual publish to npm + JSR (as seen in ts-base). Would require `jsr.json` and a publish step in the release workflow.
- **Multiple entry points**: Currently single `src/index.ts`. Bunup supports multiple entries via array config.
