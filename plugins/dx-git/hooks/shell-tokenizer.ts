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

/** Result of removing benign command-execution prefixes (time/nice/command). */
interface PrefixStripResult {
	headIndex: number
	skippedPrefix: boolean
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
	const parenReturnStack: LexerState[] = [] // state to return to when $() closes
	const braceReturnStack: LexerState[] = [] // state to return to when ${} closes
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
					parenReturnStack.push('normal')
					state = 'dollar-paren'
					depth++
					buf += '$('
					i += 2
				} else if (ch === '$' && i + 1 < i_max && command[i + 1] === '{') {
					braceReturnStack.push('normal')
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
					parenReturnStack.push('double-quote')
					state = 'dollar-paren'
					depth++
					buf += '$('
					i += 2
				} else if (ch === '$' && i + 1 < i_max && command[i + 1] === '{') {
					braceReturnStack.push('double-quote')
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
						state = parenReturnStack.pop() ?? 'normal'
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
				} else if (
					ch === '<' &&
					i + 1 < i_max &&
					command[i + 1] === '<' &&
					(i + 2 >= i_max || command[i + 2] !== '<')
				) {
					// Heredoc inside $() -- consume the delimiter and body so
					// the heredoc content does not interfere with depth tracking
					// or get misinterpreted as flags/arguments.
					buf += '<<'
					i += 2
					// Parse optional `-` for <<-
					let innerStrip = false
					if (i < i_max && command[i] === '-') {
						innerStrip = true
						buf += '-'
						i++
					}
					// Skip spaces between << and delimiter
					while (i < i_max && command[i] === ' ') {
						buf += ' '
						i++
					}
					// Parse delimiter (optionally quoted)
					let innerDelim = ''
					if (i < i_max && (command[i] === "'" || command[i] === '"')) {
						const qc = command[i]!
						buf += qc
						i++
						while (i < i_max && command[i] !== qc) {
							innerDelim += command[i]
							buf += command[i]!
							i++
						}
						if (i < i_max) {
							buf += command[i]!
							i++
						}
					} else if (i < i_max && command[i] === '\\') {
						buf += command[i]!
						i++
						while (i < i_max && /\S/.test(command[i] as string)) {
							innerDelim += command[i]
							buf += command[i]!
							i++
						}
					} else {
						while (i < i_max && /[A-Za-z0-9_]/.test(command[i] as string)) {
							innerDelim += command[i]
							buf += command[i]!
							i++
						}
					}
					if (innerDelim.length > 0) {
						// Consume heredoc body until closing delimiter line.
						// Skip leading newline if present.
						if (i < i_max && command[i] === '\n') {
							buf += '\n'
							i++
						}
						let foundEnd = false
						while (i < i_max && !foundEnd) {
							const lineStart = i
							while (i < i_max && command[i] !== '\n') i++
							let line = command.slice(lineStart, i)
							if (innerStrip) {
								line = line.replace(/^\t+/, '')
							}
							buf += command.slice(lineStart, i)
							if (line.trim() === innerDelim) {
								foundEnd = true
							}
							if (i < i_max) {
								buf += '\n'
								i++
							}
						}
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
						state = braceReturnStack.pop() ?? 'normal'
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

/**
 * Expands ANSI-C escape sequences within a `$'...'` string body.
 * Handles: \xHH (hex), \0NNN (octal), \n, \t, \r, \\, \', \", \a, \b, \f, \v
 */
function expandAnsiCEscapes(body: string): string {
	let result = ''
	let i = 0
	while (i < body.length) {
		if (body[i] === '\\' && i + 1 < body.length) {
			const next = body[i + 1]!
			switch (next) {
				case 'n':
					result += '\n'
					i += 2
					break
				case 't':
					result += '\t'
					i += 2
					break
				case 'r':
					result += '\r'
					i += 2
					break
				case 'a':
					result += '\x07'
					i += 2
					break
				case 'b':
					result += '\b'
					i += 2
					break
				case 'f':
					result += '\f'
					i += 2
					break
				case 'v':
					result += '\v'
					i += 2
					break
				case '\\':
					result += '\\'
					i += 2
					break
				case "'":
					result += "'"
					i += 2
					break
				case '"':
					result += '"'
					i += 2
					break
				case 'x': {
					const hex = body.slice(i + 2, i + 4)
					if (/^[0-9a-fA-F]{2}$/.test(hex)) {
						result += String.fromCharCode(Number.parseInt(hex, 16))
						i += 4
					} else {
						result += body[i]
						i++
					}
					break
				}
				case '0':
				case '1':
				case '2':
				case '3':
				case '4':
				case '5':
				case '6':
				case '7': {
					// Octal: \0NNN or \NNN (1-3 octal digits starting from next char)
					const octStart = i + 1
					const octSlice = body.slice(octStart, octStart + 4)
					const match = octSlice.match(/^([0-7]{1,4})/)
					if (match) {
						// Bash limits to 3 octal digits for \0NNN, or the leading digit + 2 more
						const digits = match[1]!.slice(0, next === '0' ? 4 : 3)
						result += String.fromCharCode(Number.parseInt(digits, 8) & 0xff)
						i += 1 + digits.length
					} else {
						result += body[i]
						i++
					}
					break
				}
				default:
					result += body[i]
					i++
			}
		} else {
			result += body[i]
			i++
		}
	}
	return result
}

/**
 * Performs POSIX/Bash-style quote removal on a word. Handles fully quoted
 * words, mixed fragments (e.g. --fo"rce" -> --force), and ANSI-C $'...' escapes.
 */
function unquoteWord(word: string): string {
	// Fast paths for fully quoted words
	if (word.length >= 3 && word.startsWith("$'") && word.endsWith("'")) {
		return expandAnsiCEscapes(word.slice(2, -1))
	}
	if (word.length >= 2 && word.startsWith("'") && word.endsWith("'")) {
		return word.slice(1, -1)
	}
	if (word.length >= 2 && word.startsWith('"') && word.endsWith('"')) {
		return word.slice(1, -1)
	}
	// No quotes at all - return as-is
	if (!word.includes("'") && !word.includes('"') && !word.includes('\\')) {
		return word
	}
	// Mixed quoted/unquoted fragments: strip quotes per POSIX quote removal
	let out = ''
	let i = 0
	let inSingle = false
	let inDouble = false
	while (i < word.length) {
		const ch = word[i]!
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
		if (ch === '\\' && !inSingle && i + 1 < word.length) {
			out += word[i + 1]!
			i += 2
			continue
		}
		out += ch
		i++
	}
	return out
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
	// Fast path: no quoting characters at all
	if (!/['"`$\\]/.test(segment)) {
		return segment.trim().split(/\s+/).filter(Boolean)
	}

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

		// Backslash escape outside quotes: consume next char as literal
		if (!inSingle && ch === '\\' && i + 1 < segment.length) {
			current += segment[i + 1]
			i += 2
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

/** Git global options that consume a following value argument. */
const GIT_OPTIONS_WITH_VALUE = new Set([
	'-C',
	'-c',
	'--git-dir',
	'--work-tree',
	'--namespace',
	'--super-prefix',
	'--config-env',
])

function isWordOption(word: string): boolean {
	return word.startsWith('-')
}

/**
 * Strips common execution prefixes that wrap a real command while preserving
 * command semantics (e.g., `command git ...`, `time git ...`, `nice -n 5 git ...`).
 */
function stripExecutionPrefixes(
	words: string[],
	startIndex: number,
): PrefixStripResult {
	let i = startIndex
	let skippedPrefix = false

	while (i < words.length) {
		const head = normalizeExecutableName(words[i] || null)
		if (!head) break

		if (head === 'command' || head === 'builtin') {
			skippedPrefix = true
			i++
			while (i < words.length) {
				const word = words[i] || ''
				if (word === '--') {
					i++
					break
				}
				if (!isWordOption(word)) break
				i++
			}
			continue
		}

		if (head === 'time') {
			skippedPrefix = true
			i++
			const timeOptionsWithValue = new Set(['-f', '-o', '--format', '--output'])
			while (i < words.length) {
				const word = words[i] || ''
				if (word === '--') {
					i++
					break
				}
				if (!isWordOption(word)) break
				if (timeOptionsWithValue.has(word)) {
					i += 2
					continue
				}
				i++
			}
			continue
		}

		if (head === 'nice') {
			skippedPrefix = true
			i++
			while (i < words.length) {
				const word = words[i] || ''
				if (word === '--') {
					i++
					break
				}
				if (word === '-n' || word === '--adjustment') {
					i += 2
					continue
				}
				if (word.startsWith('-n')) {
					i++
					continue
				}
				if (!isWordOption(word)) break
				i++
			}
			continue
		}

		if (head === 'nohup' || head === 'chronic') {
			skippedPrefix = true
			i++
			if ((words[i] || '') === '--') i++
			continue
		}

		if (head === 'sudo') {
			skippedPrefix = true
			i++
			const optionsWithValue = new Set([
				'-u',
				'--user',
				'-g',
				'--group',
				'-h',
				'--host',
				'-p',
				'--prompt',
				'-C',
				'--close-from',
				'-r',
				'--role',
				'-t',
				'--type',
				'-T',
				'--command-timeout',
			])
			while (i < words.length) {
				const word = words[i] || ''
				if (word === '--') {
					i++
					break
				}
				if (!isWordOption(word)) break
				// Handle --option=value form
				if (word.includes('=')) {
					i++
					continue
				}
				if (optionsWithValue.has(word)) {
					i += 2
					continue
				}
				i++
			}
			continue
		}

		if (head === 'stdbuf') {
			skippedPrefix = true
			i++
			while (i < words.length) {
				const word = words[i] || ''
				if (word === '--') {
					i++
					break
				}
				if (!isWordOption(word)) break
				if (word === '-i' || word === '-o' || word === '-e') {
					i += 2
					continue
				}
				i++
			}
			continue
		}

		if (head === 'chrt' || head === 'ionice' || head === 'setsid') {
			skippedPrefix = true
			i++
			while (i < words.length) {
				const word = words[i] || ''
				if (word === '--') {
					i++
					break
				}
				if (!isWordOption(word)) break
				// Some flags for chrt/ionice consume a value; this is conservative.
				if (
					word === '-p' ||
					word === '--pid' ||
					word === '-c' ||
					word === '--class' ||
					word === '-n' ||
					word === '--classdata'
				) {
					i += 2
					continue
				}
				i++
			}
			// chrt commonly uses: chrt -r <priority> <command> ...
			const maybePriority = words[i] || ''
			if (
				head === 'chrt' &&
				/^\d+$/.test(maybePriority) &&
				i + 1 < words.length
			) {
				i++
			}
			continue
		}

		break
	}

	return { headIndex: i, skippedPrefix }
}

/**
 * Parses a shell segment to extract a git subcommand and its arguments,
 * skipping global git options (e.g., `-C`, `--git-dir`). Returns null if
 * the segment is not a git invocation.
 */
export function parseGitInvocation(segment: string): GitInvocation | null {
	const { words, cmdIndex, head } = getCommandWords(segment)
	if (cmdIndex === -1 || !head) return null
	const { headIndex } = stripExecutionPrefixes(words, cmdIndex)
	if (headIndex >= words.length) return null
	if (normalizeExecutableName(words[headIndex] || null) !== 'git') return null

	// Skip git global options before subcommand.
	let i = headIndex + 1
	while (i < words.length) {
		const word = words[i] || ''

		if (word === '--') {
			i++
			break
		}

		if (!word.startsWith('-')) break

		if (
			GIT_OPTIONS_WITH_VALUE.has(word) ||
			word.startsWith('--git-dir=') ||
			word.startsWith('--work-tree=') ||
			word.startsWith('--namespace=') ||
			word.startsWith('--super-prefix=') ||
			word.startsWith('--config-env=')
		) {
			i += GIT_OPTIONS_WITH_VALUE.has(word) ? 2 : 1
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
		normalizedHead === 'zsh' ||
		normalizedHead === 'dash' ||
		normalizedHead === 'ksh' ||
		normalizedHead === 'fish' ||
		normalizedHead === 'pwsh' ||
		normalizedHead === 'powershell'
	) {
		for (let i = 0; i < args.length - 1; i++) {
			const arg = args[i] || ''
			if (
				arg === '-c' ||
				arg === '--command' ||
				arg === '-Command' ||
				(/^-[A-Za-z]+$/.test(arg) && arg.includes('c'))
			) {
				return args[i + 1] || null
			}
		}
		return null
	}

	if (normalizedHead === 'eval') {
		return args.join(' ').trim() || null
	}

	if (normalizedHead === 'env') {
		const envOptionsWithValue = new Set([
			'-u',
			'--unset',
			'-C',
			'--chdir',
			'-a',
			'--argv0',
			'-S',
			'--split-string',
		])
		let i = 0
		while (i < args.length) {
			const arg = args[i] || ''
			if (arg === '--') {
				i++
				break
			}
			if (
				arg.startsWith('--chdir=') ||
				arg.startsWith('--unset=') ||
				arg.startsWith('--argv0=') ||
				arg.startsWith('--split-string=')
			) {
				i++
				continue
			}
			if (envOptionsWithValue.has(arg)) {
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

	if (
		normalizedHead === 'command' ||
		normalizedHead === 'builtin' ||
		normalizedHead === 'time' ||
		normalizedHead === 'nice' ||
		normalizedHead === 'nohup' ||
		normalizedHead === 'chronic' ||
		normalizedHead === 'sudo' ||
		normalizedHead === 'stdbuf' ||
		normalizedHead === 'chrt' ||
		normalizedHead === 'ionice' ||
		normalizedHead === 'setsid'
	) {
		const { headIndex, skippedPrefix } = stripExecutionPrefixes(words, cmdIndex)
		if (!skippedPrefix || headIndex >= words.length) return null
		return words.slice(headIndex).join(' ').trim() || null
	}

	return null
}
