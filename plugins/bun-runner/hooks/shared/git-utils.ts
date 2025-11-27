/**
 * Shared git utilities for bun-runner hooks.
 * Provides git-aware file tracking and change detection.
 */

import { spawn } from 'bun'

/**
 * Check if a file is tracked by git (either already tracked or staged).
 * Used by PostToolUse hooks to skip untracked temporary files.
 *
 * @param filePath - Path to the file to check
 * @returns true if file is tracked or staged, false otherwise
 */
export async function isGitTracked(filePath: string): Promise<boolean> {
  // Check if file is tracked
  const proc = spawn({
    cmd: ['git', 'ls-files', '--error-unmatch', filePath],
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const exitCode = await proc.exited

  if (exitCode === 0) return true

  // Also check if file is staged (new file added to index)
  const stagedProc = spawn({
    cmd: ['git', 'diff', '--cached', '--name-only', '--', filePath],
    stdout: 'pipe',
    stderr: 'pipe',
  })
  await stagedProc.exited
  const stagedOutput = await new Response(stagedProc.stdout).text()

  return stagedOutput.trim().length > 0
}

/**
 * Get list of files that have been modified or staged in git.
 * Used by Stop hooks for end-of-turn validation.
 *
 * @param extensions - Optional array of file extensions to filter by
 * @returns Array of changed file paths
 */
export async function getChangedFiles(
  extensions?: string[],
): Promise<string[]> {
  const files = new Set<string>()

  // Get staged files
  const stagedProc = spawn({
    cmd: ['git', 'diff', '--cached', '--name-only'],
    stdout: 'pipe',
    stderr: 'pipe',
  })
  await stagedProc.exited
  const stagedOutput = await new Response(stagedProc.stdout).text()
  for (const file of stagedOutput.trim().split('\n')) {
    if (file) files.add(file)
  }

  // Get unstaged modified files
  const modifiedProc = spawn({
    cmd: ['git', 'diff', '--name-only'],
    stdout: 'pipe',
    stderr: 'pipe',
  })
  await modifiedProc.exited
  const modifiedOutput = await new Response(modifiedProc.stdout).text()
  for (const file of modifiedOutput.trim().split('\n')) {
    if (file) files.add(file)
  }

  const allFiles = Array.from(files)

  // Filter by extensions if provided
  if (extensions && extensions.length > 0) {
    return allFiles.filter((file) =>
      extensions.some((ext) => file.endsWith(ext)),
    )
  }

  return allFiles
}

/**
 * Check if any files with given extensions have been modified or staged.
 * Used by Stop hooks to decide whether to run project-wide checks.
 *
 * @param extensions - Array of file extensions to check for
 * @returns true if any matching files have changed
 */
export async function hasChangedFiles(extensions: string[]): Promise<boolean> {
  const changedFiles = await getChangedFiles(extensions)
  return changedFiles.length > 0
}
