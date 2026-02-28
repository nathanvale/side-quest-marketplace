/**
 * Cortex SessionStart bootstrap hook.
 *
 * Runs on every session start and after /clear to:
 * 1. Ensure ~/.config/cortex/ (or $XDG_CONFIG_HOME/cortex/) exists
 * 2. Create config.yaml with sensible defaults on first run
 * 3. Resolve the docs_path from config and create subdirectories
 * 4. Inject the resolved path into Claude's context via stdout
 *
 * Design decisions:
 * - All fs operations are sync (fire-and-exit script, ~15ms total)
 * - Regex for YAML parsing (single-field config, no library needed)
 * - Atomic config creation with { flag: 'wx' } (no TOCTOU race)
 * - Self-contained: utility functions are duplicated here (~15 lines)
 *   rather than imported from ../../src/config.ts because this plugin
 *   may be distributed independently via the marketplace. Importing
 *   would create a fragile cross-boundary dependency.
 *
 * @module
 */

// Self-destruct timer MUST be the first executable line.
// .unref() lets the process exit naturally when work completes
// instead of waiting the full timeout duration.
const selfDestruct = setTimeout(() => {
	process.stderr.write('cortex bootstrap: timed out\n')
	process.exit(1)
}, 8_000)
selfDestruct.unref()

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve, sep } from 'node:path'

// ---------------------------------------------------------------------------
// Utility functions (self-contained -- see module JSDoc for rationale)
// ---------------------------------------------------------------------------

/**
 * Expand a leading tilde to the user's home directory.
 * Uses os.homedir() which is more robust than process.env.HOME
 * in non-interactive contexts (e.g., launchd, cron).
 */
function expandTilde(p: string): string {
	if (p === '~') return homedir()
	if (p.startsWith('~/')) return resolve(homedir(), p.slice(2))
	return p
}

/**
 * Validate a docs_path value from config.yaml.
 *
 * Guards against prompt injection via crafted config values
 * by enforcing: single-line, path-safe characters only, and
 * the resolved path must be under $HOME.
 *
 * @returns The resolved absolute path, or null if validation fails.
 */
function validateDocsPath(raw: string): string | null {
	// Must be single-line (block scalars could inject prompt content)
	if (raw.includes('\n') || raw.includes('\r')) return null

	// Must contain only path-safe characters:
	// ~/path, /absolute/path, letters, digits, dots, hyphens,
	// underscores, spaces, forward slashes
	if (!/^~[/a-zA-Z0-9._\- ]*$/.test(raw) && !/^[/a-zA-Z0-9._\- ]+$/.test(raw)) {
		return null
	}

	// Resolve tilde and normalize traversal attempts
	const resolved = resolve(expandTilde(raw))
	const home = homedir()

	// Must resolve to a path under $HOME (or $HOME itself)
	if (!resolved.startsWith(home + sep) && resolved !== home) return null

	return resolved
}

// ---------------------------------------------------------------------------
// Default config template
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = `# Cortex knowledge system configuration
# Generated automatically on first use

# Where to store global knowledge documents
# Change this to any path: ~/Dropbox/cortex, ~/code/my-knowledge/docs, etc.
docs_path: ~/.config/cortex/docs
`

const DEFAULT_DOCS_PATH = '~/.config/cortex/docs'

/** Subdirectories created under the docs root */
const DOCS_SUBDIRS = [
	'research',
	'brainstorms',
	'plans',
	'decisions',
	'meetings',
	'diagrams',
] as const

// ---------------------------------------------------------------------------
// Main bootstrap logic
// ---------------------------------------------------------------------------

/**
 * Resolve the Cortex config directory path.
 * Respects $XDG_CONFIG_HOME if set and valid (must be absolute).
 * Falls back to ~/.config/cortex/.
 */
function resolveConfigDir(): string {
	const xdg = process.env.XDG_CONFIG_HOME

	if (xdg) {
		// XDG spec requires an absolute path
		if (!xdg.startsWith('/')) {
			process.stderr.write(
				`[cortex] XDG_CONFIG_HOME is not absolute ("${xdg}"), using default\n`,
			)
			return resolve(homedir(), '.config', 'cortex')
		}
		return resolve(xdg, 'cortex')
	}

	return resolve(homedir(), '.config', 'cortex')
}

/** Bootstrap the Cortex config directory and docs path. */
function bootstrap(): void {
	const configDir = resolveConfigDir()
	const configPath = resolve(configDir, 'config.yaml')

	// Ensure config directory exists
	mkdirSync(configDir, { recursive: true, mode: 0o700 })

	// Create config.yaml atomically on first run.
	// { flag: 'wx' } = write + exclusive -- fails with EEXIST if
	// the file already exists, eliminating TOCTOU race conditions.
	try {
		writeFileSync(configPath, DEFAULT_CONFIG, {
			flag: 'wx',
			mode: 0o600,
		})
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
		// File already exists -- expected on subsequent sessions
	}

	// Read config and extract docs_path via regex.
	// Regex is intentional: single-field config doesn't justify a YAML
	// library (~20ms savings). Upgrade to Bun.YAML.parse when config
	// grows beyond docs_path.
	let rawDocsPath = DEFAULT_DOCS_PATH
	let configMalformed = false

	try {
		const configContent = readFileSync(configPath, 'utf-8')
		const match = configContent.match(/^docs_path:\s*(.+)$/m)
		if (match?.[1]) {
			rawDocsPath = match[1].trim()
		}
	} catch {
		// If we can't read a file we just created, something is very
		// wrong -- but still fall back gracefully.
		process.stderr.write(
			`[cortex] Could not read ${configPath}, using default docs path\n`,
		)
	}

	// Validate the docs_path value
	let resolvedDocsPath = validateDocsPath(rawDocsPath)

	if (!resolvedDocsPath) {
		configMalformed = true
		// stderr for diagnostics
		process.stderr.write(
			'[cortex] Invalid docs_path in config.yaml, using default\n',
		)
		resolvedDocsPath = resolve(expandTilde(DEFAULT_DOCS_PATH))
	}

	// Create docs root and all subdirectories
	for (const subdir of DOCS_SUBDIRS) {
		mkdirSync(resolve(resolvedDocsPath, subdir), {
			recursive: true,
			mode: 0o700,
		})
	}

	// Output to stdout -- this gets injected into Claude's context.
	// Backtick-wrapped key-value format survives compaction better
	// than prose.
	const lines: string[] = [
		'## Cortex Global Docs',
		'',
		`**CORTEX_DOCS_PATH:** \`${resolvedDocsPath}\``,
		`**CORTEX_CONFIG:** \`${configPath}\``,
	]

	if (configMalformed) {
		lines.push(
			'',
			'Note: config.yaml has an invalid docs_path. Using default.' +
				' Edit the config file to fix.',
		)
	}

	lines.push(
		'',
		'When saving docs with no project context,' +
			' use the global docs path above.',
		'When searching for existing knowledge,' +
			' also search the global docs path.',
		'',
		'### Agent Capabilities',
		'- To change the docs location, edit `docs_path` in the config' +
			' file above. Changes take effect on the next session.',
		'- To list existing docs, search within the global docs path.',
		'- Supported subdirectories: ' + DOCS_SUBDIRS.join(', ') + '.',
	)

	console.log(lines.join('\n'))
}

bootstrap()
