# Troubleshooting

Master routing table for diagnosing issues in repos created from `nathanvale/bun-typescript-starter`.

## Routing Table

### Build Issues

| Symptom | Cause | Fix | Config File |
|---------|-------|-----|-------------|
| `bunup` fails with "entry not found" | Wrong entry path | Check `bunup.config.ts` entry matches actual file | `bunup.config.ts` |
| No `.d.ts` files in dist | `dts: false` or missing | Set `dts: true` in bunup config | `bunup.config.ts` |
| Types resolve incorrectly | `types` not first in exports | Move `types` before `import` in exports map | `package.json` |
| `publint` reports issues | Package structure mismatch | Run `bun run pack:dry` to inspect tarball | `package.json` |
| `are-the-types-wrong` fails | Type conditions out of order | Follow `types` -> `import` order in exports | `package.json` |
| Build output not ESM | Missing `"type": "module"` | Add to package.json | `package.json` |

### Test Issues

| Symptom | Cause | Fix | Config File |
|---------|-------|-----|-------------|
| Tests pass locally, fail in CI | Missing `TF_BUILD=true` | Uses `standard-ci-env` action (sets automatically) | `.github/actions/standard-ci-env/action.yml` |
| Tests fail with leaked dirs | Bun 1.3.x linker bug | Add cleanup step before tests (see `github-actions-helpers.md`) | `pr-quality.yml` |
| Coverage at 0% | Missing `--coverage` flag | Add flag to test command | `package.json` scripts |
| Coverage comment not appearing | Missing permissions | Ensure `pull-requests: write` in workflow | `pr-quality.yml` |
| Import errors in tests | Wrong tsconfig | Tests use `tsconfig.eslint.json` (includes test files) | `tsconfig.eslint.json` |

### Lint & Format Issues

| Symptom | Cause | Fix | Config File |
|---------|-------|-----|-------------|
| Biome fails on `{{PLACEHOLDER}}` | Template syntax detected | Run `bun run setup` first, or add override | `biome.json` |
| Commitlint rejects message | Wrong format | Use `type(scope): subject` format | `commitlint.config.mjs` |
| Pre-commit hook fails | Staged files have lint errors | Run `bun run check` to auto-fix | `biome.json` |
| Pre-push blocked | Pushing to main directly | Create feature branch + PR | `.husky/pre-push` |
| actionlint warnings | Workflow YAML issues | Run `bun run lint:workflows` locally | `.github/workflows/*.yml` |

### Publishing Issues

| Symptom | Cause | Fix | Config File |
|---------|-------|-----|-------------|
| 403 Forbidden on npm publish | Missing access config | Add `publishConfig.access: "public"` | `package.json` |
| E404 on first publish (any token) | Scoped package never published | Run `npm publish --access public --no-provenance` locally first, then CI handles subsequent publishes | `package.json` |
| "provenance generation not supported for provider: null" | `--provenance` used outside CI | Add `--no-provenance` flag — provenance only works in GitHub Actions OIDC | n/a |
| "Access token expired or revoked" | Classic tokens revoked (Dec 2025) | Create granular token at `npmjs.com/settings/<user>/tokens/granular-access-tokens/new` | npm settings |
| OIDC auth fails | Not configured after first publish | Configure at `npmjs.com/package/<pkg>/access` (Trusted Publisher section) | npm settings |
| OIDC auth fails (2) | npm version too old | Ensure Node 24+ (npm 11.6+) in CI | `.nvmrc` |
| Version PR not appearing | No pending changesets | Create changeset: `bun version:gen` | `.changeset/` |
| Version PR not appearing (2) | Workflow lacks write permissions | Enable "Read and write permissions" + "Allow PRs" in Settings → Actions → General | GitHub repo settings |
| Pre-release leaking to stable | Still in pre-mode | Run `bun run pre:exit` | `.changeset/pre.json` |
| Stable publish produces empty package | Missing `bun run build` before publish | Add `bun run build` before `bun run release` in `changesets-publish.sh` | `.github/scripts/changesets-publish.sh` |
| `gh release create` fails on re-run | Tag or release already exists | Guard with `git rev-parse` and `gh release view` checks | `.github/workflows/publish.yml` |
| `npm warn publish "bin[name]" script name was invalid and removed` | `./` prefix in bin path | Run `npm pkg fix` or remove `./` prefix: use `"dist/cli.js"` not `"./dist/cli.js"` | `package.json` |
| `bunfig.toml` registry conflict | Bun setup writes registry | Delete registry line from bunfig.toml | `bunfig.toml` |
| Publish skips (pre-mode active) | Script detects pre.json | Exit pre-mode or use `publish:pre` | `.changeset/pre.json` |

