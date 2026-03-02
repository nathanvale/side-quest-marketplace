#!/usr/bin/env bun

/**
 * Git Context Loader Hook
 *
 * SessionStart hook that injects git repository context into Claude's
 * conversation. Fires on startup, resume, compact, and clear to ensure
 * Claude always has current branch/status awareness and knows how to
 * route git tasks.
 *
 * Output: Plain stdout text (avoids plugin hooks.json bug #16538 where
 * hookSpecificOutput.additionalContext is silently discarded). Structured as:
 * - Git Repository Context (branch, status, recent commits)
 * - Git Command Routing (when to use each slash command)
 * - Git Rules (safety constraints for git operations)
 */

import { postEvent } from './event-bus-client'
import { parsePorcelainStatus } from './git-status-parser'
import { isGitRepo, runGit } from './git-utils'

type SessionSource = 'startup' | 'resume' | 'compact' | 'clear'

interface SessionStartHookInput {
	session_id: string
	hook_event_name: string
	cwd: string
	source: SessionSource
	model: string
	permission_mode: string
	transcript_path?: string
	agent_type?: string
}

function isSessionStartHookInput(
	value: unknown,
): value is SessionStartHookInput {
	if (!value || typeof value !== 'object') return false
	return (
		'cwd' in value &&
		typeof value.cwd === 'string' &&
		'source' in value &&
		typeof value.source === 'string' &&
		'session_id' in value &&
		typeof value.session_id === 'string'
	)
}

interface GitContext {
	branch: string
	status: {
		staged: number
		modified: number
		untracked: number
	}
	recentCommits: string[]
}

/** Gathers git state. Uses fewer commits on compact/clear to save context budget. */
export async function getGitContext(
	cwd: string,
	commitCount: number = 5,
): Promise<GitContext | null> {
	if (!(await isGitRepo(cwd))) {
		return null
	}

	const statusResult = await runGit(['status', '--porcelain', '-b'], { cwd })
	if (statusResult.exitCode !== 0) {
		return null
	}

	const { branch, counts } = parsePorcelainStatus(statusResult.stdout)

	const commitsResult = await runGit(
		['log', '--oneline', `-${commitCount}`, '--format=%h %s (%ar)'],
		{ cwd },
	)

	const recentCommits =
		commitsResult.exitCode === 0
			? commitsResult.stdout
					.split('\n')
					.map((line) => line.trim())
					.filter(Boolean)
			: []

	return {
		branch: branch || '(detached)',
		status: counts,
		recentCommits,
	}
}

/** Formats the additionalContext payload with role framing and routing hints. */
export function formatAdditionalContext(
	context: GitContext,
	source: SessionSource,
): string {
	const { branch, status, recentCommits } = context
	const sections: string[] = []

	// Section 1: Repository state
	const restoredNote =
		source === 'compact' ? ' (restored after compaction)' : ''
	let state = `## Git Repository Context${restoredNote}\n\n`
	state += `Branch: ${branch}\n`
	state += `Status: ${status.modified} modified, ${status.untracked} untracked, ${status.staged} staged\n`

	if (recentCommits.length > 0) {
		state += `\nRecent commits:\n`
		for (const commit of recentCommits) {
			state += `- ${commit}\n`
		}
	} else {
		state += '\nNo commits yet.\n'
	}

	sections.push(state)

	// Section 2: Command routing -- tells Claude WHEN to use each command
	let routing = '## Git Command Routing\n\n'
	routing += '| Need | Command |\n'
	routing += '|------|--------|\n'
	routing +=
		'| Commit changes | /git:commit (analyzes diff, conventional commit) |\n'
	routing += '| Quick save | /git:checkpoint (WIP commit, skips hooks) |\n'
	routing +=
		'| Squash WIP commits | /git:squash (combines into one clean commit) |\n'
	routing += '| Create PR | /git:create-pr (push + gh pr create) |\n'
	routing +=
		'| Manage worktrees | /git:worktree (create, list, delete, sync, clean, status) |\n'
	routing +=
		'| Anything else git | invoke git-expert skill (history, changelog, compare, review) |'
	sections.push(routing)

	// Section 3: Safety rules -- critical after compaction when Claude loses memory
	let rules = '## Git Rules\n\n'
	rules += '- NEVER force push, hard reset, clean -f, or checkout/restore .\n'
	rules += '- NEVER commit to main/master -- create a feature branch first\n'
	rules += '- NEVER use git add . or git add -A -- stage specific files\n'
	rules += '- ALWAYS use conventional commits: type(scope): subject\n'
	rules += '- ALWAYS use HEREDOC for commit messages'
	sections.push(rules)

	return sections.join('\n\n')
}

if (import.meta.main) {
	// Self-destruct timer: first executable line when run as entry point.
	// Set to 80% of hooks.json timeout (15s). .unref() lets the process
	// exit naturally when work completes.
	const selfDestruct = setTimeout(() => {
		process.stderr.write('git-context-loader: timed out\n')
		process.exit(1)
	}, 12_000)
	selfDestruct.unref()

	try {
		let input: SessionStartHookInput
		try {
			const parsed = await Bun.stdin.json()
			if (!isSessionStartHookInput(parsed)) {
				process.exit(0)
			}
			input = parsed
		} catch {
			process.exit(0)
		}

		const relevantSources: SessionSource[] = [
			'startup',
			'resume',
			'compact',
			'clear',
		]
		if (!relevantSources.includes(input.source as SessionSource)) {
			process.exit(0)
		}

		const commitCount =
			input.source === 'compact' || input.source === 'clear' ? 3 : 5
		const context = await getGitContext(input.cwd, commitCount)
		if (context) {
			// Use plain stdout instead of JSON hookSpecificOutput.additionalContext.
			// Plugin hooks.json has a known bug (#16538) where additionalContext
			// is silently discarded. Plain stdout is reliably injected as context
			// for SessionStart hooks regardless of source (plugin or user config).
			console.log(
				formatAdditionalContext(context, input.source as SessionSource),
			)

			try {
				await postEvent(input.cwd, 'session.started', {
					source: input.source,
					branch: context.branch,
					status: context.status,
					session_id: input.session_id,
				})
			} catch {
				// event emission is best-effort
			}
		}
	} catch {
		// never crash the hook
	}

	process.exit(0)
}
