import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Helper to run git commands safely using argument arrays
 */
function git(args: string[], cwd: string): string {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    cwd,
    maxBuffer: 10 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || `git exited with code ${result.status}`)
  }
  return result.stdout.trim()
}

// Find the git root by traversing up from this file's directory
function findGitRoot(startDir: string): string {
  let dir = startDir
  while (dir !== '/') {
    try {
      git(['rev-parse', '--git-dir'], dir)
      return dir
    } catch {
      dir = dir.split('/').slice(0, -1).join('/') || '/'
    }
  }
  return startDir
}

const TEST_CWD = findGitRoot(import.meta.dir)

/**
 * Create a temporary git repository for isolated testing
 */
function createTestRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'git-test-'))
  git(['init'], dir)
  git(['config', 'user.email', 'test@test.com'], dir)
  git(['config', 'user.name', 'Test User'], dir)
  return dir
}

/**
 * Clean up test repository
 */
function cleanupTestRepo(dir: string): void {
  rmSync(dir, { recursive: true, force: true })
}

describe('spawnSync security (command injection prevention)', () => {
  test('prevents command injection via search query', () => {
    const dir = createTestRepo()
    try {
      writeFileSync(join(dir, 'test.txt'), 'hello')
      git(['add', 'test.txt'], dir)
      git(['commit', '-m', 'initial commit'], dir)

      // This would execute arbitrary code with execSync string interpolation
      // With spawnSync arrays, it's passed as a literal string argument
      const maliciousQuery = '"; touch /tmp/pwned-' + Date.now() + '; echo "'

      const result = spawnSync('git', ['log', '--grep=' + maliciousQuery, '--format=%s'], {
        encoding: 'utf8',
        cwd: dir,
      })

      // The command completes (with no matches) rather than failing
      expect(result.status).toBe(0)
    } finally {
      cleanupTestRepo(dir)
    }
  })

  test('prevents command injection via ref parameter', () => {
    const dir = createTestRepo()
    try {
      writeFileSync(join(dir, 'test.txt'), 'hello')
      git(['add', 'test.txt'], dir)
      git(['commit', '-m', 'initial commit'], dir)

      // With execSync: git diff --numstat HEAD; rm -rf /
      // With spawnSync: "HEAD; rm -rf /" is passed as ONE argument to git
      const maliciousRef = 'HEAD; rm -rf /'

      const result = spawnSync('git', ['diff', '--numstat', maliciousRef], {
        encoding: 'utf8',
        cwd: dir,
      })

      // Git fails because it can't find a revision named "HEAD; rm -rf /"
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('unknown revision')
    } finally {
      cleanupTestRepo(dir)
    }
  })

  test('handles special characters safely', () => {
    const dir = createTestRepo()
    try {
      writeFileSync(join(dir, 'test.txt'), 'hello')
      git(['add', 'test.txt'], dir)
      git(['commit', '-m', 'test $PATH and `command` and $(subshell)'], dir)

      // Search for literal special characters
      const result = spawnSync('git', ['log', '--grep=$PATH', '--format=%s'], {
        encoding: 'utf8',
        cwd: dir,
      })

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('$PATH')
    } finally {
      cleanupTestRepo(dir)
    }
  })
})

describe('git utility functions', () => {
  test('isGitRepo returns true for git repositories', () => {
    expect(() => git(['rev-parse', '--git-dir'], TEST_CWD)).not.toThrow()
  })

  test('isGitRepo returns false for non-git directories', () => {
    const result = spawnSync('git', ['rev-parse', '--git-dir'], {
      encoding: 'utf8',
      cwd: '/tmp',
    })
    expect(result.status).not.toBe(0)
  })

  test('git command returns branch name', () => {
    const branch = git(['branch', '--show-current'], TEST_CWD)
    expect(typeof branch).toBe('string')
    expect(branch.length).toBeGreaterThan(0)
  })
})

