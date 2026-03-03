#!/usr/bin/env bun

/**
 * PostToolUse hook: Run tsc type checking on edited TypeScript files.
 *
 * Self-contained -- uses only Bun built-in APIs.
 * Groups files by nearest tsconfig, runs tsc once per package (in parallel).
 * Uses stdout JSON with `decision: "block"` for structured error feedback.
 */

import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

const TS_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']
const CONFIG_FILES = ['tsconfig.json', 'jsconfig.json']

interface HookInput {
	tool_name: string
	tool_input?: {
		file_path?: string
		edits?: Array<{ file_path?: string }>
	}
}

interface TscError {
	file: string
	line: number
	col: number
	message: string
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

/** Walk up from filePath to find nearest tsconfig.json or jsconfig.json. */
function findNearestConfig(filePath: string): string | null {
	let dir = dirname(resolve(filePath))
	const root = '/'
	while (dir !== root) {
		for (const configFile of CONFIG_FILES) {
			const candidate = join(dir, configFile)
			if (existsSync(candidate)) return dir
		}
		const parent = dirname(dir)
		if (parent === dir) break
		dir = parent
	}
	return null
}

/** Parse tsc --pretty false output into structured errors. */
function parseTscOutput(output: string): TscError[] {
	const errors: TscError[] = []
	const pattern = /^(.+?)\((\d+),(\d+)\):\s*error\s+TS\d+:\s*(.+)$/gm
	for (const match of output.matchAll(pattern)) {
		const [, file, line, col, message] = match
		if (file && line && col && message) {
			errors.push({
				file,
				line: Number.parseInt(line, 10),
				col: Number.parseInt(col, 10),
				message,
			})
		}
	}
	return errors
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
		TS_EXTENSIONS.some((ext) => f.endsWith(ext)),
	)

	if (filePaths.length === 0) process.exit(0)

	// Group files by nearest tsconfig directory
	const byConfigDir = new Map<string, string[]>()
	for (const filePath of filePaths) {
		const configDir = findNearestConfig(filePath)
		if (!configDir) continue
		const files = byConfigDir.get(configDir) || []
		files.push(filePath)
		byConfigDir.set(configDir, files)
	}

	// Run tsc in parallel for each config directory
	const results = await Promise.all(
		[...byConfigDir.entries()].map(async ([cwd, editedFiles]) => {
			const proc = Bun.spawn(
				['bunx', 'tsc', '--noEmit', '--incremental', '--pretty', 'false'],
				{
					cwd,
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

			if (exitCode === 0) return []

			const errors = parseTscOutput(`${stdout}${stderr}`)

			// Guard: tsc crashed but produced no parseable errors
			if (errors.length === 0) {
				process.stderr.write(
					`tsc-check: tsc exited ${exitCode} but no errors parsed (possible crash). Check tsc manually.\n`,
				)
				return []
			}

			// Filter to only errors in edited files
			const editedSet = new Set(
				editedFiles.map((f) => relative(cwd, resolve(f))),
			)
			return errors.filter((e) => {
				const normalizedFile = isAbsolute(e.file)
					? relative(cwd, e.file)
					: e.file
				return editedSet.has(normalizedFile)
			})
		}),
	)

	const allErrors = results.flat()

	if (allErrors.length > 0) {
		// Structured feedback via PostToolUse JSON protocol
		const output = {
			decision: 'block',
			reason: `${allErrors.length} TypeScript error(s) in edited files`,
			hookSpecificOutput: {
				hookEventName: 'PostToolUse',
				additionalContext: allErrors
					.slice(0, 20)
					.map((e) => `${e.file}:${e.line}:${e.col} - ${e.message}`)
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
		process.stderr.write('tsc-check: timed out\n')
		process.exit(0) // Non-gating: allow through on timeout
	}, 24_000)
	selfDestruct.unref()
	main()
}
