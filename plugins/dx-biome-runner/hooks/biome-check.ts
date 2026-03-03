#!/usr/bin/env bun

/**
 * PostToolUse hook: Run Biome linting/formatting on edited files.
 *
 * Self-contained -- uses only Bun built-in APIs.
 * Runs biome check with JSON reporter on edited files.
 * Uses stdout JSON with `decision: "block"` for structured error feedback.
 */

import { resolve } from 'node:path'

const BIOME_EXTENSIONS = [
	'.ts',
	'.tsx',
	'.js',
	'.jsx',
	'.json',
	'.jsonc',
	'.css',
]

interface HookInput {
	tool_name: string
	tool_input?: {
		file_path?: string
		edits?: Array<{ file_path?: string }>
	}
}

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

/** Extract unique file paths from hook input (Write, Edit, MultiEdit). */
function extractFilePaths(input: HookInput): string[] {
	const seen = new Set<string>()
	if (input.tool_input?.file_path) seen.add(input.tool_input.file_path)
	for (const edit of input.tool_input?.edits ?? []) {
		if (edit.file_path) seen.add(edit.file_path)
	}
	return [...seen]
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
		// If parse fails, return empty -- biome may have crashed
	}
	return diagnostics
}

async function main() {
	const input = await Bun.stdin.text()
	let hookInput: HookInput
	try {
		hookInput = JSON.parse(input)
	} catch {
		process.exit(0)
	}

	const filePaths = extractFilePaths(hookInput).filter((f) =>
		BIOME_EXTENSIONS.some((ext) => f.endsWith(ext)),
	)

	if (filePaths.length === 0) process.exit(0)

	// Resolve to absolute paths for biome
	const absolutePaths = filePaths.map((f) => resolve(f))

	// Run biome check on specific files with JSON reporter
	// '--' prevents argument injection via leading-dash file paths
	const proc = Bun.spawn(
		[
			'bunx',
			'@biomejs/biome',
			'check',
			'--reporter=json',
			'--',
			...absolutePaths,
		],
		{
			stdout: 'pipe',
			stderr: 'pipe',
			env: { ...process.env, CI: 'true' },
		},
	)

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
			`biome-check: biome exited ${exitCode} but no diagnostics parsed (possible crash). Check biome manually.\n`,
		)
		process.exit(0)
	}

	// Filter to only errors (not warnings) for blocking
	const errors = diagnostics.filter((d) => d.severity === 'error')

	if (errors.length > 0) {
		const output = {
			decision: 'block',
			reason: `${errors.length} Biome error(s) in edited files`,
			hookSpecificOutput: {
				hookEventName: 'PostToolUse',
				additionalContext: errors
					.slice(0, 20)
					.map((e) => `${e.file}:${e.line} [${e.code}] ${e.message}`)
					.join('\n'),
			},
		}
		process.stdout.write(JSON.stringify(output))
		process.exit(0)
	}

	process.exit(0)
}

if (import.meta.main) {
	const selfDestruct = setTimeout(() => {
		process.stderr.write('biome-check: timed out\n')
		process.exit(0) // Non-gating: allow through on timeout
	}, 24_000)
	selfDestruct.unref()
	main()
}
