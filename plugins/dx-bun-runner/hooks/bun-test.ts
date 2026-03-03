#!/usr/bin/env bun

/**
 * PostToolUse hook: Run Bun tests on edited test files.
 *
 * Self-contained -- uses only Bun built-in APIs.
 * Matches test files directly, or finds corresponding test files for source files.
 * Runs `bun test <file>` for each matched test file.
 * Uses stdout JSON with `decision: "block"` to prompt Claude with failures.
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const TEST_SUFFIXES = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx']

interface HookInput {
	tool_name: string
	tool_input?: {
		file_path?: string
		edits?: Array<{ file_path?: string }>
	}
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

/** Find the test file for a given source or test file path. */
function findTestFile(filePath: string): string | null {
	// Already a test file
	if (TEST_SUFFIXES.some((s) => filePath.endsWith(s))) {
		return existsSync(filePath) ? filePath : null
	}

	// Try stripping extension and adding test suffixes
	const base = filePath.replace(/\.(ts|tsx|js|jsx)$/, '')
	if (base === filePath) return null // No recognized extension
	for (const suffix of TEST_SUFFIXES) {
		const testPath = `${base}${suffix}`
		if (existsSync(testPath)) return testPath
	}
	return null
}

async function main() {
	const input = await Bun.stdin.text()
	let hookInput: HookInput
	try {
		hookInput = JSON.parse(input)
	} catch {
		process.exit(0)
	}

	const testFiles = [
		...new Set(
			extractFilePaths(hookInput)
				.map((f) => findTestFile(resolve(f)))
				.filter((f): f is string => f !== null),
		),
	]

	if (testFiles.length === 0) process.exit(0)

	// Hoist env to avoid copying process.env per spawn
	const testEnv = { ...process.env, CI: 'true', NO_COLOR: '1' }

	// Run bun test for each test file in parallel
	const results = await Promise.all(
		testFiles.map(async (testFile) => {
			const proc = Bun.spawn(['bun', 'test', testFile], {
				stdout: 'pipe',
				stderr: 'pipe',
				env: testEnv,
			})
			const [exitCode, stdout, stderr] = await Promise.all([
				proc.exited,
				proc.stdout.text(),
				proc.stderr.text(),
			])
			return { testFile, exitCode, stdout, stderr }
		}),
	)

	const failures = results.filter((r) => r.exitCode !== 0)

	if (failures.length > 0) {
		// Bun writes test output to stderr; send truncated raw output to Claude
		const failureDetails = failures
			.slice(0, 10)
			.map((f) => {
				const output = f.stderr || f.stdout
				const lines = output.split('\n').filter((l) => l.trim())
				return `${f.testFile}:\n${lines.slice(-20).join('\n')}`
			})
			.join('\n\n')

		const output = {
			decision: 'block',
			reason: `${failures.length} test file(s) failed`,
			hookSpecificOutput: {
				hookEventName: 'PostToolUse',
				additionalContext: failureDetails,
			},
		}
		process.stdout.write(JSON.stringify(output))
		process.exit(0)
	}

	process.exit(0)
}

if (import.meta.main) {
	const selfDestruct = setTimeout(() => {
		process.stderr.write('bun-test: timed out\n')
		process.exit(0) // Non-gating: allow through on timeout
	}, 24_000)
	selfDestruct.unref()
	main().catch(() => process.exit(0))
}
