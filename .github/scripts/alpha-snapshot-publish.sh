#!/usr/bin/env bash
# Perform an alpha snapshot version and publish. Requires NPM_TOKEN and GITHUB_TOKEN in env.

set -euo pipefail

annotate() {
	local level="${1:-notice}" # notice|warning
	local msg="${2:-}"
	case "$level" in
		warning) echo "::warning::${msg}" ;;
		*) echo "::notice::${msg}" ;;
	esac
	if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
		{
			echo "## Alpha Snapshot Publish"
			echo "${msg}"
		} >>"$GITHUB_STEP_SUMMARY"
	fi
}

if [[ -z "${NPM_TOKEN:-}" ]] || [[ -z "${GITHUB_TOKEN:-}" ]]; then
	missing=()
	[[ -z "${NPM_TOKEN:-}" ]] && missing+=("NPM_TOKEN")
	[[ -z "${GITHUB_TOKEN:-}" ]] && missing+=("GITHUB_TOKEN")
	annotate warning "Missing required secrets: ${missing[*]}. Skipping alpha snapshot publish."
	exit 0
fi

# Check if pre-release mode is active
if [[ -f .changeset/pre.json ]]; then
	annotate notice "Pre-release mode is active. Skipping alpha snapshot (use pre-release versioning instead)."
	exit 0
fi

# Trap to ensure cleanup on exit
trap 'rm -f "$HOME/.npmrc"' EXIT

# Authenticate npm for publish
{
	echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}"
} > "$HOME/.npmrc"
chmod 0600 "$HOME/.npmrc"

# Configure git identity and disable hooks for automation
git config user.name 'github-actions[bot]'
git config user.email 'github-actions[bot]@users.noreply.github.com'
export HUSKY=0
git config --global core.hooksPath /dev/null || true

annotate notice "Publishing alpha snapshot via Changesets (version snapshot + npm publish)."

bunx changeset version --snapshot alpha
bunx changeset publish --tag alpha
