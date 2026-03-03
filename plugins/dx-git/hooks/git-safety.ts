#!/usr/bin/env bun

/**
 * Git Safety Hook
 *
 * PreToolUse hook that blocks destructive git commands.
 * Returns exit code 2 with permissionDecision: "deny" for blocked commands.
 *
 * NOTE: This hook deliberately uses process.exit(2) on timeout, unlike
 * cortex-engineering's bootstrap.ts which uses exit(1). The difference is
 * intentional -- this is a safety gatekeeper, not a context loader. A
 * timed-out safety check must deny (exit 2), not silently allow (exit 1).
 */

import { postEvent } from './event-bus-client'
import { PROTECTED_BRANCHES } from './git-policy'
import { getCurrentBranch } from './git-utils'
import {
	extractCommandSubstitutions,
	extractWrappedShellCommand,
	type GitInvocation,
	getCommandWords,
	normalizeExecutableName,
	parseGitInvocation,
	splitShellSegments,
} from './shell-tokenizer'

interface PreToolUseHookInput {
	tool_name: string
	tool_input?: {
		command?: unknown
		file_path?: unknown
	}
	cwd?: string
}

/** Type guard that validates raw stdin JSON conforms to PreToolUseHookInput shape. */
function isPreToolUseHookInput(value: unknown): value is PreToolUseHookInput {
	if (!value || typeof value !== 'object') return false
	if (!('tool_name' in value) || typeof value.tool_name !== 'string')
		return false
	if ('tool_input' in value && value.tool_input !== undefined) {
		if (typeof value.tool_input !== 'object' || value.tool_input === null)
			return false
	}
	if (
		'cwd' in value &&
		value.cwd !== undefined &&
		typeof value.cwd !== 'string'
	)
		return false
	return true
}

interface PreToolUseHookSpecificOutput {
	hookEventName: 'PreToolUse'
	permissionDecision: 'deny'
	permissionDecisionReason?: string
}

export type GitSafetyMode = 'strict' | 'commit-guard' | 'advisory'

/**
 * Reads git safety mode from env.
 * - strict: enforce all destructive-command and commit protections
 * - commit-guard: enforce protected-branch commit and --no-verify rules only
 * - advisory: never deny; emit warning events only
 */
export function getGitSafetyMode(
	env: Record<string, string | undefined> = process.env,
): GitSafetyMode {
	const raw = (env.CLAUDE_GIT_SAFETY_MODE || '').trim().toLowerCase()
	if (raw === 'commit-guard') return 'commit-guard'
	if (raw === 'advisory') return 'advisory'
	return 'strict'
}

/**
 * Patterns that identify a commit as a legitimate WIP checkpoint.
 * Only commits matching these patterns may use --no-verify.
 */
const WIP_MESSAGE_PATTERNS = [/chore\(wip\):/, /wip:/i]

const PROTECTED_FILE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
	{
		pattern: /\.env($|[./\\])/,
		reason: '.env files may contain secrets.',
	},
	{
		pattern: /credentials/,
		reason: 'Credential files should not be modified by agents.',
	},
	{
		pattern: /\.git([/\\]|$)/,
		reason: 'Direct .git directory modifications are dangerous.',
	},
]

function collectShortFlags(args: string[]): string {
	return args
		.filter((arg) => /^-[A-Za-z]+$/.test(arg))
		.map((arg) => arg.slice(1))
		.join('')
}

function hasLongFlag(args: string[], flag: string): boolean {
	return args.some((arg) => arg === flag)
}

function hasShortFlag(args: string[], flag: string): boolean {
	return collectShortFlags(args).includes(flag)
}

function hasLongFlagPrefix(args: string[], prefix: string): boolean {
	return args.some((arg) => arg.startsWith(prefix))
}

function hasHereScriptRedirection(segment: string): boolean {
	return /(^|[\s;|&])<<<?/.test(segment)
}

function getInlineExecScript(
	normalizedHead: string | null,
	args: string[],
): string | null {
	if (!normalizedHead) return null
	const flagMap: Record<string, string[]> = {
		python: ['-c'],
		python3: ['-c'],
		node: ['-e', '--eval'],
		ruby: ['-e'],
		perl: ['-e'],
		php: ['-r'],
		lua: ['-e'],
	}
	const flags = flagMap[normalizedHead]
	if (!flags) return null
	for (let i = 0; i < args.length; i++) {
		const arg = args[i] || ''
		if (flags.includes(arg)) return args[i + 1] || ''
		for (const flag of flags) {
			if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1)
		}
	}
	return null
}

