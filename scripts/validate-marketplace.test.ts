import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
	detectBumpType,
	isKebabCase,
	isVersionBumpSufficient,
	parseSemver,
	validateCategory,
	validatePluginEntry,
	validateRootFields,
} from './validate-marketplace.ts'

// --- parseSemver ---

describe('parseSemver', () => {
	test('parses valid semver', () => {
		expect(parseSemver('1.0.0')).toEqual({ major: 1, minor: 0, patch: 0 })
		expect(parseSemver('0.0.1')).toEqual({ major: 0, minor: 0, patch: 1 })
		expect(parseSemver('12.34.56')).toEqual({
			major: 12,
			minor: 34,
			patch: 56,
		})
	})

	test('rejects invalid semver', () => {
		expect(parseSemver('1.0')).toBeNull()
		expect(parseSemver('1.0.0-beta')).toBeNull()
		expect(parseSemver('v1.0.0')).toBeNull()
		expect(parseSemver('abc')).toBeNull()
		expect(parseSemver('')).toBeNull()
	})

	test('rejects non-string input', () => {
		expect(parseSemver(123 as unknown as string)).toBeNull()
		expect(parseSemver(null as unknown as string)).toBeNull()
	})
})

// --- isKebabCase ---

describe('isKebabCase', () => {
	test('accepts valid kebab-case', () => {
		expect(isKebabCase('git')).toBe(true)
		expect(isKebabCase('my-plugin')).toBe(true)
		expect(isKebabCase('bun-runner')).toBe(true)
		expect(isKebabCase('a1-b2-c3')).toBe(true)
	})

	test('rejects invalid names', () => {
		expect(isKebabCase('myPlugin')).toBe(false)
		expect(isKebabCase('my_plugin')).toBe(false)
		expect(isKebabCase('MyPlugin')).toBe(false)
		expect(isKebabCase('my plugin')).toBe(false)
		expect(isKebabCase('-leading')).toBe(false)
		expect(isKebabCase('trailing-')).toBe(false)
		expect(isKebabCase('')).toBe(false)
	})
})

// --- validateCategory ---

describe('validateCategory', () => {
	test('accepts valid categories', () => {
		expect(validateCategory('development')).toBe(true)
		expect(validateCategory('productivity')).toBe(true)
		expect(validateCategory('security')).toBe(true)
		expect(validateCategory('learning')).toBe(true)
	})

	test('rejects invalid categories', () => {
		expect(validateCategory('tools')).toBe(false)
		expect(validateCategory('dev')).toBe(false)
		expect(validateCategory('')).toBe(false)
	})
})

// --- validateRootFields ---

describe('validateRootFields', () => {
	const validRoot = {
		name: 'test',
		version: '1.0.0',
		description: 'A test',
		owner: { name: 'Test' },
		plugins: [{ name: 'a' }],
	}

	test('passes with valid root', () => {
		expect(validateRootFields(validRoot)).toEqual([])
	})

	test('fails on non-object', () => {
		expect(validateRootFields('string')).toContainEqual(
			expect.stringContaining('Root must be a JSON object'),
		)
		expect(validateRootFields(null)).toContainEqual(
			expect.stringContaining('Root must be a JSON object'),
		)
	})

	test('fails when name missing', () => {
		const { name: _, ...rest } = validRoot
		const errors = validateRootFields(rest)
		expect(errors.some((e) => e.includes('"name"'))).toBe(true)
	})

	test('fails when version invalid', () => {
		const errors = validateRootFields({ ...validRoot, version: 'bad' })
		expect(errors.some((e) => e.includes('"version"'))).toBe(true)
	})

	test('fails when description missing', () => {
		const { description: _, ...rest } = validRoot
		const errors = validateRootFields(rest)
		expect(errors.some((e) => e.includes('"description"'))).toBe(true)
	})

	test('fails when owner missing name', () => {
		const errors = validateRootFields({ ...validRoot, owner: {} })
		expect(errors.some((e) => e.includes('"owner"'))).toBe(true)
	})

	test('fails when plugins empty', () => {
		const errors = validateRootFields({ ...validRoot, plugins: [] })
		expect(errors.some((e) => e.includes('"plugins"'))).toBe(true)
	})
})

// --- validatePluginEntry ---

