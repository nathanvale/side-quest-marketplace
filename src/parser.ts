import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { getLogger } from '@logtape/logtape'
import matter from 'gray-matter'
import { type CortexConfig, expandHome } from './config.js'
import { type CortexDoc, FrontmatterSchema } from './schema.js'

const logger = getLogger(['cortex', 'parser'])

/** Maximum file size to read (1 MB) -- prevents OOM on large/bogus .md files */
const MAX_FILE_BYTES = 1_048_576

/** Directories to skip during recursive scan */
const IGNORE_DIRS = new Set([
	'.git',
	'.obsidian',
	'node_modules',
	'.claude',
	'.claude-plugin',
	'dist',
	'coverage',
])

/** Index health metrics for observability */
export type IndexHealth = {
	sources: number
	dirsResolved: number
	filesScanned: number
	docsParsed: number
}

/**
 * Scan all configured sources and build an in-memory index of Cortex docs.
 * Warns on malformed frontmatter but still indexes with available fields.
 */
export function buildIndex(config: CortexConfig): {
	docs: CortexDoc[]
	warnings: string[]
} {
	const docs: CortexDoc[] = []
	const warnings: string[] = []
	const seen = new Set<string>()
	const health: IndexHealth = {
		sources: config.sources.length,
		dirsResolved: 0,
		filesScanned: 0,
		docsParsed: 0,
	}

	for (const source of config.sources) {
		const expandedPath = expandHome(source.path)
		const resolvedPaths = resolveGlob(expandedPath)
		health.dirsResolved += resolvedPaths.length

		for (const dir of resolvedPaths) {
			logger.debug('Scanning {dir} (scope={scope})', {
				dir,
				scope: source.scope,
			})

			const files = scanDir(dir)
			health.filesScanned += files.length
			for (const filePath of files) {
				if (seen.has(filePath)) continue
				seen.add(filePath)
				const doc = parseDoc(filePath, warnings)
				if (doc) {
					docs.push(doc)
					health.docsParsed++
				}
			}
		}
	}

	// Warn when index appears degraded
	if (health.dirsResolved === 0) {
		logger.warn(
			'No directories resolved from {sources} source(s) -- check config.yaml paths',
			{ sources: health.sources },
		)
	} else if (health.filesScanned === 0) {
		logger.warn(
			'Scanned {dirs} dir(s) but found no .md files -- are sources correct?',
			{ dirs: health.dirsResolved },
		)
	} else if (health.docsParsed === 0) {
		logger.warn('Found {files} .md file(s) but none had valid frontmatter', {
			files: health.filesScanned,
		})
	}

	logger.debug(
		'Index: {sources} sources, {dirs} dirs, {files} files, {docs} docs',
		{
			sources: health.sources,
			dirs: health.dirsResolved,
			files: health.filesScanned,
			docs: health.docsParsed,
		},
	)

	return { docs, warnings }
}

/**
 * Resolve a potentially-globbed path into concrete directories.
 * Handles patterns like ~/code/* /docs by expanding the wildcard.
 */
function resolveGlob(pattern: string): string[] {
	if (!pattern.includes('*')) {
		return [resolve(pattern)]
	}

	// Split at the first wildcard segment
	const parts = pattern.split('/')
	const wildcardIdx = parts.findIndex((p) => p.includes('*'))
	if (wildcardIdx === -1) return [resolve(pattern)]

	const prefix = parts.slice(0, wildcardIdx).join('/')
	const suffix = parts.slice(wildcardIdx + 1).join('/')
	const wildcardPattern = parts[wildcardIdx]

	// Use Bun.glob to expand the wildcard segment
	const glob = new Bun.Glob(wildcardPattern ?? '*')
	const resolvedPrefix = resolve(prefix)
	const matches: string[] = []

	try {
		for (const match of glob.scanSync({
			cwd: resolvedPrefix,
			onlyFiles: false,
		})) {
			const fullPath = suffix
				? resolve(resolvedPrefix, match, suffix)
				: resolve(resolvedPrefix, match)

			if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
				matches.push(fullPath)
			} else {
				logger.debug('Skipping non-existent path {path}', {
					path: fullPath,
				})
			}
		}
	} catch {
		logger.warn('Failed to scan glob pattern {pattern}', { pattern })
	}

	return matches
}

