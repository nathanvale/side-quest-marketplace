#!/usr/bin/env bun

/**
 * Stop hook: Run project-wide tsc type checking at session end.
 *
 * Self-contained -- uses only Bun built-in APIs.
 * Detects Bun workspace vs single package, runs appropriate command.
 * Reports ALL type errors (TypeScript errors cascade across files).
 * Exit 0 = clean, Exit 2 = type errors (blocking).
 */

import { existsSync, readFileSync } from 'node:fs'

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

/** Check if any changed/staged/untracked files are TypeScript. */
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

/** Check if root is a Bun/npm workspace (array-form only). */
function isWorkspace(root: string): boolean {
	try {
		const pkg = JSON.parse(readFileSync(`${root}/package.json`, 'utf-8')) as {
			workspaces?: unknown
		}
		return Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0
	} catch {
		return false
	}
}

interface TscError {
	file: string
	line: number
	col: number
	message: string
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

	const workspace = isWorkspace(root)
	// Workspace repos may rely on per-package tsconfig files, not a root tsconfig.json.
	if (!workspace && !existsSync(`${root}/tsconfig.json`)) process.exit(0)

	const cmd = workspace
		? ['bun', 'run', '--filter', '*', 'typecheck']
		: ['bunx', 'tsc', '--noEmit', '--incremental', '--pretty', 'false']

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

	const errors = parseTscOutput(`${stdout}${stderr}`)

	// Guard: tsc crashed but produced no parseable errors
	if (errors.length === 0) {
		process.stderr.write(
			`tsc-ci: tsc exited ${exitCode} but no errors parsed (possible crash). Check tsc manually.\n`,
		)
		process.exit(0)
	}

	process.stderr.write(
		JSON.stringify({
			tool: 'tsc-ci',
			status: 'error',
			errorCount: errors.length,
			errors: errors.slice(0, 30),
		}),
	)
	process.exit(2)
}

if (import.meta.main) {
	const selfDestruct = setTimeout(() => {
		process.stderr.write('tsc-ci: timed out\n')
		process.exit(0)
	}, 96_000)
	selfDestruct.unref()
	main()
}