function extractCommitMessages(args: string[]): string[] {
	const messages: string[] = []
	for (let i = 0; i < args.length; i++) {
		const arg = args[i] || ''
		if (arg === '-m' || arg === '--message') {
			const value = args[i + 1]
			if (value) messages.push(value)
			i++
			continue
		}
		if (arg.startsWith('--message=')) {
			messages.push(arg.slice('--message='.length))
			continue
		}
		if (arg.startsWith('-m') && arg.length > 2) {
			messages.push(arg.slice(2))
		}
	}
	return messages
}

function hasForceFlag(args: string[]): boolean {
	return hasLongFlag(args, '--force') || hasShortFlag(args, 'f')
}

function hasRecursiveForceRmArgs(args: string[]): boolean {
	const hasRecursive =
		hasLongFlag(args, '--recursive') || hasShortFlag(args, 'r')
	const hasForce = hasLongFlag(args, '--force') || hasShortFlag(args, 'f')
	return hasRecursive && hasForce
}

function normalizeBranchRef(ref: string): string {
	let value = ref.trim()
	if (value.startsWith('+')) value = value.slice(1)
	if (value.startsWith('refs/heads/')) value = value.slice('refs/heads/'.length)
	return value
}

function isProtectedBranchRef(ref: string): boolean {
	const normalized = normalizeBranchRef(ref)
	return PROTECTED_BRANCHES.includes(normalized)
}

function isProtectedBranchLike(ref: string): boolean {
	const normalized = normalizeBranchRef(ref)
	if (PROTECTED_BRANCHES.includes(normalized)) return true
	const maybeRemoteQualified = normalized.split('/').pop() ?? ''
	return PROTECTED_BRANCHES.includes(maybeRemoteQualified)
}

function getPushRefspecArgs(args: string[]): string[] {
	const nonFlagArgs = args.filter((a) => !a.startsWith('-'))
	if (nonFlagArgs.length <= 0) return []

	// With a single non-flag arg, git push accepts either <remote> or <refspec>.
	// Treat clear refspec-shaped values as refspecs so safety checks fail closed.
	if (nonFlagArgs.length === 1) {
		const only = nonFlagArgs[0] ?? ''
		const looksLikeRefspec =
			only.includes(':') ||
			only.startsWith('refs/heads/') ||
			PROTECTED_BRANCHES.includes(normalizeBranchRef(only))
		return looksLikeRefspec ? [only] : []
	}

	// Standard form: first is remote, remaining are refspecs.
	return nonFlagArgs.slice(1)
}

function getPushDeleteTargets(args: string[], refspecArgs: string[]): string[] {
	const optionTargets = args
		.filter((arg) => arg.startsWith('--delete='))
		.map((arg) => arg.slice('--delete='.length))
		.filter(Boolean)
	return [...refspecArgs, ...optionTargets]
}

/**
 * Checks a shell command string for destructive operations that should be
 * blocked. Recursively analyzes piped segments, shell wrappers, and command
 * substitutions so nested danger (e.g., `sh -c "git reset --hard"`) is caught.
 *
 * Returns the parsed shell segments alongside the result so callers can reuse
 * them (e.g., for commit analysis) without re-tokenizing the command.
 */
export function checkCommand(command: string): {
	blocked: boolean
	reason?: string
	segments: string[]
} {
	const { segments, unbalanced } = splitShellSegments(command)
	if (unbalanced) {
		return {
			blocked: true,
			reason:
				'Unbalanced shell input detected. Refusing to run safety checks on ambiguous command.',
			segments,
		}
	}
	const result = checkParsedSegments(segments, 0)
	return { ...result, segments }
}

/** Splits a command into segments and checks them. Used for recursive calls. */
function checkCommandInternal(
	command: string,
	depth: number,
): { blocked: boolean; reason?: string } {
	if (depth > 4) {
		return {
			blocked: true,
			reason:
				'Command nesting too deep for safety analysis. Refusing to run for safety.',
		}
	}
	const { segments, unbalanced } = splitShellSegments(command)
	if (unbalanced) {
		return {
			blocked: true,
			reason:
				'Unbalanced shell input detected. Refusing to run safety checks on ambiguous command.',
		}
	}
	return checkParsedSegments(segments, depth)
}