### CI/CD Issues

| Symptom | Cause | Fix | Config File |
|---------|-------|-----|-------------|
| Workflow not triggering | Path filter excludes changes | Check `paths:` in workflow trigger | `.github/workflows/*.yml` |
| "All checks passed" status missing | Gate job didn't run | Ensure `gate` job depends on all other jobs | `pr-quality.yml` |
| Dependabot PR not auto-merging | Missing label | Add `dev-dependencies` label | `dependabot-auto-merge.yml` |
| Auto-merge fails on version PR | Needs elevated permissions | Configure 1Password + GitHub App | `version-packages-auto-merge.yml` |
| CodeQL timeout | Analysis too slow | Increase timeout or exclude dirs | `codeql.yml` |
| SBOM not generated | anchore/sbom-action issue | Check action version is pinned to valid SHA | `release.yml` |
| `Cannot find module '@scope/pkg/subpath'` in CI | Cleanup step deletes `node_modules/.bun` | Remove `node_modules/.bun` from `rm -rf` in cleanup steps | `publish.yml`, `pr-quality.yml` |
| `changesets/action` fails with "Have you forgotten to install?" | Bun's `.bun/` symlink layout invisible to Node.js `require()` | Use `npm install --prefix .npm-changesets` + `NODE_PATH` | `publish.yml` |
| `.npm-changesets/` files appear in version PR | Prefix directory not gitignored | Add `.npm-changesets/` to `.gitignore` | `.gitignore` |
| `npm install --no-save` crashes with "Cannot read properties of null" | npm can't parse Bun's node_modules layout | Use `npm install --prefix` instead of `--no-save` | `publish.yml` |

### Setup Issues

| Symptom | Cause | Fix | Config File |
|---------|-------|-----|-------------|
| Setup script not found | Already ran (self-deleting) | Placeholders already replaced; check package.json | `scripts/setup.ts` |
| `gh` commands fail | Not authenticated | Run `gh auth login` | n/a |
| Branch protection fails | Main branch doesn't exist | Push code first, then configure | `scripts/setup.ts` |
| Placeholders not replaced | Setup didn't complete | Re-run setup or manually replace `{{...}}` in files | `package.json`, `.changeset/config.json` |
| Changesets can't create version PRs | Workflow permissions not configured | Enable "Read and write permissions" + "Allow PRs" in repo Settings → Actions → General | GitHub repo settings |

## Quick Diagnostic Commands

```bash
# Check build
bun run build && bun run hygiene

# Check all quality gates
bun run validate

# Inspect package contents
bun run pack:dry

# Check changeset status
npx changeset status

# Verify git hooks
ls -la .husky/

# Test CI locally
TF_BUILD=true bun test --recursive
```

### Monorepo Issues

| Symptom | Cause | Fix | Config File |
|---------|-------|-----|-------------|
| "No packages matched the filter" | Wrong `--filter` position in bun command | Use `bun run --filter '*' build` not `bun --filter '*' run build` | `package.json` scripts |
| npm auto-corrects bin field on publish | String bin format with scoped name | Use object format: `"bin": { "short-name": "./dist/index.js" }` | `package.json` |
| Changeset generates for wrong package | Hardcoded `imessage-timeline` in template script | Use dynamic package discovery (see `monorepo.md`) | `.github/scripts/changeset-generate-if-missing.sh` |
| Package 404 right after publish | npm CDN propagation delay | Wait 2-5 min, verify via dist-tags endpoint | n/a |
| First scoped publish fails with OIDC | Package must exist before OIDC works | First publish locally: `npm publish --access public --no-provenance` | n/a |
| Per-package releases not created | Template creates single release | Use `publishedPackages` JSON iteration (see `monorepo.md`) | `.github/workflows/publish.yml` |

## When to Use `/bun-starter:fix`

Use the fix command when:
- The issue is in the **template itself** (not your project-specific code)
- Multiple downstream repos would benefit from the fix
- The fix involves CI workflows, build config, or template infrastructure

The fix command will create a PR directly against `nathanvale/bun-typescript-starter`.