describe('get_recent_commits format', () => {
  test('parses commit format correctly', () => {
    const format = '%H%x00%h%x00%s%x00%an%x00%ar%x00%d'
    const output = git(['log', '--oneline', '-1', `--format=${format}`], TEST_CWD)

    const parts = output.split('\x00')
    const hash = parts[0]
    const short = parts[1]
    const subject = parts[2]
    const author = parts[3]
    const relative = parts[4]

    expect(hash).toBeDefined()
    expect(hash?.length).toBe(40)
    expect(short).toBeDefined()
    expect(short?.length).toBeGreaterThanOrEqual(7)
    expect(subject).toBeDefined()
    expect(subject?.length).toBeGreaterThan(0)
    expect(author).toBeDefined()
    expect(author?.length).toBeGreaterThan(0)
    expect(relative).toBeTruthy()
  })

  test('respects limit parameter', () => {
    const format = '%H%x00%h%x00%s%x00%an%x00%ar%x00%d'
    const output = git(['log', '--oneline', '-5', `--format=${format}`], TEST_CWD)

    const lines = output.split('\n')
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.length).toBeLessThanOrEqual(5)
  })
})

describe('search_commits format', () => {
  test('grep search returns matching commits', () => {
    const dir = createTestRepo()
    try {
      writeFileSync(join(dir, 'auth.txt'), 'auth code')
      git(['add', 'auth.txt'], dir)
      git(['commit', '-m', 'feat(auth): add login'], dir)

      writeFileSync(join(dir, 'api.txt'), 'api code')
      git(['add', 'api.txt'], dir)
      git(['commit', '-m', 'feat(api): add endpoints'], dir)

      const format = '%H%x00%h%x00%s%x00%an%x00%ar'
      const output = git(['log', '-20', '--grep=auth', `--format=${format}`], dir)

      expect(output).toContain('feat(auth): add login')
      expect(output).not.toContain('feat(api)')
    } finally {
      cleanupTestRepo(dir)
    }
  })

  test('-S search finds code changes', () => {
    const dir = createTestRepo()
    try {
      writeFileSync(join(dir, 'code.txt'), 'function uniqueIdentifier() {}')
      git(['add', 'code.txt'], dir)
      git(['commit', '-m', 'add function'], dir)

      const format = '%H%x00%h%x00%s%x00%an%x00%ar'
      const output = git(['log', '-20', '-S', 'uniqueIdentifier', `--format=${format}`], dir)

      expect(output).toContain('add function')
    } finally {
      cleanupTestRepo(dir)
    }
  })
})

describe('get_file_history format', () => {
  test('--follow tracks file across renames', () => {
    const dir = createTestRepo()
    try {
      writeFileSync(join(dir, 'original.txt'), 'content')
      git(['add', 'original.txt'], dir)
      git(['commit', '-m', 'create original file'], dir)

      git(['mv', 'original.txt', 'renamed.txt'], dir)
      git(['commit', '-m', 'rename file'], dir)

      writeFileSync(join(dir, 'renamed.txt'), 'updated content')
      git(['add', 'renamed.txt'], dir)
      git(['commit', '-m', 'update renamed file'], dir)

      const format = '%H%x00%h%x00%s%x00%an%x00%ar'
      const output = git(['log', '--follow', '-10', `--format=${format}`, '--', 'renamed.txt'], dir)

      const lines = output.split('\n')
      expect(lines.length).toBe(3) // All commits affecting this file
      expect(output).toContain('update renamed file')
      expect(output).toContain('rename file')
      expect(output).toContain('create original file')
    } finally {
      cleanupTestRepo(dir)
    }
  })
})

