# GitHub Actions Helpers

## Composite Actions

### `standard-ci-env`

Sets two environment variables for deterministic CI:

| Variable | Value | Purpose |
|----------|-------|---------|
| `TZ` | `UTC` | Consistent timezone across runners |
| `TF_BUILD` | `true` | Signals CI environment to test frameworks |

Usage:
```yaml
- uses: ./.github/actions/standard-ci-env
```

### `setup-bun`

Installs Bun with dependency caching.

| Input | Default | Description |
|-------|---------|-------------|
| `bun-version` | `.bun-version` file | Bun version to install |
| `registry-url` | | Optional npm registry URL |

Cache key: `runner.os + bun.lock hash`

Usage:
```yaml
- uses: ./.github/actions/setup-bun
```

### `setup-pnpm`

Sets up pnpm + Node.js (used for npm publish with OIDC).

| Input | Default | Description |
|-------|---------|-------------|
| `registry-url` | | Optional npm registry URL |

Uses `.nvmrc` for Node version. Cache key: `.nvmrc hash + pnpm-lock.yaml hash`

### `coverage-comment`

Posts/updates a sticky coverage comment on PRs.

| Input | Required | Description |
|-------|----------|-------------|
| `lcov-path` | Yes | Path to lcov.info file |
| `min-lines` | Yes | Minimum line coverage % |
| `min-branches` | Yes | Minimum branch coverage % |
| `min-functions` | Yes | Minimum function coverage % |

Comment is identified by `<!-- coverage-report:sticky -->` HTML marker. Updates existing comment rather than creating duplicates.

Writes `coverage-comment.status` file: `breach` or `ok`.

## Helper Scripts

### `alpha-snapshot-publish.sh`

Publishes alpha snapshot to npm when in pre-release mode.

- Checks `.changeset/pre.json` exists (pre-mode active)
- Authenticates via `NPM_TOKEN`
- Runs `changeset version --snapshot alpha && changeset publish --tag alpha`
- Cleans up `.npmrc` via trap

### `changeset-detect-existing.sh`

Counts existing changeset markdown files in `.changeset/`.

- Output: `found=<count>` to `$GITHUB_OUTPUT`
- Used by `autogenerate-changeset.yml` to skip generation if changeset exists

### `changeset-generate-if-missing.sh`

Auto-generates a changeset file from PR context.

- Reads `PR_TITLE` and `PR_NUMBER` from environment
- Infers bump type: `feat` = minor, `breaking` = major, else patch
- Creates `.changeset/auto-<sanitized-title>.md`
- Commits and pushes (with `HUSKY=0`)

### `changesets-publish.sh`

Publishes via Changesets with OIDC or NPM_TOKEN fallback.

- Skips if pre-release mode active
- Preferred: OIDC trusted publishing (no token needed)
- Fallback: `NPM_TOKEN` environment variable
- Writes summary annotations

### `coverage-metrics.mjs`

Parses `lcov.info` and extracts coverage percentages.

- Modes: `outputs` (GitHub Action outputs) or `summary` (markdown table)
- Default path: `test-results/coverage/lcov.info`
- Reports 0% gracefully if file is missing

### `pre-mode-toggle.sh`

Toggles Changesets pre-release mode.

- Inputs: `ACTION` (enter/exit), `CHANNEL` (beta/rc/next)
- Creates branch `pre/<action>-<channel>-<run_id>`
- Formats `pre.json` with Biome
- Commits and pushes

### `validate-workflow-schema.sh`

Detects mis-indented YAML in workflow files (common copy-paste error where `env:` is followed by `with:` at wrong level).

## Bun 1.3.x Linker Bug Workaround

Multiple workflows include a cleanup step for a known Bun bug that leaks devDependency package folders to the project root:

```bash
for pkg in $(jq -r '.devDependencies | keys[]' package.json); do
  base=$(echo "$pkg" | sed 's|@.*/||')
  [ -d "$base" ] && rm -rf "$base"
done
```

This runs BEFORE tests and builds to prevent interference. Monitor Bun releases for a fix.
