import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getLogger } from '@logtape/logtape'
import matter from 'gray-matter'
import { z } from 'zod'

const logger = getLogger(['cortex', 'config'])

const SourceSchema = z.object({
	path: z.string(),
	scope: z.enum(['global', 'project']),
})

const ConfigSchema = z.object({
	sources: z.array(SourceSchema),
	viewer: z.union([z.string(), z.array(z.string())]).optional(),
})

export type CortexConfig = z.infer<typeof ConfigSchema>
export type Source = z.infer<typeof SourceSchema>

/**
 * Resolve the config file path. Looks for config.yaml in the
 * cortex repo root (where the CLI is installed).
 */
function resolveConfigPath(): string {
	// Config lives alongside the CLI entry point's repo root
	const cortexRoot =
		process.env.CORTEX_ROOT ?? resolve(import.meta.dirname, '..')
	return resolve(cortexRoot, 'config.yaml')
}

/**
 * Load and validate config.yaml.
 * Throws with a descriptive error if the file is missing or invalid.
 */
export function loadConfig(): CortexConfig {
	const configPath = resolveConfigPath()
	logger.debug('Loading config from {path}', { path: configPath })

	let raw: string
	try {
		raw = readFileSync(configPath, 'utf-8')
	} catch {
		throw new ConfigError(`Config file not found: ${configPath}`, 'E_CONFIG')
	}

	// Parse YAML -- gray-matter can do this but we'll use a simple approach
	// since config.yaml is trivial YAML
	const parsed = parseSimpleYaml(raw)
	const result = ConfigSchema.safeParse(parsed)

	if (!result.success) {
		const issues = result.error.issues
			.map((i) => `  ${i.path.join('.')}: ${i.message}`)
			.join('\n')
		throw new ConfigError(`Invalid config:\n${issues}`, 'E_CONFIG')
	}

	logger.debug('Config loaded with {count} sources', {
		count: result.data.sources.length,
	})

	return result.data
}

/** Expand ~ to home directory in a path. Throws if HOME is unset. */
export function expandHome(p: string): string {
	if (p.startsWith('~/') || p === '~') {
		const home = process.env.HOME
		if (!home) {
			throw new ConfigError(
				'Cannot expand ~ in path: HOME environment variable is not set',
				'E_CONFIG',
			)
		}
		return p.replace('~', home)
	}
	return p
}

/**
 * Minimal YAML parser for our simple config format.
 * Wraps raw YAML in frontmatter delimiters so gray-matter can parse it.
 */
function parseSimpleYaml(raw: string): Record<string, unknown> {
	const wrapped = `---\n${raw}\n---\n`
	const result = matter(wrapped)
	return result.data
}

/** Config-specific error with error code for agent hints */
export class ConfigError extends Error {
	code: string
	constructor(message: string, code: string) {
		super(message)
		this.name = 'ConfigError'
		this.code = code
	}
}
