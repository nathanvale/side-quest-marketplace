/**
 * Shared git utility functions for hook implementations.
 *
 * Consolidates the duplicated runGit, getCurrentBranch, and isGitRepo
 * functions that were previously copy-pasted across 5 hook files.
 */

export interface RunGitOptions {
	/** Working directory for the git command. Defaults to process.cwd(). */
	cwd?: string
	/** How to handle stderr. Defaults to 'ignore'. */
	stderr?: 'pipe' | 'ignore'
	/** Whether to trim stdout. Defaults to true. */
	trim?: boolean
}

export interface RunGitResult {
	stdout: string
	exitCode: number
}

/**
 * Spawns a git subprocess and returns its stdout and exit code.
 *
 * Why a shared helper: five hook files had their own copy of this function
 * with slightly different stderr handling and trim behavior. This canonical
 * version exposes both as options so each callsite preserves its original
 * behavior without code duplication.
 */
export async function runGit(
	args: string[],
	options?: RunGitOptions,
): Promise<RunGitResult> {
	const cwd = options?.cwd
	const stderr = options?.stderr ?? 'ignore'
	const trim = options?.trim ?? true

	const proc = Bun.spawn(['git', ...args], {
		cwd,
		stdout: 'pipe',
		stderr,
	})
	// Drain stdout concurrently with proc.exited to avoid pipe deadlock
	const [rawStdout, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		proc.exited,
	])
	return { stdout: trim ? rawStdout.trim() : rawStdout, exitCode }
}

/**
 * Returns the current branch name, or null if detached or not in a git repo.
 */
export async function getCurrentBranch(cwd?: string): Promise<string | null> {
	try {
		const result = await runGit(['branch', '--show-current'], { cwd })
		if (result.exitCode !== 0) {
			return null
		}
		return result.stdout || null
	} catch {
		return null
	}
}

/**
 * Returns true if the given directory is inside a git repository.
 */
export async function isGitRepo(cwd: string): Promise<boolean> {
	const { exitCode } = await runGit(['rev-parse', '--git-dir'], { cwd })
	return exitCode === 0
}
