import type { CortexDoc } from './schema.js'

/** Error codes and their agent-actionable hints */
const ERROR_CODE_ACTIONS: Record<
	string,
	{ action: string; retryable: boolean }
> = {
	E_CONFIG: { action: 'CHECK_CONFIG', retryable: false },
	E_NOT_FOUND: { action: 'TRY_DIFFERENT_QUERY', retryable: false },
	E_USAGE: { action: 'FIX_ARGS', retryable: false },
	E_PARSE: { action: 'CHECK_FRONTMATTER', retryable: false },
	E_RUNTIME: { action: 'ESCALATE', retryable: false },
}

/** Exit codes for typed agent branching */
export const EXIT_CODES = {
	SUCCESS: 0,
	ERROR: 1,
	INVALID_ARGS: 2,
	CONFIG_ERROR: 3,
	NOT_FOUND: 4,
} as const

/** JSON success envelope for stdout */
export interface SuccessEnvelope<T = unknown> {
	status: 'ok'
	data: T
	count?: number
	warnings?: string[]
}

/** JSON error envelope for stdout */
export interface ErrorEnvelope {
	status: 'error'
	message: string
	error: {
		code: string
		action: string
		retryable: boolean
	}
}

/**
 * Write a success response as a JSON envelope to stdout.
 * Always emits regardless of TTY or --json flag -- Unix convention is
 * structured data on stdout, human messages on stderr.
 */
export function writeSuccess<T>(
	data: T,
	options: { json?: boolean; count?: number; warnings?: string[] } = {},
): void {
	const envelope: SuccessEnvelope<T> = {
		status: 'ok',
		data,
		...(options.count !== undefined && { count: options.count }),
		...(options.warnings?.length && { warnings: options.warnings }),
	}
	process.stdout.write(`${JSON.stringify(envelope)}\n`)
}

/**
 * Write an error response to stderr (human) and stdout (JSON envelope for agents).
 */
export function writeError(
	message: string,
	code: string,
	options: { json?: boolean } = {},
): void {
	const hints = ERROR_CODE_ACTIONS[code] ?? {
		action: 'ESCALATE',
		retryable: false,
	}

	// Human-readable on stderr
	process.stderr.write(`Error: ${message}\n`)

	// JSON envelope on stdout for agents (when in JSON mode or piped)
	if (options.json || !process.stdout.isTTY) {
		const envelope: ErrorEnvelope = {
			status: 'error',
			message,
			error: { code, ...hints },
		}
		process.stdout.write(`${JSON.stringify(envelope)}\n`)
	}
}

/**
 * Format docs as a human-readable table for TTY output.
 */
export function formatTable(docs: CortexDoc[]): string {
	if (docs.length === 0) return 'No documents found.'

	const rows = docs.map((doc) => ({
		type: doc.frontmatter.type ?? '-',
		status: doc.frontmatter.status ?? '-',
		project: doc.frontmatter.project ?? '-',
		title: doc.frontmatter.title ?? doc.stem,
		created: String(doc.frontmatter.created ?? '-'),
		path: doc.path,
	}))

	// Calculate column widths (loop instead of spread to avoid stack overflow)
	const cols = ['type', 'status', 'project', 'title', 'created'] as const
	const widths: Record<string, number> = {}
	for (const col of cols) {
		let max = col.length
		for (const row of rows) {
			const len = String(row[col]).length
			if (len > max) max = len
		}
		widths[col] = max
	}

	// Cap title width at 40 chars
	widths.title = Math.min(widths.title ?? 5, 40)

	const w = (c: string): number => widths[c] ?? c.length

	const header = cols.map((c) => c.toUpperCase().padEnd(w(c))).join('  ')
	const separator = cols.map((c) => '-'.repeat(w(c))).join('  ')
	const body = rows
		.map((r) =>
			cols
				.map((c) => {
					const val = String(r[c])
					const width = w(c)
					return (
						val.length > width ? `${val.slice(0, width - 1)}~` : val
					).padEnd(width)
				})
				.join('  '),
		)
		.join('\n')

	return `${header}\n${separator}\n${body}`
}

/**
 * Apply field projection to doc data.
 * Returns only the requested fields from frontmatter + path.
 */
export function projectFields(
	docs: CortexDoc[],
	fields: string[],
): Record<string, unknown>[] {
	return docs.map((doc) => {
		const result: Record<string, unknown> = {}
		for (const field of fields) {
			if (field === 'path') {
				result.path = doc.path
			} else if (field === 'stem') {
				result.stem = doc.stem
			} else if (field === 'body') {
				result.body = doc.body
			} else if (field in doc.frontmatter) {
				result[field] = doc.frontmatter[field as keyof typeof doc.frontmatter]
			}
		}
		return result
	})
}
