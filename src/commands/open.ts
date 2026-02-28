import { spawnSync } from 'node:child_process'
import type { CortexConfig } from '../config.js'
import { EXIT_CODES, writeError, writeSuccess } from '../output.js'
import type { CortexDoc } from '../schema.js'

export type OpenOptions = {
	json?: boolean
	quiet?: boolean
	warnings?: string[]
}

/**
 * Open a Cortex doc by identifier (filename stem).
 * Resolves by exact match first, then substring.
 */
export function runOpen(
	docs: CortexDoc[],
	identifier: string,
	config: CortexConfig,
	options: OpenOptions = {},
): number {
	const id = identifier.toLowerCase()

	// Exact match on stem
	let matches = docs.filter((d) => d.stem.toLowerCase() === id)

	// Fall back to substring match
	if (matches.length === 0) {
		matches = docs.filter((d) => d.stem.toLowerCase().includes(id))
	}

	if (matches.length === 0) {
		// Suggest similar docs
		const suggestions = docs
			.filter((d) => {
				const stem = d.stem.toLowerCase()
				// Check if any word in the identifier appears in the stem
				return id
					.split('-')
					.some((word) => word.length > 2 && stem.includes(word))
			})
			.slice(0, 5)

		let msg = `No document matching "${identifier}".`
		if (suggestions.length > 0) {
			msg += ` Did you mean:\n${suggestions.map((s) => `  - ${s.stem}`).join('\n')}`
		}
		writeError(msg, 'E_NOT_FOUND', options)
		return EXIT_CODES.NOT_FOUND
	}

	if (matches.length > 1) {
		const list = matches.map((m) => `  - ${m.stem} (${m.path})`).join('\n')
		writeError(
			`Multiple matches for "${identifier}". Be more specific:\n${list}`,
			'E_USAGE',
			options,
		)
		return EXIT_CODES.INVALID_ARGS
	}

	const doc = matches[0]
	if (!doc) return EXIT_CODES.ERROR

	// Build viewer command safely
	const viewerConfig = config.viewer ?? 'open'
	let cmd: string
	let args: string[]

	if (Array.isArray(viewerConfig)) {
		cmd = viewerConfig[0] ?? 'open'
		const hasPlaceholder = viewerConfig.some((t) => t.includes('%s'))
		args = hasPlaceholder
			? viewerConfig.slice(1).map((t) => t.replace('%s', doc.path))
			: [...viewerConfig.slice(1), doc.path]
	} else {
		// String form -- split on spaces (simple commands only)
		const tokens = viewerConfig.split(' ')
		cmd = tokens[0] ?? 'open'
		args = viewerConfig.includes('%s')
			? tokens.slice(1).map((t) => t.replace('%s', doc.path))
			: [...tokens.slice(1), doc.path]
	}
	const result = spawnSync(cmd, args, { stdio: 'inherit' })

	if (result.status !== 0) {
		writeError(`Failed to open ${doc.path}`, 'E_RUNTIME', options)
		return EXIT_CODES.ERROR
	}

	// Emit structured success for agents, human feedback on stderr
	if (!options.quiet) {
		writeSuccess(
			{ path: doc.path, stem: doc.stem, viewer: viewerConfig },
			{ json: options.json, count: 1, warnings: options.warnings },
		)
		process.stderr.write(`Opened: ${doc.path}\n`)
	}
	return EXIT_CODES.SUCCESS
}
