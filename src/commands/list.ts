import {
	EXIT_CODES,
	formatTable,
	projectFields,
	writeSuccess,
} from '../output.js'
import type { CortexDoc } from '../schema.js'

export type ListOptions = {
	type?: string
	tags?: string
	project?: string
	status?: string
	json?: boolean
	fields?: string
	quiet?: boolean
	warnings?: string[]
}

/**
 * List Cortex docs with optional filters.
 * Sorts by created date descending.
 */
export function runList(docs: CortexDoc[], options: ListOptions): number {
	let filtered = docs

	if (options.type) {
		const t = options.type.toLowerCase()
		filtered = filtered.filter((d) => d.frontmatter.type?.toLowerCase() === t)
	}

	if (options.status) {
		const s = options.status.toLowerCase()
		filtered = filtered.filter((d) => d.frontmatter.status?.toLowerCase() === s)
	}

	if (options.project) {
		const p = options.project.toLowerCase()
		filtered = filtered.filter(
			(d) => d.frontmatter.project?.toLowerCase() === p,
		)
	}

	if (options.tags) {
		// OR semantics: doc matches if it has any of the requested tags
		const requestedTags = options.tags
			.split(',')
			.map((t) => t.trim().toLowerCase())
		filtered = filtered.filter((d) => {
			const docTags = d.frontmatter.tags?.map((t) => t.toLowerCase()) ?? []
			return requestedTags.some((rt) => docTags.includes(rt))
		})
	}

	// Sort by created date descending, path ascending as tiebreaker
	filtered.sort((a, b) => {
		const aDate = String(a.frontmatter.created ?? '')
		const bDate = String(b.frontmatter.created ?? '')
		const dateCmp = bDate.localeCompare(aDate)
		if (dateCmp !== 0) return dateCmp
		return a.path.localeCompare(b.path)
	})

	// In quiet mode, suppress all output except errors
	if (options.quiet) return EXIT_CODES.SUCCESS

	// Output
	const isJson = options.json || !process.stdout.isTTY

	if (options.fields) {
		const fields = options.fields.split(',').map((f) => f.trim())
		const projected = projectFields(filtered, fields)
		writeSuccess(projected, {
			json: isJson,
			count: projected.length,
			warnings: options.warnings,
		})
		return EXIT_CODES.SUCCESS
	}

	if (isJson) {
		const data = filtered.map((d) => ({
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
		process.stdout.write(`${formatTable(filtered)}\n`)
	}

	return EXIT_CODES.SUCCESS
}
