/**
 * Shared git status parser and repo identity utilities.
 *
 * Used by both git-context-loader (SessionStart) and auto-commit-on-stop (Stop)
 * to avoid duplicating porcelain parsing logic.
 *
 * Also provides getMainWorktreeRoot for worktree-aware repo identification --
 * ensuring all worktrees of the same repo share the same identity key
 * (e.g. for session summary files).
 */

export interface FileStatusCounts {
	staged: number
	modified: number
	untracked: number
}

/**
 * Parse `git status --porcelain [-b]` output into file status counts
 * and an optional branch name (present only when `-b` flag was used).
 */
export function parsePorcelainStatus(output: string): {
	branch: string | null
	counts: FileStatusCounts
} {
	const lines = output.split('\n')
	const branchLine = lines.find((line) => line.startsWith('##'))
	let branch: string | null = null
	if (branchLine) {
		const header = branchLine.slice(3).trim()
		if (header.startsWith('No commits yet on ')) {
			branch = header.slice('No commits yet on '.length).trim() || null
		} else {
			const parsed = header.split('...')[0]
			if (parsed) {
				branch = parsed.trim()
			}
		}
	}

	let staged = 0
	let modified = 0
	let untracked = 0

	for (const line of lines) {
		if (!line.trim() || line.startsWith('##')) {
			continue
		}

		const code = line.slice(0, 2)
		if (code.startsWith('?') || code === '??') {
			untracked++
			continue
		}

		if (code[0] !== ' ' && code[0] !== '?') {
			staged++
		}
		if (code[1] !== ' ' && code[1] !== '?') {
			modified++
		}
	}

	return { branch, counts: { staged, modified, untracked } }
}

/**
 * Returns the root path of the main (non-linked) worktree for the repo
 * that contains `cwd`.
 *
 * Uses `git worktree list --porcelain` which always lists the main worktree
 * first. This is critical for worktree-aware keying: `--show-toplevel`
 * returns the *current* worktree path (different for each linked worktree),
 * while this function always returns the real repo root.
 *
 * Returns null if `cwd` is not inside a git repository.
 */
export async function getMainWorktreeRoot(cwd: string): Promise<string | null> {
	const proc = Bun.spawn(['git', 'worktree', 'list', '--porcelain'], {
		cwd,
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const stdout = await new Response(proc.stdout).text()
	const exitCode = await proc.exited

	if (exitCode !== 0) {
		return null
	}

	// The first "worktree <path>" line is always the main worktree
	const match = stdout.match(/^worktree\s+(.+)$/m)
	return match?.[1] ?? null
}
