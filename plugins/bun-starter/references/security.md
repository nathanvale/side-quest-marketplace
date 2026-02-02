# Security

## CodeQL (`codeql.yml`)

GitHub's semantic code analysis for JavaScript/TypeScript.

- **Trigger**: Push to main, PRs to main, weekly schedule (Monday 05:00 UTC), manual
- **Build mode**: `none` (no build step needed for JS/TS)
- **Timeout**: 30 minutes
- **Results**: Posted to Security tab as code scanning alerts

## OSV-Scanner (`security.yml`)

Google's Open Source Vulnerability scanner for dependency auditing.

- **Trigger**: Weekly (Monday 06:00 UTC), manual
- **What it scans**: `package.json`, `bun.lock` for known CVEs
- **Results**: Posted to Security tab via SARIF upload

## Dependency Review (`dependency-review.yml`)

Scans PRs for newly introduced vulnerable dependencies.

- **Trigger**: PRs (opened, synchronize, reopened)
- **Behavior**: Non-blocking (`continue-on-error: true`), always posts summary comment
- **What it checks**: New/changed dependencies against GitHub Advisory Database

## Dependabot (`dependabot.yml`)

Automated dependency updates for GitHub Actions only.

```yaml
version: 2
updates:
  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'weekly'
      day: 'sunday'
    open-pull-requests-limit: 10
    commit-message:
      prefix: 'chore(gha)'
      include: 'scope'
```

**Auto-merge**: `dependabot-auto-merge.yml` auto-merges minor/patch dev-dependency updates from Dependabot. Triple-gated:
1. Actor must be `dependabot[bot]`
2. PR must have `dev-dependencies` label
3. Changed files must only be package manifests/lockfiles

## Security Hardening Patterns

### Harden Runner

Every workflow uses `step-security/harden-runner`:
```yaml
- uses: step-security/harden-runner@...
  with:
    egress-policy: audit
```

Monitors network egress from CI jobs. Currently in audit mode (log-only).

### Pinned Action SHAs

All action references use full commit SHAs instead of version tags:
```yaml
# Good (pinned)
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2

# Avoid (unpinned)
- uses: actions/checkout@v4
```

Prevents supply chain attacks via tag-pointing changes.

### Minimal Permissions

Each workflow declares only the permissions it needs:
```yaml
permissions:
  contents: read
  security-events: write  # Only if uploading SARIF
```

### SBOM Generation

Release workflows generate CycloneDX Software Bill of Materials:
```yaml
- uses: anchore/sbom-action@...
  with:
    format: cyclonedx-json
    artifact-name: sbom-cyclonedx.json
```

## Manual Security Audit

```bash
bun run security:audit    # npm audit (checks npm advisory database)
```

## Troubleshooting

### CodeQL taking too long

- 30-minute timeout is set. For large codebases, consider excluding generated files
- `build-mode: none` means no compilation step — should be fast for JS/TS

### OSV-Scanner false positives

- Check if the vulnerability applies to your usage (dev-only vs production)
- File an issue on the OSV database if the advisory is incorrect

### Dependabot PRs not auto-merging

- Ensure the `dev-dependencies` label exists on the PR
- Check that changed files are only package manifests (not source code)
- Verify the `dependabot-auto-merge.yml` workflow has `pull-requests: write` permission
