#!/usr/bin/env bun

/**
 * Auto-Commit On Stop Hook
 *
 * Stop hook that creates WIP checkpoints for tracked AND untracked changes.
 * Untracked files are staged individually (never `git add .` or `git add -A`).
 * Noise patterns (.DS_Store, node_modules/, .env) are always excluded.
 */

import { postEvent } from './event-bus-client'
import { PROTECTED_BRANCHES } from './git-policy'
import type { FileStatusCounts } from './git-status-parser'
import { parsePorcelainStatus } from './git-status-parser'
import { getCurrentBranch, runGit } from './git-utils'

/**
 * Filename patterns that should never be auto-committed.
 * Checked against the full path returned by `git status --porcelain`.
 */
const NOISE_PATTERNS = [
	/\.DS_Store$/,
	/(^|[\\/])node_modules[\\/]/,
	/(^|[\\/])\.(env|env\..*)$/,
	/(^|[\\/])\.npmrc$/,
	/(^|[\\/])id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/,
	/\.(pem|key|p12|pfx)$/i,
	/(^|[\\/])\.aws[\\/]credentials$/,
	/(^|[\\/])\.ssh[\\/]/,
]

interface StopHookInput {
	cwd: string
	transcript_path: string
	stop_hook_active?: boolean
}

function isStopHookInput(value: unknown): value is StopHookInput {
	if (!value || typeof value !== 'object') return false
	if (!('cwd' in value) || typeof value.cwd !== 'string') return false
	if (
		!('transcript_path' in value) ||
		typeof value.transcript_path !== 'string'
	)
		return false
	if (
		'stop_hook_active' in value &&
		value.stop_hook_active !== undefined &&
		typeof value.stop_hook_active !== 'boolean'
	) {
		return false
	}
	return true
}

export async function getGitStatus(
	cwd: string,
): Promise<FileStatusCounts | null> {
	const result = await runGit(['status', '--porcelain'], { cwd })
	if (result.exitCode !== 0) {
		return null
	}
	return parsePorcelainStatus(result.stdout).counts
}

export async function getLastUserPrompt(
	transcriptPath: string,
): Promise<string | null> {
	try {
		const file = Bun.file(transcriptPath)
		const size = file.size
		if (size === 0) return null
		const chunkSize = Math.min(size, 10_240)
		const tail = await file.slice(size - chunkSize, size).text()
		const lines = tail.split('\n').filter((line) => line.trim() !== '')

		for (let i = lines.length - 1; i >= 0; i--) {
			try {
				const parsed = JSON.parse(lines[i]!)
				if (parsed.type === 'user' && parsed.message?.content) {
					return parsed.message.content
				}
			} catch {
				// skip malformed/partial lines
			}
		}
		return null
	} catch {
		return null
	}
}

export function truncateForSubject(text: string, maxLen: number): string {
	if (text.length <= maxLen) {
		return text
	}
	return `${text.slice(0, maxLen - 3)}...`
}

export function generateCommitMessage(prompt: string | null): string {
	const prefix = 'chore(wip): '
	const subjectMaxLen = 50 - prefix.length
	const effectivePrompt =
		typeof prompt === 'string' && prompt.trim() !== ''
			? prompt
			: 'session checkpoint'
	const truncatedPrompt = truncateForSubject(effectivePrompt, subjectMaxLen)

	return `${prefix}${truncatedPrompt}\n\nSession work in progress - run /dx-git:commit to squash.`
}

/**
 * Returns true if a file path matches any noise pattern.
 * Noise files are never auto-committed.
 */
export function isNoiseFile(filePath: string): boolean {
	return NOISE_PATTERNS.some((pattern) => pattern.test(filePath))
}

/**
 * Extracts untracked file paths from `git status --porcelain` output.
 * Returns only paths, not the status prefix. Already respects .gitignore
 * because `git status` does not list ignored files by default.
 */
export function parseUntrackedFiles(porcelainOutput: string): string[] {
	return porcelainOutput
		.split('\n')
		.filter((line) => line.startsWith('?? '))
		.map((line) => line.slice(3).replace(/^"(.*)"$/, '$1'))
}

