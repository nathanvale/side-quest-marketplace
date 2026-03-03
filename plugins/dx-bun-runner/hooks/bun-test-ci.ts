#!/usr/bin/env bun

/**
 * Stop hook: Run project-wide Bun tests at session end.
 *
 * Self-contained -- uses only Bun built-in APIs.
 * Checks for changed source/test files, runs `bun test` at git root.
 * Exit 0 = clean, Exit 2 = test failures (blocking).
 */

import { existsSync } from 'node:fs'

const TS_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']

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

/** Check if any changed/staged/untracked files are TypeScript (source or test). */
async function hasChangedTsFiles(): Promise<boolean> {
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
			.some((file) => file && TS_EXTENSIONS.some((ext) => file.endsWith(ext))),
	)
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

	if (!(await hasChangedTsFiles())) process.exit(0)

	// Need a package.json to run bun test
	if (!existsSync(`${root}/package.json`)) process.exit(0)

	const proc = Bun.spawn(['bun', 'test'], {
		cwd: root,
		stdout: 'pipe',
		stderr: 'pipe',
		env: { ...process.env, CI: 'true', NO_COLOR: '1' },
	})

	const [exitCode, stdout, stderr] = await Promise.all([
		proc.exited,
		proc.stdout.text(),
		proc.stderr.text(),
	])

	if (exitCode === 0) process.exit(0)

	// Bun test output goes to stderr
	const output = stderr || stdout
	const lines = output.split('\n').filter((l) => l.trim())

	// Guard: bun crashed but produced no output
	if (lines.length === 0) {
		process.stderr.write(
			`bun-test-ci: bun test exited ${exitCode} but no output (possible crash). Check tests manually.\n`,
		)
		process.exit(0)
	}

	process.stderr.write(
		JSON.stringify({
			tool: 'bun-test-ci',
			status: 'error',
			summary: `bun test exited with code ${exitCode}`,
			errors: lines.slice(-30),
		}),
	)
	process.exit(2)
}

if (import.meta.main) {
	const selfDestruct = setTimeout(() => {
		process.stderr.write('bun-test-ci: timed out\n')
		process.exit(0)
	}, 96_000)
	selfDestruct.unref()
	main().catch(() => process.exit(0))
}
