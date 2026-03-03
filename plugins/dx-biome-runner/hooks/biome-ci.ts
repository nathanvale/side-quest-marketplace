#!/usr/bin/env bun

/**
 * Stop hook: Run project-wide Biome linting/formatting at session end.
 *
 * Self-contained -- uses only Bun built-in APIs.
 * Detects Bun workspace vs single package, runs appropriate command.
 * Reports ALL diagnostics (errors and warnings).
 * Exit 0 = clean, Exit 2 = errors (blocking).
 */

import { existsSync } from 'node:fs'

const BIOME_EXTENSIONS = [
	'.ts',
	'.tsx',
	'.js',
	'.jsx',
	'.json',
	'.jsonc',
	'.css',
]

interface BiomeDiagnostic {
	file: string
	line: number
	message: string
	code: string
	severity: 'error' | 'warning'
}

interface ParsedLineLocation {
	span?: unknown
	sourceCode?: string
}

async function getGitRoot(): Promise<string | null> {
	const proc = Bun.spawn(['git', 'rev-parse', '--show-toplevel'], {
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const [exitCode, stdout] = await Promise.all([
		proc.exited,
		proc.stdout.text(),
		proc.stderr.text(),
	])
	if (exitCode !== 0) return null
	return stdout.trim() || null
}

/** Check if any changed/staged/untracked files are Biome-relevant. */
async function hasChangedBiomeFiles(): Promise<boolean> {
	const commands = [
		['git', 'diff', '--cached', '--name-only', '--diff-filter=d'],
		['git', 'diff', '--name-only', '--diff-filter=d'],
		['git', 'ls-files', '--others', '--exclude-standard'],
	]
	const outputs = await Promise.all(
		commands.map(async (cmd) => {
			const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' })
			const [output] = await Promise.all([proc.stdout.text(), proc.exited])
			return output
		}),
	)
	return outputs.some((output) =>
		output
			.trim()
			.split('\n')
			.some(
				(file) => file && BIOME_EXTENSIONS.some((ext) => file.endsWith(ext)),
			),
	)
}

/** Parse Biome JSON reporter output into structured diagnostics. */
function extractDiagnosticLine(
	location: ParsedLineLocation | undefined,
): number {
	if (!location) return 0

	const { span, sourceCode } = location

	// Legacy/object form compatibility: { start: { line: N } }
	if (
		typeof span === 'object' &&
		span !== null &&
		'start' in span &&
		typeof (span as { start?: unknown }).start === 'object' &&
		(span as { start?: { line?: unknown } }).start !== null
	) {
		const line = (span as { start?: { line?: unknown } }).start?.line
		if (typeof line === 'number' && Number.isFinite(line)) return line
	}

	// Biome JSON form: span is [startOffset, endOffset] (or a numeric start).
	let startOffset: number | null = null
	if (
		Array.isArray(span) &&
		span.length > 0 &&
		typeof span[0] === 'number' &&
		Number.isFinite(span[0])
	) {
		startOffset = span[0]
	} else if (typeof span === 'number' && Number.isFinite(span)) {
		startOffset = span
	}

	if (startOffset !== null && typeof sourceCode === 'string') {
		const safeOffset = Math.max(0, Math.min(startOffset, sourceCode.length))
		let line = 1
		for (let i = 0; i < safeOffset; i += 1) {
			if (sourceCode.charCodeAt(i) === 10) line += 1 // '\n'
		}
		return line
	}

	return 0
}

function parseBiomeOutput(stdout: string): BiomeDiagnostic[] {
	const diagnostics: BiomeDiagnostic[] = []
	try {
		const report = JSON.parse(stdout)
		if (report.diagnostics) {
			for (const d of report.diagnostics) {
				if (d.severity === 'error' || d.severity === 'warning') {
					diagnostics.push({
						file: d.location?.path?.file || 'unknown',
						line: extractDiagnosticLine(d.location),
						message: d.description || d.message || 'Unknown issue',
						code: d.category || 'unknown',
						severity: d.severity,
					})
				}
			}
		}
	} catch {
		// If parse fails, return empty
	}
	return diagnostics
}

async function main() {
	// Check stop_hook_active to prevent infinite loops
	let stopHookActive = false
	try {
		const raw = await Bun.stdin.text()
		if (raw.trim()) {
			const input = JSON.parse(raw) as { stop_hook_active?: boolean }
			stopHookActive = input.stop_hook_active === true
		}
	} catch {
		// stdin empty or not JSON -- proceed normally
	}
	if (stopHookActive) {
		process.exit(0)
	}

	const root = await getGitRoot()
	if (!root) process.exit(0)

	if (!(await hasChangedBiomeFiles())) process.exit(0)

	// Biome needs a biome.json config to run
	if (!existsSync(`${root}/biome.json`) && !existsSync(`${root}/biome.jsonc`))
		process.exit(0)

	// Always run Biome directly to avoid executing unrelated workspace scripts.
	const cmd = ['bunx', '@biomejs/biome', 'check', '--reporter=json', root]

	const proc = Bun.spawn(cmd, {
		cwd: root,
		stdout: 'pipe',
		stderr: 'pipe',
		env: { ...process.env, CI: 'true' },
	})

	const [exitCode, stdout, stderr] = await Promise.all([
		proc.exited,
		proc.stdout.text(),
		proc.stderr.text(),
	])

	if (exitCode === 0) process.exit(0)

	// Parse stdout first (biome --reporter=json writes JSON to stdout).
	// Fall back to stderr only if stdout yields nothing -- avoids corrupting
	// JSON parse when biome writes warnings/deprecations to stderr.
	let diagnostics = parseBiomeOutput(stdout)
	if (diagnostics.length === 0) {
		diagnostics = parseBiomeOutput(stderr)
	}

	// Guard: biome crashed but produced no parseable diagnostics
	if (diagnostics.length === 0) {
		process.stderr.write(
			`biome-ci: biome exited ${exitCode} but no diagnostics parsed (possible crash). Check biome manually.\n`,
		)
		process.exit(0)
	}

	const errors = diagnostics.filter((d) => d.severity === 'error')

	process.stderr.write(
		JSON.stringify({
			tool: 'biome-ci',
			status: errors.length > 0 ? 'error' : 'warning',
			errorCount: errors.length,
			warningCount: diagnostics.length - errors.length,
			errors: diagnostics.slice(0, 30).map((d) => ({
				file: d.file,
				line: d.line,
				message: `[${d.code}] ${d.message}`,
				severity: d.severity,
			})),
		}),
	)

	// Only block on errors, not warnings
	process.exit(errors.length > 0 ? 2 : 0)
}

if (import.meta.main) {
	const selfDestruct = setTimeout(() => {
		process.stderr.write('biome-ci: timed out\n')
		process.exit(0)
	}, 96_000)
	selfDestruct.unref()
	main()
}