describe('get_status format (porcelain v2)', () => {
  test('parses branch info', () => {
    const output = git(['status', '--porcelain=v2', '--branch'], TEST_CWD)
    expect(output).toContain('# branch.head')
  })

  test('shows staged files', () => {
    const dir = createTestRepo()
    try {
      writeFileSync(join(dir, 'committed.txt'), 'committed')
      git(['add', 'committed.txt'], dir)
      git(['commit', '-m', 'initial'], dir)

      writeFileSync(join(dir, 'staged.txt'), 'staged')
      git(['add', 'staged.txt'], dir)

      const output = git(['status', '--porcelain=v2', '--branch'], dir)

      expect(output).toContain('# branch.head')
      expect(output).toContain('staged.txt')
    } finally {
      cleanupTestRepo(dir)
    }
  })

  test('shows untracked files', () => {
    const dir = createTestRepo()
    try {
      writeFileSync(join(dir, 'init.txt'), 'init')
      git(['add', 'init.txt'], dir)
      git(['commit', '-m', 'initial'], dir)

      writeFileSync(join(dir, 'untracked.txt'), 'untracked')

      const output = git(['status', '--porcelain=v2', '--branch'], dir)

      expect(output).toContain('? untracked.txt')
    } finally {
      cleanupTestRepo(dir)
    }
  })
})

describe('get_branch_info format', () => {
  test('returns current branch', () => {
    const current = git(['branch', '--show-current'], TEST_CWD)
    expect(current.length).toBeGreaterThan(0)
  })

  test('lists local branches with tracking info', () => {
    const output = git(['branch', '--format=%(refname:short)|%(upstream:short)'], TEST_CWD)
    const branches = output.split('\n').filter(Boolean)

    expect(branches.length).toBeGreaterThan(0)
    // Each line should have format "name|upstream" (upstream may be empty)
    branches.forEach((line) => {
      expect(line).toContain('|')
    })
  })

  test('lists remote branches', () => {
    // This may be empty in some repos, but shouldn't throw
    const result = spawnSync('git', ['branch', '-r', '--format=%(refname:short)'], {
      encoding: 'utf8',
      cwd: TEST_CWD,
    })
    expect(result.status).toBe(0)
  })
})

describe('get_diff_summary format', () => {
  test('numstat format is parseable', () => {
    const dir = createTestRepo()
    try {
      writeFileSync(join(dir, 'file.txt'), 'original')
      git(['add', 'file.txt'], dir)
      git(['commit', '-m', 'initial'], dir)

      writeFileSync(join(dir, 'file.txt'), 'modified\nwith\nmultiple\nlines')

      const output = git(['diff', '--numstat', 'HEAD'], dir)

      // Format: added\tdeleted\tfilename
      const parts = output.split('\t')
      expect(parts.length).toBe(3)
      expect(Number.parseInt(parts[0] ?? '', 10)).toBeGreaterThan(0) // added lines
      expect(parts[2]).toBe('file.txt')
    } finally {
      cleanupTestRepo(dir)
    }
  })

  test('empty diff returns empty string', () => {
    const output = git(['diff', '--numstat', 'HEAD', 'HEAD'], TEST_CWD)
    expect(output).toBe('')
  })
})

describe('get_stash_list format', () => {
  test('empty stash returns empty', () => {
    const dir = createTestRepo()
    try {
      writeFileSync(join(dir, 'init.txt'), 'init')
      git(['add', 'init.txt'], dir)
      git(['commit', '-m', 'initial'], dir)

      const output = git(['stash', 'list', '--format=%gd|%gs|%ci'], dir)
      expect(output).toBe('')
    } finally {
      cleanupTestRepo(dir)
    }
  })

  test('stash list format is parseable', () => {
    const dir = createTestRepo()
    try {
      writeFileSync(join(dir, 'init.txt'), 'init')
      git(['add', 'init.txt'], dir)
      git(['commit', '-m', 'initial'], dir)

      writeFileSync(join(dir, 'init.txt'), 'modified')
      git(['stash', 'push', '-m', 'work in progress'], dir)

      const output = git(['stash', 'list', '--format=%gd|%gs|%ci'], dir)
      const parts = output.split('|')

      expect(parts.length).toBe(3)
      expect(parts[0]).toContain('stash@{0}')
      expect(parts[1]).toContain('work in progress')
      // parts[2] is the date
      expect(parts[2]?.length).toBeGreaterThan(0)
    } finally {
      cleanupTestRepo(dir)
    }
  })
})