/**
 * Collects direct and nested git invocations from parsed shell segments.
 * This mirrors safety recursion paths (wrappers + command substitutions) so
 * commit/protected-branch checks cannot be bypassed through indirection.
 */
function collectGitInvocations(segments: string[], depth = 0): GitInvocation[] {
	if (depth > 4) return []

	const invocations: GitInvocation[] = []
	for (const segment of segments) {
		const direct = parseGitInvocation(segment)
		if (direct) invocations.push(direct)

		const wrapped = extractWrappedShellCommand(segment)
		if (wrapped) {
			const wrappedSplit = splitShellSegments(wrapped)
			if (!wrappedSplit.unbalanced) {
				invocations.push(
					...collectGitInvocations(wrappedSplit.segments, depth + 1),
				)
			}
		}

		for (const nested of extractCommandSubstitutions(segment)) {
			const nestedSplit = splitShellSegments(nested)
			if (nestedSplit.unbalanced) continue
			invocations.push(
				...collectGitInvocations(nestedSplit.segments, depth + 1),
			)
		}
	}

	return invocations
}

/**
 * Checks pre-parsed segments for destructive operations. Called by
 * checkCommand (depth 0) and recursively by checkCommandInternal.
 */
function checkParsedSegments(
	segments: string[],
	depth: number,
): { blocked: boolean; reason?: string } {
	for (const segment of segments) {
		const wrapped = extractWrappedShellCommand(segment)
		if (wrapped) {
			const wrappedResult = checkCommandInternal(wrapped, depth + 1)
			if (wrappedResult.blocked) return wrappedResult
		}

		for (const nested of extractCommandSubstitutions(segment)) {
			const nestedResult = checkCommandInternal(nested, depth + 1)
			if (nestedResult.blocked) return nestedResult
		}

		const gitInvocation = parseGitInvocation(segment)

		if (gitInvocation) {
			const { subcommand, args } = gitInvocation

			if (subcommand === 'push') {
				const hasForce = hasForceFlag(args)
				const hasForceByRefspec = getPushRefspecArgs(args).some((arg) =>
					arg.startsWith('+'),
				)
				const hasMirror = hasLongFlag(args, '--mirror')
				const hasPrune = hasLongFlag(args, '--prune')
				const hasForceWithLease =
					hasLongFlag(args, '--force-with-lease') ||
					args.some((a) => a.startsWith('--force-with-lease='))
				const hasForceIfIncludes = hasLongFlag(args, '--force-if-includes')
				const refspecArgs = getPushRefspecArgs(args)
				const hasProtectedLeaseTarget = args
					.filter((arg) => arg.startsWith('--force-with-lease='))
					.map((arg) => arg.slice('--force-with-lease='.length))
					.map((value) => value.split(':')[0] ?? '')
					.some((target) => isProtectedBranchLike(target))
				if (hasMirror) {
					return {
						blocked: true,
						reason:
							'git push --mirror can overwrite and delete remote refs destructively. Use explicit feature-branch pushes instead.',
					}
				}
				if (hasPrune) {
					return {
						blocked: true,
						reason:
							'git push --prune can delete remote refs unexpectedly. Use explicit, reviewed branch deletion workflows instead.',
					}
				}
				if (hasForce || hasForceByRefspec) {
					return {
						blocked: true,
						reason:
							'Force push can destroy remote history. Use --force-with-lease on a feature branch if you must.',
					}
				}
				if (hasForceWithLease || hasForceIfIncludes) {
					const targetsProtected = refspecArgs.some((arg) => {
						const target = arg.includes(':')
							? (arg.split(':').at(-1) ?? '')
							: arg
						return isProtectedBranchRef(target)
					})
					if (targetsProtected || hasProtectedLeaseTarget) {
						return {
							blocked: true,
							reason:
								'Force push (even with --force-with-lease) to a protected branch can destroy shared history. Push to a feature branch and open a PR instead.',
						}
					}
				}

				// Block remote deletion of protected branches (plain or fully-qualified refs)
				if (
					hasLongFlag(args, '--delete') ||
					hasShortFlag(args, 'd') ||
					hasLongFlagPrefix(args, '--delete=')
				) {
					const deleteTargets = getPushDeleteTargets(args, refspecArgs).map(
						(arg) => normalizeBranchRef(arg),
					)
					if (deleteTargets.some((target) => isProtectedBranchRef(target))) {
						return {
							blocked: true,
							reason:
								'Deleting protected remote branches is blocked. Push to feature branches and use PR workflows.',
						}
					}
				}

				// Also block deletion refspec form: git push origin :main / :refs/heads/main
				const deletionTargets = refspecArgs
					.filter((arg) => arg.startsWith(':'))
					.map((arg) => normalizeBranchRef(arg.slice(1)))
				if (deletionTargets.some((target) => isProtectedBranchRef(target))) {
					return {
						blocked: true,
						reason:
							'Deleting protected remote branches is blocked. Push to feature branches and use PR workflows.',
					}
				}
			}
			if (subcommand === 'reset' && args.includes('--hard')) {
				return {
					blocked: true,
					reason: 'Hard reset destroys uncommitted changes permanently.',
				}
			}
			if (subcommand === 'reset' && args.includes('--merge')) {
				return {
					blocked: true,
					reason:
						'git reset --merge can lose uncommitted changes. Use `git merge --abort` to cleanly abort a merge.',
				}
			}
			if (subcommand === 'clean' && hasForceFlag(args)) {
				return {
					blocked: true,
					reason: 'git clean -f permanently deletes untracked files.',
				}
			}
			if (subcommand === 'checkout' && args.includes('.')) {
				return {
					blocked: true,
					reason: 'git checkout . discards all unstaged changes permanently.',
				}
			}
			if (subcommand === 'restore') {
				const hasStaged =
					hasLongFlag(args, '--staged') || hasShortFlag(args, 'S')
				const hasSource = args.some((a) => a.startsWith('--source'))
				const nonFlagArgs = args.filter(
					(a) => !a.startsWith('-') && !a.startsWith('--'),
				)
				// Block `git restore .` (discards all unstaged changes)
				if (args.includes('.')) {
					return {
						blocked: true,
						reason: 'git restore . discards all unstaged changes permanently.',
					}
				}
				// Block `git restore --source=<ref> <path>` (overwrites from ref)
				if (hasSource && nonFlagArgs.length > 0) {
					return {
						blocked: true,
						reason:
							'git restore --source overwrites working tree files from another ref. Use `git diff` to review changes first.',
					}
				}
				// Block `git restore <path>` without --staged (discards unstaged)
				if (!hasStaged && !hasSource && nonFlagArgs.length > 0) {
					return {
						blocked: true,
						reason:
							'git restore <path> discards unstaged changes permanently. Use `git restore --staged <path>` to unstage, or `git stash` to save changes first.',
					}
				}
			}
			if (subcommand === 'branch' && hasShortFlag(args, 'D')) {
				return {
					blocked: true,
					reason: 'git branch -D force-deletes a branch even if not merged.',
				}
			}
			if (
				subcommand === 'branch' &&
				(hasLongFlag(args, '--delete') || hasShortFlag(args, 'd')) &&
				hasForceFlag(args)
			) {
				return {
					blocked: true,
					reason:
						'git branch --delete --force force-deletes a branch even if not merged.',
				}
			}
			if (
				subcommand === 'worktree' &&
				(args[0] === 'remove' || args[1] === 'remove') &&
				hasForceFlag(args)
			) {
				return {
					blocked: true,
					reason:
						'Force-removing a worktree can destroy uncommitted work. Use `bunx @side-quest/git worktree delete` which checks status first.',
				}
			}
			if (subcommand === 'stash' && args[0] === 'drop') {
				return {
					blocked: true,
					reason:
						'git stash drop permanently deletes a stash entry. Use `git stash list` to review stashes first.',
				}
			}
			if (subcommand === 'stash' && args[0] === 'clear') {
				return {
					blocked: true,
					reason:
						'git stash clear destroys all stash entries permanently. Use `git stash list` to review first.',
				}
			}
			if (subcommand === 'filter-branch') {
				return {
					blocked: true,
					reason:
						'git filter-branch rewrites history destructively. Use safer migration tooling and backups first.',
				}
			}
			if (subcommand === 'reflog' && args[0] === 'expire') {
				return {
					blocked: true,
					reason:
						'git reflog expire can permanently remove recovery history. Avoid destructive reflog pruning in agent workflows.',
				}
			}
			if (
				subcommand === 'update-ref' &&
				(args[0] === '-d' || args.includes('--delete'))
			) {
				return {
					blocked: true,
					reason:
						'git update-ref -d/--delete can remove refs destructively. Use safer branch/tag workflows.',
				}
			}
			if (
				subcommand === 'gc' &&
				(args.includes('--prune=now') || args.includes('--prune=all'))
			) {
				return {
					blocked: true,
					reason:
						'git gc --prune=now/all permanently removes unreachable objects immediately. Use `git gc` without --prune=now to allow the default grace period.',
				}
			}
			if (subcommand === 'rebase') {
				for (let idx = 0; idx < args.length; idx++) {
					const arg = args[idx] || ''
					let execCmd: string | undefined
					if (arg === '--exec' || arg === '-x') {
						execCmd = args[idx + 1]
					} else if (arg.startsWith('--exec=')) {
						let val = arg.slice('--exec='.length)
						// Strip surrounding quotes left by shell word splitting
						if (
							val.length >= 2 &&
							((val.startsWith('"') && val.endsWith('"')) ||
								(val.startsWith("'") && val.endsWith("'")))
						) {
							val = val.slice(1, -1)
						}
						execCmd = val
					}
					if (execCmd) {
						const execResult = checkCommandInternal(execCmd, depth + 1)
						if (execResult.blocked) {
							return {
								blocked: true,
								reason: `git rebase --exec runs a destructive command: ${execResult.reason}`,
							}
						}
					}
				}
			}
			if (subcommand === 'checkout') {
				const sepIdx = args.indexOf('--')
				if (sepIdx >= 0 && sepIdx < args.length - 1) {
					return {
						blocked: true,
						reason:
							'git checkout <ref> -- <path> overwrites files without backup. Use `git stash` to save changes first, or `git diff <ref> -- <path>` to review.',
					}
				}
				// Block `git checkout <ref> <path>` (2+ non-flag args, no -b/-B)
				// Allow: `git checkout branch-name`, `git checkout -b new base`
				if (sepIdx < 0) {
					const hasBranchCreate =
						hasShortFlag(args, 'b') ||
						hasShortFlag(args, 'B') ||
						hasLongFlag(args, '--branch') ||
						hasLongFlag(args, '-b') ||
						hasLongFlag(args, '-B')
					if (!hasBranchCreate) {
						const nonFlagArgs = args.filter((a) => !a.startsWith('-'))
						if (nonFlagArgs.length >= 2) {
							return {
								blocked: true,
								reason:
									'git checkout <ref> <path> overwrites files without backup. Use `git stash` to save changes first, or `git diff <ref> -- <path>` to review.',
							}
						}
					}
				}
			}
		}

		const { words, cmdIndex, head } = getCommandWords(segment)
		const normalizedHead = normalizeExecutableName(head)
		if (cmdIndex >= 0) {
			const args = words.slice(cmdIndex + 1)
			const inlineScript = getInlineExecScript(normalizedHead, args)
			if (inlineScript !== null) {
				return {
					blocked: true,
					reason:
						'Inline interpreter execution (-c/-e/-r/--eval) cannot be safety-analyzed reliably. Use direct commands instead.',
				}
			}
			if (
				hasHereScriptRedirection(segment) &&
				['python', 'python3', 'node', 'ruby', 'perl', 'php', 'lua'].includes(
					normalizedHead ?? '',
				)
			) {
				return {
					blocked: true,
					reason:
						'Interpreter commands receiving heredoc/here-string input cannot be safety-analyzed reliably.',
				}
			}
		}
		if (normalizedHead === 'xargs' && cmdIndex >= 0) {
			const args = words.slice(cmdIndex + 1)
			const hasReplaceTemplate = args.some(
				(arg) =>
					arg === '-I' ||
					arg.startsWith('-I') ||
					arg === '--replace' ||
					arg.startsWith('--replace='),
			)
			if (hasReplaceTemplate) {
				// With replacement templates, runtime stdin content becomes executable
				// command text. If this fans into a shell wrapper, static analysis is
				// not reliable, so fail closed.
				const tail = extractWrappedShellCommand(segment)
				const tailHead = tail
					? normalizeExecutableName(getCommandWords(tail).head)
					: null
				if (
					tailHead &&
					['sh', 'bash', 'zsh', 'dash', 'ksh'].includes(tailHead)
				) {
					return {
						blocked: true,
						reason:
							'xargs replacement templates piped into shell commands cannot be safety-analyzed. Avoid xargs -I with sh/bash.',
					}
				}
			}
		}
		if (
			cmdIndex >= 0 &&
			[
				'sh',
				'bash',
				'zsh',
				'dash',
				'ksh',
				'fish',
				'pwsh',
				'powershell',
			].includes(normalizedHead ?? '')
		) {
			const args = words.slice(cmdIndex + 1)
			const readsCommandsFromStdin =
				args.length === 0 ||
				args.includes('-s') ||
				args.includes('--stdin') ||
				hasHereScriptRedirection(segment)
			if (readsCommandsFromStdin) {
				return {
					blocked: true,
					reason:
						'Shell commands reading script input from stdin cannot be safety-analyzed. Avoid piping commands into sh/bash.',
				}
			}
		}
		if (normalizedHead === 'find' && cmdIndex >= 0) {
			const args = words.slice(cmdIndex + 1)
			if (args.includes('-delete')) {
				return {
					blocked: true,
					reason:
						'find -delete permanently removes files. Use `find ... -print` first to review, then delete manually.',
				}
			}
			for (let i = 0; i < args.length - 1; i++) {
				if ((args[i] || '') !== '-exec') continue
				const next = normalizeExecutableName(args[i + 1] || '')
				if (next === 'rm') {
					return {
						blocked: true,
						reason:
							'find -exec rm permanently removes files. Use `find ... -print` first to review, then delete manually.',
					}
				}
			}
		}

		if (normalizedHead === 'rm' && cmdIndex >= 0) {
			const args = words.slice(cmdIndex + 1)
			const targetsWorktrees = args.some((arg) =>
				/\.worktrees(?:[/\\]|$)/.test(arg),
			)
			if (targetsWorktrees && hasRecursiveForceRmArgs(args)) {
				return {
					blocked: true,
					reason:
						'Deleting .worktrees/ directly bypasses git worktree cleanup. Use `bunx @side-quest/git worktree clean` instead.',
				}
			}
		}
	}
	return { blocked: false }
}

