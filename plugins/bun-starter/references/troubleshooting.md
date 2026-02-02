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
| E404 on first publish (OIDC) | OIDC needs package to exist | Use `NPM_TOKEN` for first publish, then configure OIDC | npm settings |
| "Access token expired or revoked" | Classic tokens revoked (Dec 2025) | Create granular token at `npmjs.com/settings/<user>/tokens/granular-access-tokens/new` | npm settings |
| OIDC auth fails | Not configured after first publish | Configure at `npmjs.com/package/<pkg>/access` | npm settings |
| OIDC auth fails (2) | npm version too old | Ensure Node 24+ (npm 11.6+) in CI | `.nvmrc` |
| Version PR not appearing | No pending changesets | Create changeset: `bun version:gen` | `.changeset/` |
| Pre-release leaking to stable | Still in pre-mode | Run `bun run pre:exit` | `.changeset/pre.json` |
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

### Setup Issues

| Symptom | Cause | Fix | Config File |
|---------|-------|-----|-------------|
| Setup script not found | Already ran (self-deleting) | Placeholders already replaced; check package.json | `scripts/setup.ts` |
| `gh` commands fail | Not authenticated | Run `gh auth login` | n/a |
| Branch protection fails | Main branch doesn't exist | Push code first, then configure | `scripts/setup.ts` |
| Placeholders not replaced | Setup didn't complete | Re-run setup or manually replace `{{...}}` in files | `package.json`, `.changeset/config.json` |

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

## When to Use `/bun-starter:fix`

Use the fix command when:
- The issue is in the **template itself** (not your project-specific code)
- Multiple downstream repos would benefit from the fix
- The fix involves CI workflows, build config, or template infrastructure

The fix command will create a PR directly against `nathanvale/bun-typescript-starter`.
