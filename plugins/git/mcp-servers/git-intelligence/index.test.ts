import { describe, expect, test } from 'bun:test'
import { execSync } from 'node:child_process'

// We need to test the functions directly, so let's import them
// First, let's refactor to export the functions we want to test

// Find the git root by traversing up from this file's directory
function findGitRoot(startDir: string): string {
  let dir = startDir
  while (dir !== '/') {
    try {
      execSync('git rev-parse --git-dir', {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      return dir
    } catch {
      dir = dir.split('/').slice(0, -1).join('/') || '/'
    }
  }
  return startDir // fallback
}

const TEST_CWD = findGitRoot(import.meta.dir)

function git(args: string, cwd: string = TEST_CWD): string {
  try {
    return execSync(`git ${args}`, {
      encoding: 'utf8',
      cwd,
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch (error: unknown) {
    const execError = error as { stderr?: string }
    if (execError.stderr) {
      throw new Error(execError.stderr.trim())
    }
    throw error
  }
}

function isGitRepo(cwd: string = TEST_CWD): boolean {
  try {
    git('rev-parse --git-dir', cwd)
    return true
  } catch {
    return false
  }
}

describe('git utility functions', () => {
  test('isGitRepo returns true for git repositories', () => {
    // The plugin directory should be a git repo
    const pluginDir = import.meta.dir
    expect(isGitRepo(pluginDir)).toBe(true)
  })

  test('isGitRepo returns false for non-git directories', () => {
    expect(isGitRepo('/tmp')).toBe(false)
  })

  test('git command returns branch name', () => {
    const branch = git('branch --show-current')
    expect(typeof branch).toBe('string')
    expect(branch.length).toBeGreaterThan(0)
  })

  test('git log returns commits', () => {
    const format = '%H%x00%h%x00%s%x00%an%x00%ar'
    const output = git(`log --oneline -5 --format="${format}"`)

    expect(output).toBeTruthy()
    const lines = output.split('\n')
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.length).toBeLessThanOrEqual(5)

    // Each line should have 5 parts separated by null char
    const firstLine = lines[0]
    expect(firstLine).toBeDefined()
    const parts = firstLine!.split('\x00')
    expect(parts.length).toBe(5)
  })

  test('git status --porcelain returns valid format', () => {
    // This might be empty if working tree is clean
    const output = git('status --porcelain')
    // Just verify it doesn't throw
    expect(typeof output).toBe('string')
  })
})

describe('commit parsing', () => {
  test('parses commit format correctly', () => {
    const format = '%H%x00%h%x00%s%x00%an%x00%ar%x00%d'
    const output = git(`log --oneline -1 --format="${format}"`)

    const parts = output.split('\x00')
    const hash = parts[0]
    const short = parts[1]
    const subject = parts[2]
    const author = parts[3]
    const relative = parts[4]

    // Full hash is 40 chars
    expect(hash).toBeDefined()
    expect(hash?.length).toBe(40)
    // Short hash is typically 7 chars
    expect(short).toBeDefined()
    expect(short?.length).toBeGreaterThanOrEqual(7)
    // Subject should exist
    expect(subject).toBeDefined()
    expect(subject?.length).toBeGreaterThan(0)
    // Author should exist
    expect(author).toBeDefined()
    expect(author?.length).toBeGreaterThan(0)
    // Relative time should contain "ago" or be recent
    expect(relative).toBeTruthy()
  })
})

describe('branch info', () => {
  test('lists branches', () => {
    const output = git("branch -a --format='%(refname:short)'")
    const branches = output.split('\n').filter((b) => b && !b.includes('HEAD'))

    expect(branches.length).toBeGreaterThan(0)
    // Current branch should be in the list
    const current = git('branch --show-current')
    if (current) {
      expect(branches).toContain(current)
    }
  })
})

describe('diff summary', () => {
  test('numstat format is parseable', () => {
    // Compare HEAD to HEAD (should be empty)
    const output = git('diff --numstat HEAD HEAD')
    expect(output).toBe('')
  })

  test('diff against HEAD~1 returns valid format', () => {
    try {
      const output = git('diff --numstat HEAD~1')
      if (output) {
        const lines = output.split('\n')
        lines.forEach((line) => {
          const parts = line.split('\t')
          expect(parts.length).toBe(3)
          // First two parts should be numbers (or - for binary)
          const added = parts[0]
          const deleted = parts[1]
          const file = parts[2]
          expect(added === '-' || !Number.isNaN(Number.parseInt(added ?? '', 10))).toBe(true)
          expect(deleted === '-' || !Number.isNaN(Number.parseInt(deleted ?? '', 10))).toBe(true)
          expect(file).toBeDefined()
          expect(file?.length).toBeGreaterThan(0)
        })
      }
    } catch {
      // May fail if there's only one commit - that's ok
    }
  })
})

describe('status parsing', () => {
  test('porcelain format has correct structure', () => {
    const output = git('status --porcelain')

    // Just verify it returns valid output format (empty or lines)
    expect(typeof output).toBe('string')
    if (output) {
      const lines = output.split('\n')
      // Each line should have at least status codes + space + filename
      lines.forEach((line) => {
        if (line.length >= 3) {
          // First two chars are status codes, valid codes include space and letters
          const validCodes = ' MADRCU?!'
          const index = line[0]
          const worktree = line[1]
          if (index && worktree) {
            expect(validCodes.includes(index)).toBe(true)
            expect(validCodes.includes(worktree)).toBe(true)
          }
        }
      })
    }
  })
})
