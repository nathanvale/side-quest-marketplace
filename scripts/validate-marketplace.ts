#!/usr/bin/env bun
/**
 * Validates .claude-plugin/marketplace.json structure and version bumps.
 *
 * Usage:
 *   bun run validate:marketplace              # Structure checks (1-8)
 *   bun run validate:marketplace --check-bump # Structure + version bump (1-9)
 *
 * Flags:
 *   --check-bump   Also verify marketplace version was bumped appropriately
 *   --help, -h     Show usage
 */

import { existsSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'

// --- Types ---

interface Plugin {
	name: string
	source: string
	description: string
	category: string
	tags: string[]
}

interface Marketplace {
	name: string
	version: string
	description: string
	owner: { name: string }
	plugins: Plugin[]
}

interface Semver {
	major: number
	minor: number
	patch: number
}

// --- Constants ---

const MARKETPLACE_PATH = '.claude-plugin/marketplace.json'
const VALID_CATEGORIES = ['development', 'productivity', 'security', 'learning']
const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/

// --- Pure validation functions (exported for testing) ---

/** Parse a semver string into components. Returns null if invalid. */
export function parseSemver(version: string): Semver | null {
	if (typeof version !== 'string') return null
	const match = version.match(SEMVER_RE)
	if (!match) return null
	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
	}
}

/** Check if a string is valid kebab-case. */
export function isKebabCase(name: string): boolean {
	return KEBAB_CASE_RE.test(name)
}

/** Check if a category value is valid. */
export function validateCategory(category: string): boolean {
	return VALID_CATEGORIES.includes(category)
}

/** Validate root-level fields of marketplace.json. Returns error messages. */
export function validateRootFields(data: unknown): string[] {
	const errors: string[] = []
	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
		errors.push('Root must be a JSON object')
		return errors
	}

	const obj = data as Record<string, unknown>

	if (typeof obj.name !== 'string' || obj.name.length === 0) {
		errors.push(
			'Missing or invalid root field "name" (must be non-empty string)',
		)
	}
	if (typeof obj.version !== 'string' || !parseSemver(obj.version as string)) {
		errors.push(
			'Missing or invalid root field "version" (must be valid semver, e.g. "1.0.0")',
		)
	}
	if (typeof obj.description !== 'string' || obj.description.length === 0) {
		errors.push(
			'Missing or invalid root field "description" (must be non-empty string)',
		)
	}
	if (
		typeof obj.owner !== 'object' ||
		obj.owner === null ||
		typeof (obj.owner as Record<string, unknown>).name !== 'string'
	) {
		errors.push(
			'Missing or invalid root field "owner" (must be object with "name" string)',
		)
	}
	if (!Array.isArray(obj.plugins) || obj.plugins.length === 0) {
		errors.push(
			'Missing or invalid root field "plugins" (must be non-empty array)',
		)
	}

	return errors
}

/** Validate a single plugin entry. Returns error messages. */
export function validatePluginEntry(entry: unknown, index: number): string[] {
	const errors: string[] = []
	const prefix = `Plugin [${index}]`

	if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
		errors.push(`${prefix}: must be a JSON object`)
		return errors
	}

	const plugin = entry as Record<string, unknown>

	// name
	if (typeof plugin.name !== 'string' || plugin.name.length === 0) {
		errors.push(`${prefix}: missing required field "name"`)
	} else {
		const name = plugin.name as string
		if (!isKebabCase(name)) {
			errors.push(
				`${prefix} "${name}": name must be kebab-case (e.g. "my-plugin")`,
			)
		}
	}

	// source
	if (typeof plugin.source !== 'string' || plugin.source.length === 0) {
		errors.push(`${prefix}: missing required field "source"`)
	}

	// description
	if (
		typeof plugin.description !== 'string' ||
		plugin.description.length === 0
	) {
		errors.push(
			`${prefix}${plugin.name ? ` "${plugin.name}"` : ''}: missing required field "description"`,
		)
	}

	// category
	if (typeof plugin.category !== 'string' || plugin.category.length === 0) {
		errors.push(
			`${prefix}${plugin.name ? ` "${plugin.name}"` : ''}: missing required field "category"`,
		)
	} else if (!validateCategory(plugin.category as string)) {
		errors.push(
			`${prefix}${plugin.name ? ` "${plugin.name}"` : ''}: invalid category "${plugin.category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`,
		)
	}

	// tags
	if (!Array.isArray(plugin.tags) || plugin.tags.length === 0) {
		errors.push(
			`${prefix}${plugin.name ? ` "${plugin.name}"` : ''}: missing required field "tags" (must be non-empty array of strings)`,
		)
	} else if (!plugin.tags.every((t: unknown) => typeof t === 'string')) {
		errors.push(
			`${prefix}${plugin.name ? ` "${plugin.name}"` : ''}: "tags" must contain only strings`,
		)
	}

	// name matches source directory basename
	if (
		typeof plugin.name === 'string' &&
		typeof plugin.source === 'string' &&
		plugin.name.length > 0 &&
		plugin.source.length > 0
	) {
		const sourceParts = plugin.source.replace(/\/$/, '').split('/')
		const dirName = sourceParts[sourceParts.length - 1]
		if (dirName !== plugin.name) {
			errors.push(
				`${prefix} "${plugin.name}": name must match source directory basename ("${dirName}")`,
			)
		}
	}

	return errors
}

