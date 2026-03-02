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

interface PreToolUseHookInput {
	tool_name: string
	tool_input?: {
		command?: unknown
		file_path?: unknown
	}
	cwd?: string
}

interface PreToolUseHookSpecificOutput {
	hookEventName: 'PreToolUse'
	permissionDecision: 'deny'
	permissionDecisionReason?: string
}

/**
 * Patterns that identify a commit as a legitimate WIP checkpoint.
 * Only commits matching these patterns may use --no-verify.
 */
const WIP_MESSAGE_PATTERNS = [/chore\(wip\):/, /wip:/i]

const PROTECTED_FILE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
	{
		pattern: /\.env($|\.)/,
		reason: '.env files may contain secrets.',
	},
	{
		pattern: /credentials/,
		reason: 'Credential files should not be modified by agents.',
	},
	{
		pattern: /\.git\//,
		reason: 'Direct .git directory modifications are dangerous.',
	},
]

// ---------------------------------------------------------------------------
// Shell tokenizer -- two-stage lexer for safe command parsing
// ---------------------------------------------------------------------------

type LexerState =
	| 'normal'
	| 'single-quote'
	| 'double-quote'
	| 'backtick'
	| 'dollar-paren'
	| 'dollar-brace'
	| 'escape'

type TokenType = 'operator' | 'text' | 'heredoc-body'

interface Token {
	type: TokenType
	value: string
}

interface TokenizeResult {
	tokens: Token[]
	unbalanced: boolean
}

/**
 * Char-by-char shell tokenizer that tracks quoting/subshell state and emits
 * typed tokens. Operators (`;`, `&&`, `||`, `|`) are only recognized in
 * normal (unquoted) state at nesting depth 0.
 *
 * **Limitations (by design):**
 * - No alias expansion, glob expansion, or shell function tracking
 * - No arithmetic expansion `$(( ))` -- treated as `$()` nesting
 * - No process substitution `<()` / `>()`
 * - Complex redirections beyond heredocs are not modeled
 *
 * Fail-closed: if the lexer finishes with unbalanced state (unterminated
 * quote, unclosed `$()`), the result has `unbalanced: true`.
 */