/**
 * Stages specific untracked files individually.
 * Returns the count of files successfully staged.
 */
export async function stageUntrackedFiles(
	cwd: string,
	files: string[],
): Promise<number> {
	let staged = 0
	for (const file of files) {
		const result = await runGit(['add', '--', file], { cwd })
		if (result.exitCode === 0) {
			staged++
		}
	}
	return staged
}

/**
 * Creates a WIP checkpoint commit including both tracked and untracked files.
 *
 * Tracked changes are staged with `git add -u`. Untracked files are detected,
 * filtered for noise, and staged individually. A warning is printed for any
 * skipped noise files so the user knows they exist but were excluded.
 */
export async function createAutoCommit(
	cwd: string,
	message: string,
): Promise<boolean> {
	// Stage tracked file changes
	const addResult = await runGit(['add', '-u'], { cwd })
	if (addResult.exitCode !== 0) {
		return false
	}

	// Detect and handle untracked files
	const statusResult = await runGit(['status', '--porcelain'], { cwd })
	if (statusResult.exitCode === 0) {
		const untrackedFiles = parseUntrackedFiles(statusResult.stdout)

		if (untrackedFiles.length > 0) {
			const includable = untrackedFiles.filter((file) => !isNoiseFile(file))
			const noise = untrackedFiles.filter((file) => isNoiseFile(file))

			// Stage non-noise untracked files
			if (includable.length > 0) {
				const stagedCount = await stageUntrackedFiles(cwd, includable)
				if (stagedCount > 0) {
					console.log(`  Added ${stagedCount} untracked file(s) to checkpoint`)
				}
			}

			// Warn about skipped noise files
			if (noise.length > 0) {
				console.log(
					`  Skipped ${noise.length} noise file(s): ${noise.join(', ')}`,
				)
			}
		}
	}

	const commitResult = await runGit(['commit', '--no-verify', '-m', message], {
		cwd,
	})
	return commitResult.exitCode === 0
}

export function printUserNotification(commitMessage: string): void {
	const subjectLine = commitMessage.split('\n')[0]
	console.log(`✓ WIP checkpoint saved: ${subjectLine}`)
	console.log('  Run /dx-git:commit when ready to finalize')
}

if (import.meta.main) {
	// Self-destruct timer: first executable line when run as entry point.
	// Set to 80% of hooks.json timeout (10s).
	const selfDestruct = setTimeout(() => {
		process.stderr.write('auto-commit-on-stop: timed out\n')
		process.exit(1)
	}, 8_000)
	selfDestruct.unref()

	try {
		let input: StopHookInput
		try {
			const parsed = await Bun.stdin.json()
			if (!isStopHookInput(parsed)) {
				process.exit(0)
			}
			input = parsed
		} catch {
			process.exit(0)
		}

		if (input.stop_hook_active) {
			process.exit(0)
		}

		const status = await getGitStatus(input.cwd)
		if (!status) {
			process.exit(0)
		}

		if (
			status.staged === 0 &&
			status.modified === 0 &&
			status.untracked === 0
		) {
			process.exit(0)
		}

		// Skip WIP checkpoint on protected branches
		const branch = await getCurrentBranch(input.cwd)
		if (branch && PROTECTED_BRANCHES.includes(branch)) {
			process.exit(0)
		}

		const lastPrompt = await getLastUserPrompt(input.transcript_path)
		const commitMessage = generateCommitMessage(lastPrompt)
		const success = await createAutoCommit(input.cwd, commitMessage)

		if (success) {
			printUserNotification(commitMessage)
		} else {
			console.error(
				'Warning: Failed to create WIP commit. Changes remain uncommitted.',
			)
		}

		try {
			await postEvent(input.cwd, 'session.ended', {
				committed: success,
				branch,
			})
		} catch {
			// event emission is best-effort
		}
	} catch {
		// never crash the hook
	}

	process.exit(0)
}