/**
 * Checks whether a file path targets a protected location (e.g., .env,
 * credentials, .git/) that agents should not modify directly.
 */
export function checkFileEdit(filePath: string): {
	blocked: boolean
	reason?: string
} {
	for (const { pattern, reason } of PROTECTED_FILE_PATTERNS) {
		if (pattern.test(filePath)) {
			return { blocked: true, reason }
		}
	}
	return { blocked: false }
}

/**
 * Analyzes a command to determine if it's a git commit and what kind.
 * Uses the shell tokenizer to split segments so heredoc bodies are excluded
 * from flag scanning, and `||` is recognized as a segment boundary.
 * A legitimate WIP checkpoint requires both --no-verify AND a WIP message pattern.
 */
export function isCommitCommand(
	command: string,
	preParsedSegments?: string[],
): {
	isCommit: boolean
	hasNoVerify: boolean
	hasWipMessage: boolean
} {
	const segments = preParsedSegments ?? splitShellSegments(command).segments
	const commitInvocations = collectGitInvocations(segments).filter(
		(invocation) => invocation.subcommand === 'commit',
	)

	if (commitInvocations.length === 0) {
		return { isCommit: false, hasNoVerify: false, hasWipMessage: false }
	}

	const commitStates = commitInvocations.map((invocation) => {
		const args = invocation.args ?? []
		const hasNoVerify =
			hasLongFlag(args, '--no-verify') || hasShortFlag(args, 'n')
		const commitMessages = extractCommitMessages(args)
		const hasWipMessage = commitMessages.some((msg) =>
			WIP_MESSAGE_PATTERNS.some((p) => p.test(msg)),
		)
		return { hasNoVerify, hasWipMessage }
	})

	const hasNoVerify = commitStates.some((state) => state.hasNoVerify)
	const hasWipMessage = hasNoVerify
		? commitStates
				.filter((state) => state.hasNoVerify)
				.every((state) => state.hasWipMessage)
		: false

	return { isCommit: true, hasNoVerify, hasWipMessage }
}