/**
 * Detect the required version bump type based on plugin changes.
 * Returns null if no plugin changes detected.
 */
export function detectBumpType(
	oldPlugins: Plugin[],
	newPlugins: Plugin[],
): 'major' | 'minor' | 'patch' | null {
	const oldNames = new Set(oldPlugins.map((p) => p.name))
	const newNames = new Set(newPlugins.map((p) => p.name))

	// Check for removals (major)
	const hasRemovals = [...oldNames].some((name) => !newNames.has(name))

	// Check for additions (minor)
	const hasAdditions = [...newNames].some((name) => !oldNames.has(name))

	// Check for metadata changes (patch)
	let hasMetadataChanges = false
	for (const newPlugin of newPlugins) {
		const oldPlugin = oldPlugins.find((p) => p.name === newPlugin.name)
		if (oldPlugin) {
			if (
				oldPlugin.description !== newPlugin.description ||
				oldPlugin.category !== newPlugin.category ||
				oldPlugin.source !== newPlugin.source ||
				JSON.stringify(oldPlugin.tags) !== JSON.stringify(newPlugin.tags)
			) {
				hasMetadataChanges = true
			}
		}
	}

	// Highest wins
	if (hasRemovals) return 'major'
	if (hasAdditions) return 'minor'
	if (hasMetadataChanges) return 'patch'
	return null
}

/** Check if a version bump is sufficient for the required bump type. */
export function isVersionBumpSufficient(
	oldVersion: string,
	newVersion: string,
	requiredBump: 'major' | 'minor' | 'patch',
): boolean {
	const oldSemver = parseSemver(oldVersion)
	const newSemver = parseSemver(newVersion)
	if (!oldSemver || !newSemver) return false

	// New version must be greater than old
	if (
		newSemver.major < oldSemver.major ||
		(newSemver.major === oldSemver.major &&
			newSemver.minor < oldSemver.minor) ||
		(newSemver.major === oldSemver.major &&
			newSemver.minor === oldSemver.minor &&
			newSemver.patch <= oldSemver.patch)
	) {
		return false
	}

	// Check bump level: higher-than-required is always ok
	switch (requiredBump) {
		case 'major':
			return newSemver.major > oldSemver.major
		case 'minor':
			return (
				newSemver.major > oldSemver.major || newSemver.minor > oldSemver.minor
			)
		case 'patch':
			return true // Any increase is sufficient for patch
	}
}

// --- CLI ---

function printUsage(): void {
	console.log(`Usage:
  bun run validate:marketplace              # Structure checks
  bun run validate:marketplace --check-bump # Structure + version bump check

Flags:
  --check-bump   Verify marketplace version was bumped for plugin changes
  --help, -h     Show this help`)
}

