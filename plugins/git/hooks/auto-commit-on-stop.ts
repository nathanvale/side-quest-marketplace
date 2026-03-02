#!/usr/bin/env bun

/**
 * Auto-Commit On Stop Hook
 *
 * Stop hook that creates WIP checkpoints for tracked changes.
 */

import { readFile } from 'node:fs/promises'
import { postEvent } from './event-bus-client'
import { PROTECTED_BRANCHES } from './git-policy'
import type { FileStatusCounts } from './git-status-parser'
import { parsePorcelainStatus } from './git-status-parser'
import { getCurrentBranch, runGit } from './git-utils'

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
		typeof value.stop_hook_active !== 'undefined' &&
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
		const content = await readFile(transcriptPath, 'utf-8')
		const lines = content.split('\n').filter((line) => line.trim() !== '')

		let lastUserPrompt: string | null = null
		for (const line of lines) {
			try {
				const parsed = JSON.parse(line)
				if (parsed.type === 'user' && parsed.message?.content) {
					lastUserPrompt = parsed.message.content
				}
			} catch {
				// skip malformed lines
			}
		}

		return lastUserPrompt
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

	return `${prefix}${truncatedPrompt}\n\nSession work in progress - run /git:commit to squash.`
}

export async function createAutoCommit(
	cwd: string,
	message: string,
): Promise<boolean> {
	const addResult = await runGit(['add', '-u'], { cwd })
	if (addResult.exitCode !== 0) {
		return false
	}

	const commitResult = await runGit(['commit', '--no-verify', '-m', message], {
		cwd,
	})
	return commitResult.exitCode === 0
}

export function printUserNotification(commitMessage: string): void {
	const subjectLine = commitMessage.split('\n')[0]
	console.log(`✓ WIP checkpoint saved: ${subjectLine}`)
	console.log('  Run /git:commit when ready to finalize')
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

		if (status.staged === 0 && status.modified === 0) {
			// TODO: warn when status.untracked > 0, since git add -u won't stage them
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