/**
 * Detects git subcommands that can create a commit and therefore must be
 * blocked on protected branches.
 */
export function hasProtectedBranchCommitAction(
	command: string,
	preParsedSegments?: string[],
): boolean {
	const segments = preParsedSegments ?? splitShellSegments(command).segments
	const invocations = collectGitInvocations(segments)

	for (const { subcommand, args } of invocations) {
		if (subcommand === 'commit') return true

		if (subcommand === 'cherry-pick' || subcommand === 'revert') {
			const isControlFlow =
				hasLongFlag(args, '--abort') ||
				hasLongFlag(args, '--continue') ||
				hasLongFlag(args, '--quit') ||
				hasLongFlag(args, '--skip')
			if (isControlFlow) continue
			const noCommit =
				hasLongFlag(args, '--no-commit') || hasShortFlag(args, 'n')
			if (!noCommit) return true
		}

		if (subcommand === 'merge') {
			const isControlFlow =
				hasLongFlag(args, '--abort') ||
				hasLongFlag(args, '--continue') ||
				hasLongFlag(args, '--quit')
			if (isControlFlow) continue
			const suppressesCommit =
				hasLongFlag(args, '--squash') ||
				hasLongFlag(args, '--ff-only') ||
				hasLongFlag(args, '--no-commit')
			const createsCommit = !suppressesCommit
			if (createsCommit) return true
		}
	}

	return false
}