describe('validatePluginEntry', () => {
	const validPlugin = {
		name: 'my-plugin',
		source: './plugins/my-plugin',
		description: 'Does things',
		category: 'development',
		tags: ['test'],
	}

	test('passes with valid entry', () => {
		expect(validatePluginEntry(validPlugin, 0)).toEqual([])
	})

	test('fails on non-object', () => {
		expect(validatePluginEntry('not-object', 0).length).toBeGreaterThan(0)
	})

	test('fails when name missing', () => {
		const { name: _, ...rest } = validPlugin
		const errors = validatePluginEntry(rest, 0)
		expect(errors.some((e) => e.includes('"name"'))).toBe(true)
	})

	test('fails when source missing', () => {
		const { source: _, ...rest } = validPlugin
		const errors = validatePluginEntry(rest, 0)
		expect(errors.some((e) => e.includes('"source"'))).toBe(true)
	})

	test('fails when description missing', () => {
		const { description: _, ...rest } = validPlugin
		const errors = validatePluginEntry(rest, 0)
		expect(errors.some((e) => e.includes('"description"'))).toBe(true)
	})

	test('fails when category invalid', () => {
		const errors = validatePluginEntry({ ...validPlugin, category: 'invalid' }, 0)
		expect(errors.some((e) => e.includes('invalid category'))).toBe(true)
	})

	test('fails when tags empty', () => {
		const errors = validatePluginEntry({ ...validPlugin, tags: [] }, 0)
		expect(errors.some((e) => e.includes('"tags"'))).toBe(true)
	})

	test('fails when name is not kebab-case', () => {
		const errors = validatePluginEntry(
			{ ...validPlugin, name: 'myPlugin', source: './plugins/myPlugin' },
			0,
		)
		expect(errors.some((e) => e.includes('kebab-case'))).toBe(true)
	})

	test('fails when name does not match source basename', () => {
		const errors = validatePluginEntry(
			{ ...validPlugin, name: 'my-plugin', source: './plugins/other' },
			0,
		)
		expect(errors.some((e) => e.includes('match source directory'))).toBe(true)
	})
})

// --- detectBumpType ---

describe('detectBumpType', () => {
	const pluginA = {
		name: 'a',
		source: './plugins/a',
		description: 'A',
		category: 'development',
		tags: ['test'],
	}
	const pluginB = {
		name: 'b',
		source: './plugins/b',
		description: 'B',
		category: 'productivity',
		tags: ['test'],
	}

	test('returns null when no changes', () => {
		expect(detectBumpType([pluginA], [pluginA])).toBeNull()
	})

	test('returns minor for additions only', () => {
		expect(detectBumpType([pluginA], [pluginA, pluginB])).toBe('minor')
	})

	test('returns major for removals only', () => {
		expect(detectBumpType([pluginA, pluginB], [pluginA])).toBe('major')
	})

	test('returns patch for metadata changes', () => {
		const modified = { ...pluginA, description: 'Updated A' }
		expect(detectBumpType([pluginA], [modified])).toBe('patch')
	})

	test('returns major when both add and remove (highest wins)', () => {
		expect(detectBumpType([pluginA], [pluginB])).toBe('major')
	})
})

// --- isVersionBumpSufficient ---

describe('isVersionBumpSufficient', () => {
	test('exact major bump passes for major', () => {
		expect(isVersionBumpSufficient('1.0.0', '2.0.0', 'major')).toBe(true)
	})

	test('minor bump fails for major', () => {
		expect(isVersionBumpSufficient('1.0.0', '1.1.0', 'major')).toBe(false)
	})

	test('exact minor bump passes for minor', () => {
		expect(isVersionBumpSufficient('1.0.0', '1.1.0', 'minor')).toBe(true)
	})

	test('major bump passes for minor (higher-than-required)', () => {
		expect(isVersionBumpSufficient('1.0.0', '2.0.0', 'minor')).toBe(true)
	})

	test('patch bump fails for minor', () => {
		expect(isVersionBumpSufficient('1.0.0', '1.0.1', 'minor')).toBe(false)
	})

	test('exact patch bump passes for patch', () => {
		expect(isVersionBumpSufficient('1.0.0', '1.0.1', 'patch')).toBe(true)
	})

	test('same version fails', () => {
		expect(isVersionBumpSufficient('1.0.0', '1.0.0', 'patch')).toBe(false)
	})

	test('lower version fails', () => {
		expect(isVersionBumpSufficient('2.0.0', '1.0.0', 'patch')).toBe(false)
	})

	test('invalid semver returns false', () => {
		expect(isVersionBumpSufficient('bad', '1.0.0', 'patch')).toBe(false)
		expect(isVersionBumpSufficient('1.0.0', 'bad', 'patch')).toBe(false)
	})
})