export function tokenizeShell(command: string): TokenizeResult {
	const tokens: Token[] = []
	let state: LexerState = 'normal'
	let prevState: LexerState = 'normal' // for escape returns
	let depth = 0 // nesting depth for $() and ${}
	let buf = ''
	let heredocDelimiter: string | null = null
	let heredocStrip = false // true for <<- (strip leading tabs)

	const flushBuf = (type: TokenType = 'text') => {
		if (buf.length > 0) {
			tokens.push({ type, value: buf })
			buf = ''
		}
	}

	const pushOp = (op: string) => {
		flushBuf()
		tokens.push({ type: 'operator', value: op })
	}

	const i_max = command.length
	let i = 0

	// Check for heredoc at end of a segment. Called after we see `<<`.
	const tryParseHeredocStart = (): boolean => {
		// We're at position after `<<`
		let pos = i
		// optional `-` for <<-
		if (pos < i_max && command[pos] === '-') {
			heredocStrip = true
			pos++
		} else {
			heredocStrip = false
		}
		// skip spaces between << and delimiter
		while (pos < i_max && command[pos] === ' ') pos++
		// parse delimiter: optionally quoted with ', ", or \
		let delim = ''
		if (pos < i_max && (command[pos] === "'" || command[pos] === '"')) {
			const quoteChar = command[pos]
			pos++
			while (pos < i_max && command[pos] !== quoteChar) {
				delim += command[pos]
				pos++
			}
			if (pos < i_max) pos++ // skip closing quote
		} else if (pos < i_max && command[pos] === '\\') {
			pos++ // skip backslash
			while (pos < i_max && /\S/.test(command[pos] as string)) {
				delim += command[pos]
				pos++
			}
		} else {
			while (pos < i_max && /[A-Za-z0-9_]/.test(command[pos] as string)) {
				delim += command[pos]
				pos++
			}
		}
		if (delim.length === 0) return false
		heredocDelimiter = delim
		i = pos
		return true
	}

	while (i < i_max) {
		const ch = command[i]

		// If we're collecting a heredoc body, scan for the closing delimiter
		if (heredocDelimiter !== null) {
			// Heredoc body: read until we find delimiter on its own line
			let heredocBuf = ''
			// We may be right after a newline or at start -- skip to next line
			// if current char is newline
			if (ch === '\n') {
				i++
			}
			let foundEnd = false
			while (i < i_max) {
				// Find the next line
				const lineStart = i
				while (i < i_max && command[i] !== '\n') i++
				let line = command.slice(lineStart, i)
				if (heredocStrip) {
					line = line.replace(/^\t+/, '')
				}
				if (line.trim() === heredocDelimiter) {
					foundEnd = true
					if (i < i_max) i++ // skip the newline after delimiter
					break
				}
				heredocBuf += `${command.slice(lineStart, i)}\n`
				if (i < i_max) i++ // skip newline
			}
			if (heredocBuf.length > 0 || foundEnd) {
				tokens.push({ type: 'heredoc-body', value: heredocBuf })
			}
			heredocDelimiter = null
			continue
		}

		switch (state) {
			case 'normal': {
				if (ch === '\\') {
					prevState = 'normal'
					state = 'escape'
					buf += ch
					i++
				} else if (ch === "'") {
					state = 'single-quote'
					buf += ch
					i++
				} else if (ch === '"') {
					state = 'double-quote'
					buf += ch
					i++
				} else if (ch === '`') {
					state = 'backtick'
					buf += ch
					i++
				} else if (ch === '$' && i + 1 < i_max && command[i + 1] === '(') {
					state = 'dollar-paren'
					depth++
					buf += '$('
					i += 2
				} else if (ch === '$' && i + 1 < i_max && command[i + 1] === '{') {
					state = 'dollar-brace'
					depth++
					buf += '${'
					i += 2
				} else if (ch === ';') {
					pushOp(';')
					i++
				} else if (ch === '&' && i + 1 < i_max && command[i + 1] === '&') {
					pushOp('&&')
					i += 2
				} else if (ch === '|' && i + 1 < i_max && command[i + 1] === '|') {
					pushOp('||')
					i += 2
				} else if (ch === '|') {
					pushOp('|')
					i++
				} else if (
					ch === '<' &&
					i + 1 < i_max &&
					command[i + 1] === '<' &&
					(i + 2 >= i_max || command[i + 2] !== '<') // not <<<
				) {
					buf += '<<'
					i += 2
					// Try to parse heredoc delimiter
					if (tryParseHeredocStart()) {
						flushBuf()
						// heredocDelimiter is now set, loop will collect body
					}
					// If no valid delimiter found, just continue as text
				} else {
					buf += ch
					i++
				}
				break
			}

			case 'escape': {
				buf += ch
				state = prevState
				i++
				break
			}

			case 'single-quote': {
				buf += ch
				if (ch === "'") {
					state = 'normal'
				}
				i++
				break
			}

			case 'double-quote': {
				if (ch === '\\') {
					prevState = 'double-quote'
					state = 'escape'
					buf += ch
					i++
				} else if (ch === '$' && i + 1 < i_max && command[i + 1] === '(') {
					state = 'dollar-paren'
					depth++
					buf += '$('
					i += 2
				} else if (ch === '$' && i + 1 < i_max && command[i + 1] === '{') {
					state = 'dollar-brace'
					depth++
					buf += '${'
					i += 2
				} else {
					buf += ch
					if (ch === '"' && depth === 0) {
						state = 'normal'
					}
					i++
				}
				break
			}

			case 'backtick': {
				buf += ch
				if (ch === '`') {
					state = 'normal'
				}
				i++
				break
			}

			case 'dollar-paren': {
				if (ch === '(') {
					depth++
					buf += ch
					i++
				} else if (ch === ')') {
					depth--
					buf += ch
					i++
					if (depth === 0) {
						state = 'normal'
					}
				} else if (ch === "'") {
					// Single quotes inside $() still work
					buf += ch
					i++
					while (i < i_max && command[i] !== "'") {
						buf += command[i]
						i++
					}
					if (i < i_max) {
						buf += command[i]
						i++
					}
				} else if (ch === '"') {
					buf += ch
					i++
					// Scan through double-quoted string inside $()
					while (i < i_max && command[i] !== '"') {
						if (command[i] === '\\') {
							buf += command[i]
							i++
							if (i < i_max) {
								buf += command[i]
								i++
							}
						} else {
							buf += command[i]
							i++
						}
					}
					if (i < i_max) {
						buf += command[i]
						i++
					}
				} else {
					buf += ch
					i++
				}
				break
			}

			case 'dollar-brace': {
				if (ch === '{') {
					depth++
					buf += ch
					i++
				} else if (ch === '}') {
					depth--
					buf += ch
					i++
					if (depth === 0) {
						state = 'normal'
					}
				} else {
					buf += ch
					i++
				}
				break
			}
		}
	}

	flushBuf()

	const unbalanced =
		state !== 'normal' || depth > 0 || heredocDelimiter !== null

	return { tokens, unbalanced }
}

