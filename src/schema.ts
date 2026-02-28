import { z } from 'zod'

/**
 * Coerce a value that may be a Date (from gray-matter YAML parsing)
 * into a YYYY-MM-DD string.
 */
const DateString = z.preprocess(
	(val) => {
		if (val instanceof Date) {
			return val.toISOString().slice(0, 10)
		}
		return val
	},
	z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
)

/**
 * Coerce tags that may come as non-string arrays from YAML.
 */
const TagsArray = z.preprocess((val) => {
	if (Array.isArray(val)) {
		return val.map((v) => String(v))
	}
	return val
}, z.array(z.string()).optional())

/**
 * Core frontmatter schema for Cortex documents.
 * All fields are optional to support best-effort indexing of external docs.
 * `created` and `title` are encouraged for discoverability.
 */
export const FrontmatterSchema = z
	.object({
		created: DateString.optional(),
		title: z.coerce.string().optional(),
		type: z.coerce.string().optional(),
		tags: TagsArray,
		project: z.coerce.string().optional(),
		status: z.coerce.string().optional(),
		updated: DateString.optional(),
	})
	.passthrough()

/** Parsed frontmatter data from a Cortex document */
export type Frontmatter = z.infer<typeof FrontmatterSchema>

/** A parsed Cortex document with frontmatter, body, and file metadata */
export interface CortexDoc {
	/** Parsed and validated frontmatter */
	frontmatter: Frontmatter
	/** Markdown body content (without frontmatter) */
	body: string
	/** Absolute file path */
	path: string
	/** Filename without extension (e.g. "2026-02-27-my-doc") */
	stem: string
}
