/**
 * Shared git utilities for bun-runner hooks.
 * Provides git-aware file tracking and change detection.
 */

import { resolve } from 'node:path'
import { spawn } from 'bun'

/**
 * Get the root directory of the current git repository.
 *
 * @returns The absolute path to the git root, or null if not in a git repo
 */
export async function getGitRoot(): Promise<string | null> {
  const proc = spawn({
    cmd: ['git', 'rev-parse', '--show-toplevel'],
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const exitCode = await proc.exited
  if (exitCode !== 0) return null

  const output = await new Response(proc.stdout).text()
  return output.trim() || null
}

/**
 * Check if a file path is inside the current git repository.
 * Returns true for any file inside the repo directory, including untracked files.
 *
 * @param filePath - Path to the file to check
 * @returns true if file is inside the git repo, false otherwise
 */
export async function isFileInRepo(filePath: string): Promise<boolean> {
  const gitRoot = await getGitRoot()
  if (!gitRoot) return false

  const absolutePath = resolve(filePath)
  return absolutePath.startsWith(gitRoot)
}

/**
 * Get list of files that have been modified, staged, or are untracked in git.
 * Used by Stop hooks for end-of-turn validation.
 *
 * Includes:
 * - Staged files (git diff --cached)
 * - Unstaged modified files (git diff)
 * - Untracked files (git ls-files --others --exclude-standard)
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

  // Get untracked files (newly created files not yet added to git)
  const untrackedProc = spawn({
    cmd: ['git', 'ls-files', '--others', '--exclude-standard'],
    stdout: 'pipe',
    stderr: 'pipe',
  })
  await untrackedProc.exited
  const untrackedOutput = await new Response(untrackedProc.stdout).text()
  for (const file of untrackedOutput.trim().split('\n')) {
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