// --- Integration tests: --check-bump subprocess ---

const SCRIPT_PATH = resolve(import.meta.dir, 'validate-marketplace.ts')

/** Generate a minimal valid marketplace.json object. */
function makeMarketplace(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		name: 'test-marketplace',
		version: '1.0.0',
		description: 'Test marketplace',
		owner: { name: 'Test' },
		plugins: [],
		...overrides,
	}
}

/** Create a plugin stub directory with .claude-plugin/plugin.json. */
function stubPlugin(repoDir: string, name: string): void {
	const pluginDir = join(repoDir, 'plugins', name, '.claude-plugin')
	mkdirSync(pluginDir, { recursive: true })
	writeFileSync(join(pluginDir, 'plugin.json'), JSON.stringify({ name }))
}

/** Run a git command in the given directory. */
async function git(
	cwd: string,
	...args: string[]
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const proc = Bun.spawn(['git', ...args], {
		cwd,
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const exitCode = await proc.exited
	const stdout = await new Response(proc.stdout).text()
	const stderr = await new Response(proc.stderr).text()
	return { exitCode, stdout, stderr }
}

/** Run the validation script as a subprocess. */
async function runScript(
	cwd: string,
	args: string[] = [],
	env: Record<string, string> = {},
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const proc = Bun.spawn(['bun', 'run', SCRIPT_PATH, ...args], {
		cwd,
		stdout: 'pipe',
		stderr: 'pipe',
		env: { ...process.env, ...env },
	})
	const exitCode = await proc.exited
	const stdout = await new Response(proc.stdout).text()
	const stderr = await new Response(proc.stderr).text()
	return { exitCode, stdout, stderr }
}

describe('--check-bump integration', () => {
	let tmpDir: string

	beforeEach(async () => {
		tmpDir = mkdtempSync(join(tmpdir(), 'validate-marketplace-test-'))
		// Initialize a git repo with user config for commits
		await git(tmpDir, 'init', '-b', 'main')
		await git(tmpDir, 'config', 'user.email', 'test@test.com')
		await git(tmpDir, 'config', 'user.name', 'Test')
	})

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true })
	})

	test('passes: minor bump for plugin addition', async () => {
		// Baseline: v1.0.0 with one plugin on main
		const pluginA = {
			name: 'alpha',
			source: './plugins/alpha',
			description: 'Alpha plugin',
			category: 'development',
			tags: ['test'],
		}
		const baseline = makeMarketplace({
			version: '1.0.0',
			plugins: [pluginA],
		})
		stubPlugin(tmpDir, 'alpha')
		mkdirSync(join(tmpDir, '.claude-plugin'), { recursive: true })
		writeFileSync(
			join(tmpDir, '.claude-plugin', 'marketplace.json'),
			JSON.stringify(baseline, null, '\t'),
		)
		await git(tmpDir, 'add', '-A')
		await git(tmpDir, 'commit', '-m', 'initial')

		// Working tree: add second plugin, bump to v1.1.0
		const pluginB = {
			name: 'bravo',
			source: './plugins/bravo',
			description: 'Bravo plugin',
			category: 'productivity',
			tags: ['test'],
		}
		stubPlugin(tmpDir, 'bravo')
		const updated = makeMarketplace({
			version: '1.1.0',
			plugins: [pluginA, pluginB],
		})
		writeFileSync(
			join(tmpDir, '.claude-plugin', 'marketplace.json'),
			JSON.stringify(updated, null, '\t'),
		)

		const result = await runScript(tmpDir, ['--check-bump'], {
			GITHUB_BASE_REF: 'main',
		})

		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain('[PASS]')
		expect(result.stdout).toContain('1.0.0 -> 1.1.0')
	})

	test('fails: no bump for plugin addition', async () => {
		// Baseline: v1.0.0 with one plugin
		const pluginA = {
			name: 'alpha',
			source: './plugins/alpha',
			description: 'Alpha plugin',
			category: 'development',
			tags: ['test'],
		}
		const baseline = makeMarketplace({
			version: '1.0.0',
			plugins: [pluginA],
		})
		stubPlugin(tmpDir, 'alpha')
		mkdirSync(join(tmpDir, '.claude-plugin'), { recursive: true })
		writeFileSync(
			join(tmpDir, '.claude-plugin', 'marketplace.json'),
			JSON.stringify(baseline, null, '\t'),
		)
		await git(tmpDir, 'add', '-A')
		await git(tmpDir, 'commit', '-m', 'initial')

		// Working tree: add second plugin but keep v1.0.0
		const pluginB = {
			name: 'bravo',
			source: './plugins/bravo',
			description: 'Bravo plugin',
			category: 'productivity',
			tags: ['test'],
		}
		stubPlugin(tmpDir, 'bravo')
		const updated = makeMarketplace({
			version: '1.0.0',
			plugins: [pluginA, pluginB],
		})
		writeFileSync(
			join(tmpDir, '.claude-plugin', 'marketplace.json'),
			JSON.stringify(updated, null, '\t'),
		)

		const result = await runScript(tmpDir, ['--check-bump'], {
			GITHUB_BASE_REF: 'main',
		})

		expect(result.exitCode).toBe(1)
		expect(result.stderr).toContain('[FAIL]')
		expect(result.stderr).toContain('minor')
	})

	test('passes: major bump for plugin removal', async () => {
		// Baseline: v1.0.0 with two plugins
		const pluginA = {
			name: 'alpha',
			source: './plugins/alpha',
			description: 'Alpha plugin',
			category: 'development',
			tags: ['test'],
		}
		const pluginB = {
			name: 'bravo',
			source: './plugins/bravo',
			description: 'Bravo plugin',
			category: 'productivity',
			tags: ['test'],
		}
		const baseline = makeMarketplace({
			version: '1.0.0',
			plugins: [pluginA, pluginB],
		})
		stubPlugin(tmpDir, 'alpha')
		stubPlugin(tmpDir, 'bravo')
		mkdirSync(join(tmpDir, '.claude-plugin'), { recursive: true })
		writeFileSync(
			join(tmpDir, '.claude-plugin', 'marketplace.json'),
			JSON.stringify(baseline, null, '\t'),
		)
		await git(tmpDir, 'add', '-A')
		await git(tmpDir, 'commit', '-m', 'initial')

		// Working tree: remove bravo, bump to v2.0.0
		const updated = makeMarketplace({
			version: '2.0.0',
			plugins: [pluginA],
		})
		writeFileSync(
			join(tmpDir, '.claude-plugin', 'marketplace.json'),
			JSON.stringify(updated, null, '\t'),
		)

		const result = await runScript(tmpDir, ['--check-bump'], {
			GITHUB_BASE_REF: 'main',
		})

		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain('[PASS]')
	})

	test('passes: no changes, no bump needed', async () => {
		// Same plugins on main and working tree
		const pluginA = {
			name: 'alpha',
			source: './plugins/alpha',
			description: 'Alpha plugin',
			category: 'development',
			tags: ['test'],
		}
		const marketplace = makeMarketplace({
			version: '1.0.0',
			plugins: [pluginA],
		})
		stubPlugin(tmpDir, 'alpha')
		mkdirSync(join(tmpDir, '.claude-plugin'), { recursive: true })
		writeFileSync(
			join(tmpDir, '.claude-plugin', 'marketplace.json'),
			JSON.stringify(marketplace, null, '\t'),
		)
		await git(tmpDir, 'add', '-A')
		await git(tmpDir, 'commit', '-m', 'initial')

		const result = await runScript(tmpDir, ['--check-bump'], {
			GITHUB_BASE_REF: 'main',
		})

		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain('[PASS]')
		expect(result.stdout).toContain('no version bump required')
	})

	test('graceful skip: no base ref available', async () => {
		// No initial commit, so main ref does not resolve
		const pluginA = {
			name: 'alpha',
			source: './plugins/alpha',
			description: 'Alpha plugin',
			category: 'development',
			tags: ['test'],
		}
		const marketplace = makeMarketplace({
			version: '1.0.0',
			plugins: [pluginA],
		})
		stubPlugin(tmpDir, 'alpha')
		mkdirSync(join(tmpDir, '.claude-plugin'), { recursive: true })
		writeFileSync(
			join(tmpDir, '.claude-plugin', 'marketplace.json'),
			JSON.stringify(marketplace, null, '\t'),
		)

		// Don't commit - so there's no main ref to resolve
		const result = await runScript(tmpDir, ['--check-bump'], {
			GITHUB_BASE_REF: 'nonexistent-branch',
		})

		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain('[WARN]')
	})
})
