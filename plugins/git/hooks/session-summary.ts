#!/usr/bin/env bun

/**
 * Session Summary Hook (Cortex Pattern)
 *
 * PreCompact hook that extracts salient content and appends summary artifacts.
 */

import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getRepoKeyFromGitRoot, postEvent } from './event-bus-client'
import { getMainWorktreeRoot } from './git-status-parser'
import { isGitRepo, runGit } from './git-utils'

interface PreCompactHookInput {
	cwd: string
	transcript_path?: string
}

function isPreCompactHookInput(value: unknown): value is PreCompactHookInput {
	if (!value || typeof value !== 'object') return false
	if (!('cwd' in value) || typeof value.cwd !== 'string') return false
	if (
		'transcript_path' in value &&
		typeof value.transcript_path !== 'undefined' &&
		typeof value.transcript_path !== 'string'
	) {
		return false
	}
	return true
}

export interface CortexEntry {
	timestamp: string
	type: 'decision' | 'error_fix' | 'learning' | 'preference'
	salience: number
	content: string
	context?: string
}

interface SaliencePattern {
	type: CortexEntry['type']
	salience: number
	patterns: RegExp[]
}

const SALIENCE_PATTERNS: SaliencePattern[] = [
	{
		type: 'decision',
		salience: 0.9,
		patterns: [
			/decided to\s+(.+)/i,
			/going with\s+(.+)/i,
			/the approach is\s+(.+)/i,
			/we(?:'ll| will) use\s+(.+)/i,
			/let(?:'s| us) go with\s+(.+)/i,
		],
	},
	{
		type: 'error_fix',
		salience: 0.8,
		patterns: [
			/(?:fixed|resolved|solved)\s+(?:by|with|the)\s+(.+)/i,
			/the (?:fix|solution) (?:was|is)\s+(.+)/i,
			/error was caused by\s+(.+)/i,
			/root cause(?::| was)\s+(.+)/i,
		],
	},
	{
		type: 'learning',
		salience: 0.7,
		patterns: [
			/(?:TIL|learned that)\s+(.+)/i,
			/turns out\s+(.+)/i,
			/the issue was\s+(.+)/i,
			/(?:discovered|found out)\s+(?:that\s+)?(.+)/i,
		],
	},
	{
		type: 'preference',
		salience: 0.7,
		patterns: [
			/always\s+(.+)/i,
			/never\s+(.+)/i,
			/prefer\s+(.+)/i,
			/(?:I|we) want\s+(.+)/i,
		],
	},
]

/**
 * Scans a JSONL conversation transcript for salient patterns (decisions,
 * error fixes, learnings, preferences) and returns structured cortex entries.
 * These survive compaction so valuable context is not lost between sessions.
 */
export function extractFromTranscript(transcriptText: string): CortexEntry[] {
	const entries: CortexEntry[] = []
	const now = new Date().toISOString()
	const lines = transcriptText.split('\n').filter((line) => line.trim() !== '')
	const textContent: string[] = []

	for (const line of lines) {
		try {
			const parsed = JSON.parse(line)
			if (
				parsed.type === 'user' &&
				typeof parsed.message?.content === 'string'
			) {
				textContent.push(parsed.message.content)
			}
			if (
				parsed.type === 'assistant' &&
				typeof parsed.message?.content === 'string'
			) {
				textContent.push(parsed.message.content)
			}
			if (
				parsed.type === 'assistant' &&
				Array.isArray(parsed.message?.content)
			) {
				for (const block of parsed.message.content) {
					if (block?.type === 'text' && typeof block.text === 'string') {
						textContent.push(block.text)
					}
				}
			}
		} catch {
			// skip malformed lines
		}
	}

	const sentences = textContent
		.join('\n')
		.split(/[.!?\n]+/)
		.map((sentence) => sentence.trim())
		.filter((sentence) => sentence.length > 10)

	for (const sentence of sentences) {
		for (const pattern of SALIENCE_PATTERNS) {
			for (const regex of pattern.patterns) {
				const match = sentence.match(regex)
				if (!match?.[1]) {
					continue
				}

				entries.push({
					timestamp: now,
					type: pattern.type,
					salience: pattern.salience,
					content: match[1].trim().slice(0, 200),
					context: sentence.slice(0, 300),
				})
				break
			}
		}
	}

	const seen = new Set<string>()
	return entries.filter((entry) => {
		const key = `${entry.type}:${entry.content}`
		if (seen.has(key)) {
			return false
		}
		seen.add(key)
		return true
	})
}

async function getGitStateSummary(cwd: string): Promise<string> {
	const opts = { cwd, stderr: 'pipe' as const }
	const branchResult = await runGit(['branch', '--show-current'], opts)
	const branch =
		branchResult.exitCode === 0
			? branchResult.stdout || '(detached)'
			: '(detached)'

	const commitsResult = await runGit(
		['log', '--oneline', '--since=1 hour ago'],
		opts,
	)
	const commits =
		commitsResult.exitCode === 0
			? commitsResult.stdout
					.split('\n')
					.map((line) => line.trim())
					.filter(Boolean)
					.slice(0, 10)
			: []

	const statusResult = await runGit(['status', '--porcelain'], opts)
	const status =
		statusResult.exitCode === 0
			? statusResult.stdout
					.split('\n')
					.map((line) => line.trimEnd())
					.filter(Boolean)
					.slice(0, 20)
			: []

	let summary = `Branch: ${branch}`
	if (commits.length > 0) {
		summary += `\nSession commits:\n${commits.join('\n')}`
	}
	if (status.length > 0) {
		summary += `\nUncommitted:\n${status.join('\n')}`
	}
	return summary
}

async function ensureDirectory(dir: string): Promise<void> {
	await mkdir(dir, { recursive: true })
}

if (import.meta.main) {
	// Self-destruct timer: first executable line when run as entry point.
	// Set to 80% of hooks.json timeout (15s).
	const selfDestruct = setTimeout(() => {
		process.stderr.write('session-summary: timed out\n')
		process.exit(1)
	}, 12_000)
	selfDestruct.unref()

	try {
		let input: PreCompactHookInput
		try {
			const parsed = await Bun.stdin.json()
			if (!isPreCompactHookInput(parsed)) {
				process.exit(0)
			}
			input = parsed
		} catch {
			process.exit(0)
		}

		if (!(await isGitRepo(input.cwd))) {
			process.exit(0)
		}

		const gitRoot = await getMainWorktreeRoot(input.cwd)
		if (!gitRoot) {
			process.exit(0)
		}

		const repoName = getRepoKeyFromGitRoot(gitRoot)
		let cortexEntries: CortexEntry[] = []

		if (input.transcript_path) {
			try {
				const transcriptText = await readFile(input.transcript_path, 'utf-8')
				cortexEntries = extractFromTranscript(transcriptText)
			} catch {
				// proceed with git state only
			}
		}

		if (cortexEntries.length > 0) {
			const cortexDir = join(homedir(), '.claude', 'cortex')
			await ensureDirectory(cortexDir)
			const cortexPath = join(cortexDir, `${repoName}.jsonl`)
			const lines = cortexEntries
				.map((entry) => `${JSON.stringify(entry)}\n`)
				.join('')
			await appendFile(cortexPath, lines)
		}

		const gitState = await getGitStateSummary(input.cwd)
		const summaryDir = join(homedir(), '.claude', 'session-summaries')
		await ensureDirectory(summaryDir)
		const summaryPath = join(summaryDir, `${repoName}.md`)
		const existingSummary = (await Bun.file(summaryPath).exists())
			? await Bun.file(summaryPath).text()
			: ''
		const timestamp = new Date().toISOString()
		const newEntry = `\n---\n## Compaction ${timestamp}\n\n${gitState}\n`
		await Bun.write(summaryPath, existingSummary + newEntry)

		const contextParts: string[] = [
			`Git state at compaction:\n${gitState}`,
			'\nGit workflow: /git:commit, /git:squash, /git:checkpoint',
			'git-expert skill handles: commits, PRs, history, worktrees, changelog, branch compare, squash, safety guards',
		]

		if (cortexEntries.length > 0) {
			contextParts.push(
				`Extracted ${cortexEntries.length} salient items to cortex:`,
			)
			for (const entry of cortexEntries.slice(0, 5)) {
				contextParts.push(`  [${entry.type}] ${entry.content}`)
			}
		}

		console.log(
			JSON.stringify({
				hookSpecificOutput: {
					hookEventName: 'PreCompact',
					additionalContext: contextParts.join('\n'),
				},
			}),
		)

		try {
			await postEvent(input.cwd, 'session.compacted', {
				cortexEntries: cortexEntries.length,
				repoName,
			})
		} catch {
			// event emission is best-effort
		}
	} catch {
		// never crash the hook
	}

	process.exit(0)
}
