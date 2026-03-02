/**
 * Shell Tokenizer
 *
 * A two-stage lexer for safe command parsing. Splits shell command strings
 * into typed tokens (operators, text, heredoc bodies) while tracking quoting
 * and subshell nesting state. Provides higher-level utilities to extract
 * command words, parse git invocations, and unwrap shell wrappers (sh -c,
 * eval, env, xargs).
 *
 * This module is intentionally limited to parsing/tokenizing -- it contains
 * no policy or safety logic. See git-safety.ts for the safety hook that
 * consumes these utilities.
 */

// ---------------------------------------------------------------------------
// Types
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

export interface Token {
	type: TokenType
	value: string
}

export interface TokenizeResult {
	tokens: Token[]
	unbalanced: boolean
}

export interface ShellParseResult {
	segments: string[]
	unbalanced: boolean
}

export interface CommandWords {
	words: string[]
	cmdIndex: number
	head: string | null
}

export interface GitInvocation {
	subcommand: string
	args: string[]
}

// ---------------------------------------------------------------------------
// Core tokenizer
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Segment splitting
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Command word extraction
// ---------------------------------------------------------------------------

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

/** Removes surrounding single or double quotes from a word. */
function unquoteWord(word: string): string {
	if (word.length >= 2 && word.startsWith("'") && word.endsWith("'")) {
		return word.slice(1, -1)
	}
	if (word.length >= 2 && word.startsWith('"') && word.endsWith('"')) {
		return word.slice(1, -1)
	}
	return word
}

/**
 * Consumes a `$(...)` command substitution starting at position `start`,
 * tracking nested parentheses and quotes. Returns the index one past the
 * closing `)`.
 */
export function consumeCommandSubstitution(
	segment: string,
	start: number,
): number {
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

/**
 * Splits a shell segment into individual words, respecting single/double
 * quotes and `$(...)` command substitutions. Unquotes simple quoted words.
 */
export function splitShellWords(segment: string): string[] {
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

/**
 * Returns the word list, the index of the first command word (skipping
 * env var assignments), and the command head.
 */
export function getCommandWords(segment: string): CommandWords {
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

// ---------------------------------------------------------------------------
// Executable name normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes an executable name by stripping directory prefixes and the
 * `.exe` suffix. Returns null if the input is null.
 */
export function normalizeExecutableName(head: string | null): string | null {
	if (!head) return null
	const normalized = head.replace(/\\/g, '/')
	const base = normalized.split('/').pop() || normalized
	return base.toLowerCase().endsWith('.exe') ? base.slice(0, -4) : base
}

// ---------------------------------------------------------------------------
// Git invocation parsing
// ---------------------------------------------------------------------------

/**
 * Parses a shell segment to extract a git subcommand and its arguments,
 * skipping global git options (e.g., `-C`, `--git-dir`). Returns null if
 * the segment is not a git invocation.
 */
export function parseGitInvocation(segment: string): GitInvocation | null {
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

// ---------------------------------------------------------------------------
// Command substitution extraction
// ---------------------------------------------------------------------------

/**
 * Extracts all `$(...)` and backtick command substitutions from a shell
 * segment, returning the inner command strings.
 */
export function extractCommandSubstitutions(segment: string): string[] {
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

// ---------------------------------------------------------------------------
// Shell wrapper unwrapping
// ---------------------------------------------------------------------------

/**
 * Detects shell wrappers (`sh -c`, `bash -c`, `eval`, `env`, `xargs`) and
 * extracts the inner command string for recursive safety analysis.
 * Returns null if the segment is not a recognized wrapper pattern.
 */
export function extractWrappedShellCommand(segment: string): string | null {
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