/**
 * Recursively scan a directory for .md files, respecting IGNORE_DIRS.
 */
function scanDir(dir: string): string[] {
	const files: string[] = []

	try {
		const glob = new Bun.Glob('**/*.md')
		for (const match of glob.scanSync({ cwd: dir })) {
			// Skip files in ignored directories
			const parts = match.split('/')
			if (parts.some((p) => IGNORE_DIRS.has(p))) continue

			files.push(resolve(dir, match))
		}
	} catch {
		logger.warn('Cannot scan directory {dir}', { dir })
	}

	return files
}

/**
 * Parse a single markdown file into a CortexDoc.
 * Returns null for files without frontmatter or with parse errors.
 */
function parseDoc(filePath: string, warnings: string[]): CortexDoc | null {
	// Guard against huge files, symlinks to devices, and non-regular files
	try {
		const stat = statSync(filePath)
		if (!stat.isFile()) return null
		if (stat.size > MAX_FILE_BYTES) {
			logger.warn('Skipping oversized file {path} ({size} bytes)', {
				path: filePath,
				size: stat.size,
			})
			return null
		}
	} catch {
		return null
	}

	let raw: string
	try {
		raw = readFileSync(filePath, 'utf-8')
	} catch {
		logger.warn('Cannot read file {path}', { path: filePath })
		return null
	}

	// Skip files without frontmatter
	if (!raw.startsWith('---')) return null

	let parsed: matter.GrayMatterFile<string>
	try {
		parsed = matter(raw)
	} catch {
		logger.warn('Failed to parse frontmatter in {path}', {
			path: filePath,
		})
		return null
	}

	// Validate frontmatter with schema
	const result = FrontmatterSchema.safeParse(parsed.data)

	if (!result.success) {
		// Warn but still index with raw data
		const issues = result.error.issues.map((i) => i.message).join(', ')
		const warningMsg = `Malformed frontmatter in ${filePath}: ${issues}`
		logger.warn('Malformed frontmatter in {path}: {issues}', {
			path: filePath,
			issues,
		})
		warnings.push(warningMsg)

		// Normalize raw data so runtime types match compile-time types
		const filename = basename(filePath)
		return {
			frontmatter: coerceRawFrontmatter(parsed.data),
			body: parsed.content,
			path: filePath,
			stem: filename.replace(/\.md$/, ''),
		}
	}

	const filename = basename(filePath)
	return {
		frontmatter: result.data,
		body: parsed.content,
		path: filePath,
		stem: filename.replace(/\.md$/, ''),
	}
}

/**
 * Normalize raw frontmatter so runtime types match Frontmatter.
 * Converts Date objects to YYYY-MM-DD strings and ensures tags are string[].
 */
function coerceRawFrontmatter(
	data: Record<string, unknown>,
): CortexDoc['frontmatter'] {
	const result: Record<string, unknown> = { ...data }

	// Coerce Date objects to ISO date strings
	for (const key of ['created', 'updated']) {
		const val = result[key]
		if (val instanceof Date) {
			result[key] = val.toISOString().slice(0, 10)
		} else if (val !== undefined && typeof val !== 'string') {
			result[key] = String(val)
		}
	}

	// Coerce tags to string[]
	if (Array.isArray(result.tags)) {
		result.tags = result.tags.map((t) => String(t))
	}

	// Coerce other known string fields
	for (const key of ['title', 'type', 'project', 'status']) {
		const val = result[key]
		if (val !== undefined && typeof val !== 'string') {
			result[key] = String(val)
		}
	}

	return result as CortexDoc['frontmatter']
}
