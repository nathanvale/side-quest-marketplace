#!/usr/bin/env bun
/**
 * Enable branch protection on the main branch.
 *
 * Run this after you've finished your initial setup commits and pushes.
 * Separated from the main setup script so that branch protection doesn't
 * block subsequent pushes during initial project configuration.
 *
 * Usage:
 *   bun run setup:protect
 */

import { readFileSync } from 'node:fs'

/** Check if GitHub CLI is installed and authenticated */
function hasGitHubCLI(): boolean {
	const result = Bun.spawnSync(['gh', 'auth', 'status'], {
		stdout: 'pipe',
		stderr: 'pipe',
	})
	return result.exitCode === 0
}

/** Detect repo owner/name from git remote or package.json */
function detectRepo(): string | null {
	// Try git remote first
	const result = Bun.spawnSync(
		['gh', 'repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'],
		{ stdout: 'pipe', stderr: 'pipe' },
	)
	if (result.exitCode === 0) {
		return new TextDecoder().decode(result.stdout).trim()
	}

	// Fallback: parse from package.json repository URL
	try {
		const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
		const url: string = pkg.repository?.url ?? ''
		const match = url.match(/github\.com[/:]([^/]+\/[^/.]+)/)
		if (match?.[1]) return match[1]
	} catch {
		// Ignore
	}

	return null
}

function run() {
	console.log('\n🔒 Branch Protection Setup\n')

	if (!hasGitHubCLI()) {
		console.error(
			'❌ GitHub CLI (gh) is required. Install it with: brew install gh',
		)
		process.exit(1)
	}

	const repo = detectRepo()
	if (!repo) {
		console.error('❌ Could not detect GitHub repository.')
		console.error('   Make sure you have a git remote pointing to GitHub.')
		process.exit(1)
	}

	console.log(`  Repository: ${repo}`)
	console.log('  Setting branch protection rules on main...\n')

	const protectionPayload = JSON.stringify({
		required_status_checks: {
			strict: true,
			contexts: ['All checks passed'],
		},
		enforce_admins: true,
		required_pull_request_reviews: {
			dismiss_stale_reviews: true,
			require_code_owner_reviews: false,
			required_approving_review_count: 0,
		},
		restrictions: null,
		required_linear_history: true,
		required_conversation_resolution: true,
		allow_force_pushes: false,
		allow_deletions: false,
	})

	const protectionResult = Bun.spawnSync(
		[
			'gh',
			'api',
			`repos/${repo}/branches/main/protection`,
			'--method',
			'PUT',
			'-H',
			'Accept: application/vnd.github+json',
			'--input',
			'-',
		],
		{
			stdin: new TextEncoder().encode(protectionPayload),
			stdout: 'pipe',
			stderr: 'pipe',
		},
	)

	if (protectionResult.exitCode !== 0) {
		const stderr = new TextDecoder().decode(protectionResult.stderr)
		if (stderr.includes('Not Found')) {
			console.error(
				'❌ Main branch not found. Push at least one commit before enabling protection.',
			)
		} else {
			console.error('❌ Could not configure branch protection.')
			console.error(`   ${stderr}`)
		}
		process.exit(1)
	}

	console.log('  ✅ Branch protection enabled on main!')
	console.log('     - Requires PR for all changes')
	console.log('     - Requires status checks: "All checks passed"')
	console.log('     - Requires conversation resolution')
	console.log('     - Requires linear history')
	console.log('     - Blocks force pushes and branch deletion')
}

run()