interface ShellParseResult {
	segments: string[]
	unbalanced: boolean
}

/**
 * Splits a shell command into top-level segments separated by operators
 * (`;`, `&&`, `||`, `|`). Heredoc bodies are excluded from segments.
 */
export function splitShellSegments(command: string): ShellParseResult {
	const { tokens, unbalanced } = tokenizeShell(command)
	const segments: string[] = []
	let current = ''

	for (const token of tokens) {
		if (token.type === 'operator') {
			const trimmed = current.trim()
			if (trimmed.length > 0) {
				segments.push(trimmed)
			}
			current = ''
		} else if (token.type === 'text') {
			current += token.value
		}
		// heredoc-body tokens are deliberately excluded
	}

	const trimmed = current.trim()
	if (trimmed.length > 0) {
		segments.push(trimmed)
	}

	return { segments, unbalanced }
}

/**
 * Strips quoted content from a shell segment, leaving quote delimiters
 * but replacing interior content with empty strings. This prevents
 * patterns inside quoted strings from triggering false positives.
 *
 * Example: `echo "git reset --hard"` -> `echo ""`
 */
export function stripQuotedContents(segment: string): string {
	let result = ''
	let i = 0
	const len = segment.length

	while (i < len) {
		const ch = segment[i]
		if (ch === '\\' && i + 1 < len) {
			// Skip escaped character entirely
			result += (segment[i] as string) + (segment[i + 1] as string)
			i += 2
		} else if (ch === "'") {
			result += "'"
			i++
			// Skip until closing single quote
			while (i < len && segment[i] !== "'") i++
			if (i < len) {
				result += "'"
				i++
			}
		} else if (ch === '"') {
			result += '"'
			i++
			// Skip until closing double quote, respecting escapes
			while (i < len && segment[i] !== '"') {
				if (segment[i] === '\\' && i + 1 < len) {
					i += 2
				} else {
					i++
				}
			}
			if (i < len) {
				result += '"'
				i++
			}
		} else {
			result += ch
			i++
		}
	}

	return result
}

/**
 * Extracts the first command word from a shell segment, skipping leading
 * environment variable assignments (e.g., `FOO=bar git commit`).
 * Returns the command head (e.g., `git`, `echo`, `rm`) or null.
 */
export function extractCommandHead(segment: string): string | null {
	const trimmed = segment.trim()
	const words = trimmed.split(/\s+/)

	for (const word of words) {
		// Skip env var assignments like FOO=bar, HOME=/tmp
		if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) continue
		// Return the first non-assignment word
		return word || null
	}

	return null
}

interface CommandWords {
	words: string[]
	cmdIndex: number
	head: string | null
}

function unquoteWord(word: string): string {
	if (word.length >= 2 && word.startsWith("'") && word.endsWith("'")) {
		return word.slice(1, -1)
	}
	if (word.length >= 2 && word.startsWith('"') && word.endsWith('"')) {
		return word.slice(1, -1)
	}
	return word
}