/**
 * Detects lease-style force pushes that can target the current upstream branch
 * implicitly (i.e., no explicit refspec provided).
 */
export function hasImplicitProtectedBranchForceLeasePush(
	command: string,
	preParsedSegments?: string[],
): boolean {
	const segments = preParsedSegments ?? splitShellSegments(command).segments
	const invocations = collectGitInvocations(segments)

	for (const invocation of invocations) {
		if (invocation.subcommand !== 'push') continue

		const args = invocation.args
		const hasForceWithLease =
			hasLongFlag(args, '--force-with-lease') ||
			args.some((a) => a.startsWith('--force-with-lease='))
		const hasForceIfIncludes = hasLongFlag(args, '--force-if-includes')
		if (!hasForceWithLease && !hasForceIfIncludes) continue

		const explicitRefspecs = getPushRefspecArgs(args)
		if (explicitRefspecs.length === 0) return true
	}

	return false
}

/** Emits a deny decision, posts a best-effort event, and exits with code 2. */
async function denyAndExit(
	reason: string,
	input: { cwd?: string; tool_name?: string },
): Promise<never> {
	const hookSpecificOutput: PreToolUseHookSpecificOutput = {
		hookEventName: 'PreToolUse',
		permissionDecision: 'deny',
		permissionDecisionReason: reason,
	}
	console.log(JSON.stringify({ hookSpecificOutput }))
	try {
		await postEvent(input.cwd || process.cwd(), 'safety.blocked', {
			tool: input.tool_name,
			reason: hookSpecificOutput.permissionDecisionReason,
		})
	} catch {
		// event emission is best-effort
	}
	process.exit(2)
}

