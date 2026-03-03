import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

interface HookRunResult {
	exitCode: number
	stdout: string
	stderr: string
}

const tempDirs: string[] = []

function runGit(cwd: string, args: string[]): HookRunResult {
	const proc = Bun.spawnSync(['git', ...args], {
		cwd,
		stdout: 'pipe',
		stderr: 'pipe',
	})
	return {
		exitCode: proc.exitCode,
		stdout: new TextDecoder().decode(proc.stdout).trim(),
		stderr: new TextDecoder().decode(proc.stderr).trim(),
	}
}

function createTempRepo(): { cwd: string; branch: string } {
	const cwd = mkdtempSync(join(tmpdir(), 'git-safety-runtime-'))
	tempDirs.push(cwd)
	const init = runGit(cwd, ['init', '-b', 'main'])
	if (init.exitCode !== 0) {
		const fallback = runGit(cwd, ['init'])
		if (fallback.exitCode !== 0) {
			throw new Error(`git init failed: ${init.stderr} ${fallback.stderr}`)
		}
	}

	runGit(cwd, ['config', 'user.email', 'test@example.com'])
	runGit(cwd, ['config', 'user.name', 'Test User'])

	writeFileSync(join(cwd, 'README.md'), 'test\n')
	runGit(cwd, ['add', 'README.md'])
	runGit(cwd, ['commit', '-m', 'chore: init'])

	const branch = runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout || 'main'
	return { cwd, branch }
}

function runSafetyHook(params: {
	command?: string
	filePath?: string
	toolName?: 'Bash' | 'Write' | 'Edit'
	cwd: string
	mode: 'strict' | 'commit-guard' | 'advisory'
	protectedBranches?: string
	eventLogPath?: string
}): HookRunResult {
	const payload = JSON.stringify(
		params.toolName === 'Write' || params.toolName === 'Edit'
			? {
					tool_name: params.toolName,
					tool_input: { file_path: params.filePath ?? '.env' },
					cwd: params.cwd,
				}
			: {
					tool_name: params.toolName ?? 'Bash',
					tool_input: { command: params.command ?? '' },
					cwd: params.cwd,
				},
	)
	const scriptPath = join(import.meta.dir, 'git-safety.ts')
	const proc = Bun.spawnSync([process.execPath, scriptPath], {
		env: {
			...process.env,
			CLAUDE_GIT_SAFETY_MODE: params.mode,
			CLAUDE_PROTECTED_BRANCHES:
				params.protectedBranches ?? process.env.CLAUDE_PROTECTED_BRANCHES ?? '',
			CLAUDE_HOOK_EVENT_LOG: params.eventLogPath,
		},
		stdin: new TextEncoder().encode(payload),
		stdout: 'pipe',
		stderr: 'pipe',
	})
	return {
		exitCode: proc.exitCode,
		stdout: new TextDecoder().decode(proc.stdout),
		stderr: new TextDecoder().decode(proc.stderr),
	}
}

function readEventTypes(path: string): string[] {
	let content = ''
	try {
		content = readFileSync(path, 'utf8').trim()
	} catch {
		return []
	}
	if (!content) return []
	return content
		.split('\n')
		.map((line) => JSON.parse(line) as { type?: string })
		.map((e) => e.type || '')
		.filter(Boolean)
}

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop()
		if (dir) rmSync(dir, { recursive: true, force: true })
	}
})

describe('git-safety runtime mode behavior', () => {
	test('strict denies destructive commands', () => {
		const { cwd } = createTempRepo()
		const result = runSafetyHook({
			command: 'git reset --hard',
			cwd,
			mode: 'strict',
		})
		expect(result.exitCode).toBe(2)
		expect(result.stdout).toContain('"permissionDecision":"deny"')
	})

	test('commit-guard allows destructive command that strict would deny', () => {
		const { cwd } = createTempRepo()
		const eventLogPath = join(cwd, 'events.jsonl')
		const result = runSafetyHook({
			command: 'git reset --hard',
			cwd,
			mode: 'commit-guard',
			eventLogPath,
		})
		expect(result.exitCode).toBe(0)
		expect(result.stdout).not.toContain('"permissionDecision":"deny"')
		expect(readEventTypes(eventLogPath)).toContain('safety.warn')
	})

	test('commit-guard still denies commit on protected branch', () => {
		const { cwd, branch } = createTempRepo()
		const result = runSafetyHook({
			command: 'git commit -m "feat: test"',
			cwd,
			mode: 'commit-guard',
			protectedBranches: branch,
		})
		expect(result.exitCode).toBe(2)
		expect(result.stdout).toContain('"permissionDecision":"deny"')
		expect(result.stdout).toContain('Cannot commit directly')
	})

	test('advisory does not deny protected-branch commit attempts', () => {
		const { cwd, branch } = createTempRepo()
		const eventLogPath = join(cwd, 'events.jsonl')
		const result = runSafetyHook({
			command: 'git commit -m "feat: test"',
			cwd,
			mode: 'advisory',
			protectedBranches: branch,
			eventLogPath,
		})
		expect(result.exitCode).toBe(0)
		expect(result.stdout).not.toContain('"permissionDecision":"deny"')
		// Advisory should not emit safety.warn for non-blocked commands.
		expect(readEventTypes(eventLogPath)).not.toContain('safety.warn')
	})

	test('strict denies protected file edits', () => {
		const { cwd } = createTempRepo()
		const result = runSafetyHook({
			cwd,
			mode: 'strict',
			toolName: 'Write',
			filePath: '.env',
		})
		expect(result.exitCode).toBe(2)
		expect(result.stdout).toContain('"permissionDecision":"deny"')
	})

	test('commit-guard does not deny protected file edits', () => {
		const { cwd } = createTempRepo()
		const eventLogPath = join(cwd, 'events.jsonl')
		const result = runSafetyHook({
			cwd,
			mode: 'commit-guard',
			toolName: 'Write',
			filePath: '.env',
			eventLogPath,
		})
		expect(result.exitCode).toBe(0)
		expect(result.stdout).not.toContain('"permissionDecision":"deny"')
		expect(readEventTypes(eventLogPath)).toContain('safety.warn')
	})

	test('advisory does not deny protected file edits', () => {
		const { cwd } = createTempRepo()
		const result = runSafetyHook({
			cwd,
			mode: 'advisory',
			toolName: 'Edit',
			filePath: '.env.local',
		})
		expect(result.exitCode).toBe(0)
		expect(result.stdout).not.toContain('"permissionDecision":"deny"')
	})
})