function consumeCommandSubstitution(segment: string, start: number): number {
	let i = start + 2
	let depth = 1
	let inSingle = false
	let inDouble = false
	let escaped = false

	while (i < segment.length && depth > 0) {
		const ch = segment[i] || ''

		if (escaped) {
			escaped = false
			i++
			continue
		}

		if (ch === '\\' && !inSingle) {
			escaped = true
			i++
			continue
		}

		if (ch === "'" && !inDouble) {
			inSingle = !inSingle
			i++
			continue
		}

		if (ch === '"' && !inSingle) {
			inDouble = !inDouble
			i++
			continue
		}

		if (!inSingle && !inDouble) {
			if (ch === '$' && segment[i + 1] === '(') {
				depth++
				i += 2
				continue
			}
			if (ch === ')') {
				depth--
				i++
				continue
			}
		}

		i++
	}

	return i
}

function splitShellWords(segment: string): string[] {
	const words: string[] = []
	let current = ''
	let inSingle = false
	let inDouble = false
	let i = 0

	while (i < segment.length) {
		const ch = segment[i] || ''

		if (!inSingle && !inDouble && /\s/.test(ch)) {
			if (current.length > 0) {
				words.push(unquoteWord(current))
				current = ''
			}
			i++
			continue
		}

		if (!inSingle && ch === '$' && segment[i + 1] === '(') {
			const end = consumeCommandSubstitution(segment, i)
			current += segment.slice(i, end)
			i = end
			continue
		}

		if (ch === "'" && !inDouble) {
			inSingle = !inSingle
			current += ch
			i++
			continue
		}

		if (ch === '"' && !inSingle) {
			inDouble = !inDouble
			current += ch
			i++
			continue
		}

		current += ch
		i++
	}

	if (current.length > 0) {
		words.push(unquoteWord(current))
	}

	return words.filter((word) => word.length > 0)
}

function getCommandWords(segment: string): CommandWords {
	const words = splitShellWords(segment)
	let cmdIndex = -1

	for (let i = 0; i < words.length; i++) {
		const word = words[i] || ''
		if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) continue
		cmdIndex = i
		break
	}

	if (cmdIndex === -1) {
		return { words, cmdIndex: -1, head: null }
	}

	return { words, cmdIndex, head: words[cmdIndex] || null }
}

interface GitInvocation {
	subcommand: string
	args: string[]
}

function normalizeExecutableName(head: string | null): string | null {
	if (!head) return null
	const normalized = head.replace(/\\/g, '/')
	const base = normalized.split('/').pop() || normalized
	return base.toLowerCase().endsWith('.exe') ? base.slice(0, -4) : base
}

function parseGitInvocation(segment: string): GitInvocation | null {
	const { words, cmdIndex, head } = getCommandWords(segment)
	if (cmdIndex === -1 || normalizeExecutableName(head) !== 'git') return null

	// Skip git global options before subcommand.
	const optionsWithValue = new Set([
		'-C',
		'-c',
		'--git-dir',
		'--work-tree',
		'--namespace',
		'--super-prefix',
		'--config-env',
	])

	let i = cmdIndex + 1
	while (i < words.length) {
		const word = words[i] || ''

		if (word === '--') {
			i++
			break
		}

		if (!word.startsWith('-')) break

		if (
			optionsWithValue.has(word) ||
			word.startsWith('--git-dir=') ||
			word.startsWith('--work-tree=') ||
			word.startsWith('--namespace=') ||
			word.startsWith('--super-prefix=') ||
			word.startsWith('--config-env=')
		) {
			i += optionsWithValue.has(word) ? 2 : 1
			continue
		}

		i++
	}

	if (i >= words.length) return null

	const subcommand = words[i] || ''
	if (subcommand.length === 0) return null
	return { subcommand, args: words.slice(i + 1) }
}

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

export function checkCommand(command: string): {
	blocked: boolean
	reason?: string
} {
	return checkCommandInternal(command, 0)
}