if (import.meta.main) {
	// Self-destruct timer: first executable line when run as entry point.
	// FAIL-CLOSED: PreToolUse safety hook exits with code 2 (deny) on timeout.
	// A timed-out safety check is grounds for denial, not silent permission.
	// This deliberately diverges from cortex bootstrap.ts (exit 1) because this
	// is a gatekeeper, not a context loader. Set to 80% of hooks.json timeout (5s).
	const selfDestruct = setTimeout(() => {
		process.stderr.write('git-safety: timed out, failing closed\n')
		console.log(
			JSON.stringify({
				hookSpecificOutput: {
					hookEventName: 'PreToolUse',
					permissionDecision: 'deny',
					permissionDecisionReason:
						'Safety hook timed out. Please retry the command.',
				},
			}),
		)
		process.exit(2)
	}, 4_000)
	selfDestruct.unref()

	try {
		let raw: unknown
		try {
			raw = await Bun.stdin.json()
		} catch {
			console.log(
				JSON.stringify({
					hookSpecificOutput: {
						hookEventName: 'PreToolUse',
						permissionDecision: 'deny',
						permissionDecisionReason:
							'Malformed hook input. Safety hook is failing closed.',
					},
				}),
			)
			process.exit(2)
		}

		if (!isPreToolUseHookInput(raw)) {
			console.log(
				JSON.stringify({
					hookSpecificOutput: {
						hookEventName: 'PreToolUse',
						permissionDecision: 'deny',
						permissionDecisionReason:
							'Malformed hook input. Safety hook is failing closed.',
					},
				}),
			)
			process.exit(2)
		}
		const input: PreToolUseHookInput = raw

		const toolInput = input.tool_input
		const safetyMode = getGitSafetyMode()

		if (input.tool_name === 'Write' || input.tool_name === 'Edit') {
			const filePath = toolInput?.file_path
			if (typeof filePath !== 'string') {
				process.exit(0)
			}

			const fileResult = checkFileEdit(filePath)
			if (fileResult.blocked) {
				if (safetyMode === 'strict') {
					await denyAndExit(fileResult.reason ?? 'Protected file.', input)
				}
				try {
					await postEvent(input.cwd || process.cwd(), 'safety.warn', {
						tool: input.tool_name,
						mode: safetyMode,
						reason: fileResult.reason ?? 'Protected file.',
						filePath,
					})
				} catch {
					// event emission is best-effort
				}
			}

			process.exit(0)
		}

		if (input.tool_name !== 'Bash') {
			process.exit(0)
		}

		const command = toolInput?.command
		if (typeof command !== 'string') {
			process.exit(0)
		}

		const commandResult = checkCommand(command)
		if (commandResult.blocked) {
			if (safetyMode === 'strict') {
				await denyAndExit(commandResult.reason ?? 'Blocked command.', input)
			}
			try {
				await postEvent(input.cwd || process.cwd(), 'safety.warn', {
					tool: input.tool_name,
					mode: safetyMode,
					reason: commandResult.reason ?? 'Blocked command.',
					command,
				})
			} catch {
				// event emission is best-effort
			}
		}

		const commitCheck = isCommitCommand(command, commandResult.segments)
		const hasCommitAction = hasProtectedBranchCommitAction(
			command,
			commandResult.segments,
		)
		const hasImplicitForceLeasePush = hasImplicitProtectedBranchForceLeasePush(
			command,
			commandResult.segments,
		)

		if (
			safetyMode !== 'advisory' &&
			(hasCommitAction || hasImplicitForceLeasePush)
		) {
			const branch = await getCurrentBranch(input.cwd)
			if (branch && PROTECTED_BRANCHES.includes(branch)) {
				if (hasCommitAction) {
					await denyAndExit(
						[
							`BLOCKED: Cannot commit directly to ${branch}.`,
							'',
							'Create a feature branch first:',
							'  git checkout -b <type>/<description>',
							'',
							'Then commit on the new branch.',
						].join('\n'),
						input,
					)
				}
				if (hasImplicitForceLeasePush) {
					await denyAndExit(
						[
							`BLOCKED: Cannot lease-force-push implicitly to ${branch}.`,
							'',
							'Specify an explicit non-protected refspec or push from a feature branch.',
						].join('\n'),
						input,
					)
				}
			}
		}

		// Block --no-verify on non-WIP commits (prevents bypassing pre-commit hooks)
		if (safetyMode !== 'advisory' && commitCheck.isCommit) {
			const isLegitimateWip =
				commitCheck.hasNoVerify && commitCheck.hasWipMessage
			if (commitCheck.hasNoVerify && !isLegitimateWip) {
				await denyAndExit(
					[
						'BLOCKED: --no-verify is only allowed for WIP checkpoint commits.',
						'',
						'For regular commits, remove --no-verify so pre-commit hooks run.',
						'For WIP checkpoints, use a WIP message pattern:',
						'  git commit --no-verify -m "chore(wip): <description>"',
					].join('\n'),
					input,
				)
			}
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error(`git-safety internal error: ${message}`)
		console.log(
			JSON.stringify({
				hookSpecificOutput: {
					hookEventName: 'PreToolUse',
					permissionDecision: 'deny',
					permissionDecisionReason:
						'Safety hook internal error. Failing closed; please retry.',
				},
			}),
		)
		process.exit(2)
	}

	process.exit(0)
}
