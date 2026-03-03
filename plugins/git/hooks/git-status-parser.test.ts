import { describe, expect, test } from 'bun:test'
import { getMainWorktreeRoot, parsePorcelainStatus } from './git-status-parser'

describe('parsePorcelainStatus', () => {
	test('parses branch and empty status', () => {
		const output = '## main...origin/main\n'
		const result = parsePorcelainStatus(output)

		expect(result.branch).toBe('main')
		expect(result.counts.staged).toBe(0)
		expect(result.counts.modified).toBe(0)
		expect(result.counts.untracked).toBe(0)
	})

	test('parses staged, modified, and untracked files', () => {
		const output = [
			'## feat/test...origin/feat/test',
			'M  src/index.ts',
			' M src/utils.ts',
			'MM src/both.ts',
			'?? new-file.ts',
			'?? another-new.ts',
		].join('\n')
		const result = parsePorcelainStatus(output)

		expect(result.branch).toBe('feat/test')
		// M_ = staged, _M = modified, MM = staged+modified
		expect(result.counts.staged).toBe(2) // M_ and MM
		expect(result.counts.modified).toBe(2) // _M and MM
		expect(result.counts.untracked).toBe(2)
	})

	test('parses output without branch line', () => {
		const output = '?? untracked.txt\n'
		const result = parsePorcelainStatus(output)

		expect(result.branch).toBeNull()
		expect(result.counts.untracked).toBe(1)
	})

	test('handles empty output', () => {
		const result = parsePorcelainStatus('')

		expect(result.branch).toBeNull()
		expect(result.counts.staged).toBe(0)
		expect(result.counts.modified).toBe(0)
		expect(result.counts.untracked).toBe(0)
	})

	test('parses "No commits yet on" branch prefix', () => {
		const output = '## No commits yet on main\n?? README.md\n'
		const result = parsePorcelainStatus(output)

		expect(result.branch).toBe('main')
		expect(result.counts.untracked).toBe(1)
	})

	test('parses added files correctly', () => {
		const output = ['## main', 'A  new-staged.ts', 'AM staged-then-modified.ts'].join('\n')
		const result = parsePorcelainStatus(output)

		expect(result.branch).toBe('main')
		expect(result.counts.staged).toBe(2)
		expect(result.counts.modified).toBe(1) // AM has modification in worktree
		expect(result.counts.untracked).toBe(0)
	})
})

describe('getMainWorktreeRoot', () => {
	test('returns a path for a git repository', async () => {
		const root = await getMainWorktreeRoot(process.cwd())

		expect(root).not.toBeNull()
		expect(root).toBeTypeOf('string')
		expect(root!.length).toBeGreaterThan(0)
		// Should be an absolute path
		expect(root!.startsWith('/')).toBe(true)
	})

	test('returns null for a non-git directory', async () => {
		const root = await getMainWorktreeRoot('/tmp')

		expect(root).toBeNull()
	})
})