function checkCommandInternal(
	command: string,
	depth: number,
): { blocked: boolean; reason?: string } {
	if (depth > 4) return { blocked: false }
	const { segments, unbalanced } = splitShellSegments(command)
	if (unbalanced) {
		return {
			blocked: true,
			reason:
				'Unbalanced shell input detected. Refusing to run safety checks on ambiguous command.',
		}
	}

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

			if (subcommand === 'push' && hasForceFlag(args)) {
				return {
					blocked: true,
					reason:
						'Force push can destroy remote history. Use --force-with-lease if you must.',
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
			if (subcommand === 'restore' && args.includes('.')) {
				return {
					blocked: true,
					reason: 'git restore . discards all unstaged changes permanently.',
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
				hasLongFlag(args, '--delete') &&
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
			if (subcommand === 'checkout') {
				const sepIdx = args.indexOf('--')
				if (sepIdx >= 0 && sepIdx < args.length - 1) {
					return {
						blocked: true,
						reason:
							'git checkout <ref> -- <path> overwrites files without backup. Use `git stash` to save changes first, or `git diff <ref> -- <path>` to review.',
					}
				}
			}
		}

		const { words, cmdIndex, head } = getCommandWords(segment)
		const normalizedHead = normalizeExecutableName(head)
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

function extractWrappedShellCommand(segment: string): string | null {
	const { words, cmdIndex, head } = getCommandWords(segment)
	if (cmdIndex < 0) return null
	const normalizedHead = normalizeExecutableName(head)
	const args = words.slice(cmdIndex + 1)

	if (
		normalizedHead === 'sh' ||
		normalizedHead === 'bash' ||
		normalizedHead === 'zsh'
	) {
		for (let i = 0; i < args.length - 1; i++) {
			const arg = args[i] || ''
			if (arg === '-c' || (/^-[A-Za-z]+$/.test(arg) && arg.includes('c'))) {
				return args[i + 1] || null
			}
		}
		return null
	}

	if (normalizedHead === 'eval') {
		return args.join(' ').trim() || null
	}

	if (normalizedHead === 'env') {
		let i = 0
		while (i < args.length) {
			const arg = args[i] || ''
			if (arg === '--') {
				i++
				break
			}
			if (arg === '-u') {
				i += 2
				continue
			}
			if (arg.startsWith('-')) {
				i++
				continue
			}
			if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(arg)) {
				i++
				continue
			}
			break
		}
		return args.slice(i).join(' ').trim() || null
	}

	if (normalizedHead === 'xargs') {
		const optsWithValue = new Set([
			'-I',
			'--replace',
			'-n',
			'-L',
			'-P',
			'-s',
			'-d',
			'-E',
			'-e',
		])
		let i = 0
		while (i < args.length) {
			const arg = args[i] || ''
			if (arg === '--') {
				i++
				break
			}
			if (!arg.startsWith('-')) break
			if (optsWithValue.has(arg)) {
				i += 2
				continue
			}
			i++
		}
		return args.slice(i).join(' ').trim() || null
	}

	return null
}

function extractCommandSubstitutions(segment: string): string[] {
	const snippets: string[] = []
	let i = 0
	let inSingle = false
	let inDouble = false
	let escaped = false

	while (i < segment.length) {
		const ch = segment[i] || ''

		if (escaped) {
			escaped = false
			i++
			continue
		}

		if (ch === '\\') {
			escaped = true
			i++
			continue
		}

		if (ch === "'" && !inDouble) {
			inSingle = !inSingle
			i++
			continue
		}
		if (ch === '"' && !inSingle) {
			inDouble = !inDouble
			i++
			continue
		}

		if (!inSingle && ch === '$' && segment[i + 1] === '(') {
			const end = consumeCommandSubstitution(segment, i)
			const inner = segment.slice(i + 2, Math.max(i + 2, end - 1)).trim()
			if (inner.length > 0) snippets.push(inner)
			i = end
			continue
		}

		if (!inSingle && ch === '`') {
			let j = i + 1
			let inner = ''
			let innerEscaped = false
			while (j < segment.length) {
				const innerCh = segment[j] || ''
				if (innerEscaped) {
					inner += innerCh
					innerEscaped = false
					j++
					continue
				}
				if (innerCh === '\\') {
					innerEscaped = true
					j++
					continue
				}
				if (innerCh === '`') break
				inner += innerCh
				j++
			}
			if (inner.trim().length > 0) snippets.push(inner.trim())
			i = j < segment.length ? j + 1 : j
			continue
		}

		i++
	}

	return snippets
}

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
export function isCommitCommand(command: string): {
	isCommit: boolean
	hasNoVerify: boolean
	hasWipMessage: boolean
} {
	const { segments } = splitShellSegments(command)
	const commitSegments = segments
		.map((seg) => ({ seg, parsed: parseGitInvocation(seg) }))
		.filter(({ parsed }) => parsed?.subcommand === 'commit')

	if (commitSegments.length === 0) {
		return { isCommit: false, hasNoVerify: false, hasWipMessage: false }
	}

	const commitStates = commitSegments.map(({ parsed }) => {
		const args = parsed?.args ?? []
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

async function runGit(
	args: string[],
	cwd?: string,
): Promise<{ stdout: string; exitCode: number }> {
	const proc = Bun.spawn(['git', ...args], {
		cwd,
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const stdout = await new Response(proc.stdout).text()
	const exitCode = await proc.exited
	return { stdout: stdout.trim(), exitCode }
}

export async function getCurrentBranch(cwd?: string): Promise<string | null> {
	try {
		const result = await runGit(['branch', '--show-current'], cwd)
		if (result.exitCode !== 0) {
			return null
		}
		return result.stdout || null
	} catch {
		return null
	}
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
		let input: PreToolUseHookInput
		try {
			input = (await Bun.stdin.json()) as PreToolUseHookInput
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

		if (
			!input ||
			typeof input !== 'object' ||
			typeof input.tool_name !== 'string'
		) {
			console.log(
				JSON.stringify({
					hookSpecificOutput: {
						hookEventName: 'PreToolUse',
						permissionDecision: 'deny',
						permissionDecisionReason:
							'Invalid hook payload. Safety hook is failing closed.',
					},
				}),
			)
			process.exit(2)
		}

		const toolInput = input.tool_input

		if (input.tool_name === 'Write' || input.tool_name === 'Edit') {
			const filePath = toolInput?.file_path
			if (typeof filePath !== 'string') {
				process.exit(0)
			}

			const fileResult = checkFileEdit(filePath)
			if (fileResult.blocked) {
				const hookSpecificOutput: PreToolUseHookSpecificOutput = {
					hookEventName: 'PreToolUse',
					permissionDecision: 'deny',
					permissionDecisionReason: fileResult.reason,
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
			const hookSpecificOutput: PreToolUseHookSpecificOutput = {
				hookEventName: 'PreToolUse',
				permissionDecision: 'deny',
				permissionDecisionReason: commandResult.reason,
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

		const commitCheck = isCommitCommand(command)
		if (commitCheck.isCommit) {
			const isLegitimateWip =
				commitCheck.hasNoVerify && commitCheck.hasWipMessage

			// Block ALL commits on protected branches (including WIP checkpoints)
			const branch = await getCurrentBranch(input.cwd)
			if (branch && PROTECTED_BRANCHES.includes(branch)) {
				const hookSpecificOutput: PreToolUseHookSpecificOutput = {
					hookEventName: 'PreToolUse',
					permissionDecision: 'deny',
					permissionDecisionReason: [
						`BLOCKED: Cannot commit directly to ${branch}.`,
						'',
						'Create a feature branch first:',
						'  git checkout -b <type>/<description>',
						'',
						'Then commit on the new branch.',
					].join('\n'),
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

			// Block --no-verify on non-WIP commits (prevents bypassing pre-commit hooks)
			if (commitCheck.hasNoVerify && !isLegitimateWip) {
				const hookSpecificOutput: PreToolUseHookSpecificOutput = {
					hookEventName: 'PreToolUse',
					permissionDecision: 'deny',
					permissionDecisionReason: [
						'BLOCKED: --no-verify is only allowed for WIP checkpoint commits.',
						'',
						'For regular commits, remove --no-verify so pre-commit hooks run.',
						'For WIP checkpoints, use a WIP message pattern:',
						'  git commit --no-verify -m "chore(wip): <description>"',
					].join('\n'),
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
		}
	} catch {
		// never crash the hook
	}

	process.exit(0)
}
