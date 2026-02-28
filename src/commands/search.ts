import {
	EXIT_CODES,
	formatTable,
	projectFields,
	writeSuccess,
} from '../output.js'
import type { CortexDoc } from '../schema.js'

export type SearchOptions = {
	json?: boolean
	limit?: number
	fields?: string
	quiet?: boolean
	warnings?: string[]
}

/**
 * Search Cortex docs with case-insensitive substring matching
 * across title, tags, project, type, and body.
 */
export function runSearch(
	docs: CortexDoc[],
	query: string,
	options: SearchOptions,
): number {
	const q = query.toLowerCase()
	const limit = options.limit ?? 20

	const matches = docs.filter((doc) => {
		const { frontmatter, body } = doc

		// Search frontmatter fields
		if (frontmatter.title?.toLowerCase().includes(q)) return true
		if (frontmatter.type?.toLowerCase().includes(q)) return true
		if (frontmatter.project?.toLowerCase().includes(q)) return true
		if (frontmatter.tags?.some((t) => t.toLowerCase().includes(q))) return true

		// Search body content
		if (body.toLowerCase().includes(q)) return true

		// Search filename stem
		if (doc.stem.toLowerCase().includes(q)) return true

		return false
	})

	// Sort by created date descending, path ascending as tiebreaker
	matches.sort((a, b) => {
		const aDate = String(a.frontmatter.created ?? '')
		const bDate = String(b.frontmatter.created ?? '')
		const dateCmp = bDate.localeCompare(aDate)
		if (dateCmp !== 0) return dateCmp
		return a.path.localeCompare(b.path)
	})
	const limited = matches.slice(0, limit)

	// In quiet mode, suppress all output except errors
	if (options.quiet) return EXIT_CODES.SUCCESS

	// Output
	const isJson = options.json || !process.stdout.isTTY

	if (options.fields) {
		const fields = options.fields.split(',').map((f) => f.trim())
		const projected = projectFields(limited, fields)
		writeSuccess(projected, {
			json: isJson,
			count: projected.length,
			warnings: options.warnings,
		})
		return EXIT_CODES.SUCCESS
	}

	if (isJson) {
		const data = limited.map((d) => ({
			...d.frontmatter,
			path: d.path,
			stem: d.stem,
		}))
		writeSuccess(data, {
			json: true,
			count: data.length,
			warnings: options.warnings,
		})
	} else {
		process.stdout.write(
			`Found ${matches.length} result${matches.length === 1 ? '' : 's'}${matches.length > limit ? ` (showing first ${limit})` : ''}:\n\n`,
		)
		process.stdout.write(`${formatTable(limited)}\n`)
	}

	return EXIT_CODES.SUCCESS
}