/** Run all validation checks. Returns exit code (0 = pass, 1 = fail). */
async function main(): Promise<number> {
	const { values: flags } = parseArgs({
		options: {
			'check-bump': { type: 'boolean', default: false },
			help: { type: 'boolean', short: 'h', default: false },
		},
		strict: true,
		allowPositionals: false,
	})

	if (flags.help) {
		printUsage()
		return 0
	}

	let hasErrors = false
	const fail = (msg: string) => {
		console.error(`[FAIL] ${msg}`)
		hasErrors = true
	}
	const pass = (msg: string) => {
		console.log(`[PASS] ${msg}`)
	}

	// 1. File exists
	const marketplacePath = resolve(process.cwd(), MARKETPLACE_PATH)
	if (!existsSync(marketplacePath)) {
		fail(`${MARKETPLACE_PATH} not found`)
		return 1
	}
	pass('File exists')

	// 2. JSON syntax
	let data: unknown
	try {
		const raw = await Bun.file(marketplacePath).text()
		data = JSON.parse(raw)
	} catch (e) {
		fail(`Invalid JSON: ${(e as Error).message}`)
		return 1
	}
	pass('JSON syntax valid')

	// 3. Root fields
	const rootErrors = validateRootFields(data)
	if (rootErrors.length > 0) {
		for (const err of rootErrors) fail(err)
		return 1
	}
	pass('Root fields present')

	const marketplace = data as Marketplace
	const plugins = marketplace.plugins

	// 4-6. Plugin entries
	for (let i = 0; i < plugins.length; i++) {
		const pluginErrors = validatePluginEntry(plugins[i], i)
		for (const err of pluginErrors) fail(err)
	}
	if (!hasErrors) pass('Plugin entries valid')

	// 7. Source paths resolve to directories with plugin.json, no traversal
	const repoRoot = process.cwd().replace(/[\\/]+$/, '')
	const repoRootWithSep = repoRoot + sep
	for (const plugin of plugins) {
		if (typeof plugin.source !== 'string' || plugin.source.length === 0) {
			// validatePluginEntry already reported this
			continue
		}
		const sourcePath = resolve(repoRoot, plugin.source)

		// Path traversal check (segment-aware to prevent prefix attacks)
		if (!sourcePath.startsWith(repoRootWithSep)) {
			fail(`Plugin "${plugin.name}": source path escapes repo root`)
			continue
		}

		const pluginJson = resolve(sourcePath, '.claude-plugin/plugin.json')
		if (!existsSync(pluginJson)) {
			fail(
				`Plugin "${plugin.name}": source "${plugin.source}" missing .claude-plugin/plugin.json`,
			)
		}
	}
	if (!hasErrors) pass('Source paths valid')

	// 8. No duplicate names
	const names = plugins.map((p: Plugin) => p.name)
	const dupes = names.filter((n: string, i: number) => names.indexOf(n) !== i)
	if (dupes.length > 0) {
		fail(`Duplicate plugin names: ${[...new Set(dupes)].join(', ')}`)
	} else {
		pass('No duplicate names')
	}

	if (hasErrors) return 1

	// 9. Version bump check (optional)
	if (flags['check-bump']) {
		try {
			// Try multiple refs: CI provides GITHUB_BASE_REF, fall back to origin/main, then local main
			const refsToTry = [
				process.env.GITHUB_BASE_REF
					? `origin/${process.env.GITHUB_BASE_REF}`
					: null,
				'origin/main',
				'main',
			].filter(Boolean) as string[]

			let oldRaw: string | null = null
			for (const ref of refsToTry) {
				const proc = Bun.spawn(['git', 'show', `${ref}:${MARKETPLACE_PATH}`], {
					stdout: 'pipe',
					stderr: 'pipe',
				})
				const exitCode = await proc.exited
				if (exitCode === 0) {
					oldRaw = await new Response(proc.stdout).text()
					break
				}
			}

			if (!oldRaw) {
				console.log(
					'[WARN] No base branch marketplace.json found, skipping version bump check',
				)
				return 0
			}
			const oldData = JSON.parse(oldRaw) as Marketplace
			const oldPlugins = oldData.plugins as Plugin[]

			const requiredBump = detectBumpType(oldPlugins, plugins)

			if (requiredBump === null) {
				pass('No plugin changes detected, no version bump required')
			} else {
				const sufficient = isVersionBumpSufficient(
					oldData.version,
					marketplace.version,
					requiredBump,
				)
				if (sufficient) {
					pass(
						`Version bump ${oldData.version} -> ${marketplace.version} (required: ${requiredBump})`,
					)
				} else {
					fail(
						`Plugin changes require a ${requiredBump} version bump. Current: ${oldData.version} -> ${marketplace.version}`,
					)
				}
			}
		} catch (e) {
			console.log(
				`[WARN] Could not check version bump: ${(e as Error).message}`,
			)
		}
	}

	if (hasErrors) return 1

	console.log('\nAll checks passed.')
	return 0
}

// Only run CLI when executed directly (not when imported by tests)
if (import.meta.main) {
	const exitCode = await main()
	process.exit(exitCode)
}
