import { describe, expect, test } from 'bun:test'
import { PROTECTED_BRANCHES } from './git-policy.ts'
import {
	checkCommand,
	checkFileEdit,
	getGitSafetyMode,
	hasImplicitProtectedBranchForceLeasePush,
	hasProtectedBranchCommitAction,
	isCommitCommand,
} from './git-safety.ts'
import { extractCommandHead, splitShellSegments, tokenizeShell } from './shell-tokenizer.ts'

describe('git-safety worktree patterns', () => {
	describe('git worktree remove --force', () => {
		test.each([
			['git worktree remove foo --force'],
			['git worktree remove foo -f'],
			['git -C /repo worktree remove foo --force'],
			['git -C /repo worktree remove foo -f'],
		])('blocks: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(true)
			expect(result.reason).toContain('Force-removing a worktree')
		})

		test.each([
			['git worktree remove foo'],
			['git worktree list'],
			['echo "git worktree remove foo --force"'],
			['echo git worktree remove foo --force'],
		])('allows: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(false)
		})
	})

	describe('rm -rf .worktrees/', () => {
		test.each([
			['rm -rf /path/.worktrees/'],
			['/bin/rm -rf /path/.worktrees/'],
			['rm -rf .worktrees'],
			['rm -fr .worktrees/feat-branch'],
			['rm -r -f .worktrees'],
			['rm -f -r .worktrees/'],
			['rm -rf -- .worktrees'],
			['rm -r -f -- .worktrees/foo'],
			['rm --recursive --force .worktrees/foo'],
			['rm --recursive -f .worktrees/'],
			['rm -r --force .worktrees/bar'],
		])('blocks: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(true)
			expect(result.reason).toContain('Deleting .worktrees/ directly bypasses')
		})

		test.each([
			['rm -rf /tmp/test.worktrees-backup'],
			['rm -r .worktrees'],
			['rm .worktrees'],
			['echo rm -rf .worktrees'],
			['echo "rm -rf .worktrees"'],
		])('allows: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(false)
		})
	})
})

describe('git stash destructive operations', () => {
	describe('git stash drop', () => {
		test.each([
			['git stash drop'],
			['git stash drop stash@{0}'],
			['git stash drop stash@{2}'],
		])('blocks: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(true)
			expect(result.reason).toContain('stash drop')
		})
	})

	describe('git stash clear', () => {
		test.each([['git stash clear']])('blocks: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(true)
			expect(result.reason).toContain('stash clear')
		})
	})

	describe('safe stash operations', () => {
		test.each([
			['git stash'],
			['git stash list'],
			['git stash show'],
			['git stash show stash@{0}'],
			['git stash pop'],
			['git stash apply'],
			['git stash apply stash@{1}'],
			['git stash push -m "work in progress"'],
		])('allows: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(false)
		})
	})
})

describe('git branch force delete variants', () => {
	test.each([
		['git branch -D feature/foo'],
		['git branch --delete --force feature/foo'],
		['git branch -d -f feature/foo'],
		['git branch -df feature/foo'],
	])('blocks: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(true)
	})
})

describe('mixed-quote flag bypass attempts', () => {
	test.each([
		['git push --fo"rce" origin main'],
		["git reset --ha'rd'"],
		['git clean -f"d"'],
	])('blocks mixed-quote flag bypass: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(true)
	})
})

describe('git push --force-with-lease on protected branches', () => {
	test.each([
		['git push --force-with-lease origin main'],
		['git push --force-with-lease origin master'],
		['git push --force-if-includes origin main'],
		['git push --force-with-lease=origin/main origin main'],
		['git push --force-with-lease=refs/heads/main'],
		['git push --force-with-lease=main'],
		['git push --force-with-lease origin HEAD:refs/heads/main'],
		['git push --force-if-includes origin HEAD:refs/heads/master'],
		['git push --force-with-lease HEAD:refs/heads/main'],
		['git push --force-if-includes refs/heads/master'],
	])('blocks on protected branch: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(true)
		expect(result.reason).toContain('protected branch')
	})

	test.each([
		['git push --force-with-lease origin feat/my-feature'],
		['git push --force-with-lease origin dev'],
		['git push --force-if-includes origin feat/auth'],
		['git push --force-with-lease=origin/feat/my-feature'],
	])('allows on feature branch: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(false)
	})

	test.each([
		['git push --force-with-lease'],
		['git push --force-if-includes'],
		['git push origin --force-with-lease'],
		['git push upstream --force-if-includes'],
		['env FOO=1 git push --force-with-lease'],
		['sh -c "git push --force-if-includes"'],
	])('detects implicit lease-force push targeting upstream branch: %s', (command) => {
		expect(hasImplicitProtectedBranchForceLeasePush(command)).toBe(true)
	})

	test.each([
		['git push --force-with-lease origin feat/my-feature'],
		['git push --force-if-includes origin HEAD:feat/my-feature'],
		['git push --force-with-lease origin main'],
		['git push --force-with-lease refs/heads/main'],
	])('does not mark explicit refspec pushes as implicit: %s', (command) => {
		expect(hasImplicitProtectedBranchForceLeasePush(command)).toBe(false)
	})
})

describe('git push protected branch deletion', () => {
	test.each([
		['git push origin --delete main'],
		['git push origin --delete master'],
		['git push origin --delete refs/heads/main'],
		['git push origin --delete refs/heads/master'],
		['git push --delete main'],
		['git push --delete refs/heads/main'],
		['git push --delete=main'],
		['git push --delete=refs/heads/main'],
		['git push -d main'],
		['git push -d refs/heads/main'],
		['git push -d origin main'],
		['git push -d origin refs/heads/main'],
		['git push origin :main'],
		['git push origin :refs/heads/main'],
		['git push upstream :refs/heads/master'],
		['git push :main'],
		['git push :refs/heads/main'],
	])('blocks protected branch deletion: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(true)
		expect(result.reason).toContain('Deleting protected remote branches')
	})

	test.each([
		['git push origin --delete feat/my-feature'],
		['git push origin --delete refs/heads/feat/my-feature'],
		['git push --delete=feat/my-feature'],
		['git push -d feat/my-feature'],
		['git push -d origin feat/my-feature'],
		['git push origin :feat/my-feature'],
	])('allows non-protected branch deletion: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(false)
	})
})

describe('git push force by +refspec', () => {
	test.each([
		['git push +HEAD:refs/heads/main'],
		['git push origin +HEAD:refs/heads/main'],
		['git push +main'],
	])('blocks force push via +refspec: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(true)
		expect(result.reason).toContain('Force push')
	})
})

describe('git push mirror/prune protections', () => {
	test.each([
		['git push --mirror origin'],
		['git push --mirror'],
		['git push --prune origin'],
		['git push --prune'],
	])('blocks destructive push mode: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(true)
		expect(result.reason).toMatch(/--mirror|--prune/)
	})
})

describe('protected-branch commit action detection', () => {
	test.each([
		['git commit -m "feat: x"'],
		['env FOO=1 git commit -m "feat: x"'],
		['sh -c "git commit -m \'feat: x\'"'],
		['git cherry-pick abc123'],
		['env FOO=1 git cherry-pick abc123'],
		['git revert abc123'],
		['git merge feature/foo'],
		['git merge --no-ff feature/foo'],
		['git merge --commit feature/foo'],
	])('detects commit-creating action: %s', (command) => {
		expect(hasProtectedBranchCommitAction(command)).toBe(true)
	})

	test.each([
		['git cherry-pick -n abc123'],
		['git cherry-pick --no-commit abc123'],
		['git cherry-pick --abort'],
		['git cherry-pick --continue'],
		['git revert --abort'],
		['git revert --continue'],
		['git revert -n abc123'],
		['git revert --no-commit abc123'],
		['git merge --squash feature/foo'],
		['git merge --no-commit feature/foo'],
		['git merge --ff-only feature/foo'],
		['git merge --abort'],
		['git merge --continue'],
		['git status'],
	])('does not detect non-commit action: %s', (command) => {
		expect(hasProtectedBranchCommitAction(command)).toBe(false)
	})
})

describe('git history/ref destructive operations', () => {
	describe('git filter-branch', () => {
		test.each([
			['git filter-branch --tree-filter "rm -rf secrets" -- --all'],
			['git filter-branch --env-filter "export GIT_AUTHOR_NAME=x" HEAD'],
			['git -C /repo filter-branch --subdirectory-filter dir -- --all'],
		])('blocks: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(true)
			expect(result.reason).toContain('filter-branch')
		})
	})

	describe('git reflog expire', () => {
		test.each([
			['git reflog expire --expire=now --all'],
			['git reflog expire --expire=all'],
			['git reflog expire --expire=now refs/heads/main'],
			['git -C /repo reflog expire --expire=now'],
		])('blocks: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(true)
			expect(result.reason).toContain('reflog expire')
		})

		test.each([
			['git reflog'],
			['git reflog show'],
			['git reflog show HEAD'],
		])('allows: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(false)
		})
	})

	describe('git update-ref -d/--delete', () => {
		test.each([
			['git update-ref -d refs/heads/feature/foo'],
			['git update-ref --delete refs/tags/v1'],
			['git -C /repo update-ref -d HEAD'],
			['git update-ref --delete refs/heads/main'],
		])('blocks: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(true)
			expect(result.reason).toContain('update-ref')
		})

		test.each([
			['git update-ref refs/heads/main abc123'],
			['git update-ref refs/tags/v2 abc123'],
		])('allows: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(false)
		})
	})

	describe('git gc --prune=now/all', () => {
		test.each([
			['git gc --prune=now'],
			['git gc --prune=all'],
			['git gc --aggressive --prune=now'],
			['git -C /repo gc --prune=now'],
		])('blocks: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(true)
			expect(result.reason).toContain('gc --prune=now')
		})

		test.each([
			['git gc'],
			['git gc --aggressive'],
			['git gc --auto'],
			['git gc --prune=2weeks'],
		])('allows: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(false)
		})
	})
})

describe('git reset --merge', () => {
	test.each([
		['git reset --merge'],
		['git reset --merge HEAD~1'],
		['git reset --merge abc123'],
		['git -C /repo reset --merge'],
	])('blocks: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(true)
		expect(result.reason).toContain('reset --merge')
	})

	test.each([
		['git reset --soft HEAD~1'],
		['git reset --mixed HEAD~1'],
		['git reset HEAD~1'],
		['git reset'],
	])('allows: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(false)
	})
})

describe('git checkout <ref> -- <path>', () => {
	test.each([
		['git checkout HEAD -- file.txt'],
		['git checkout abc123 -- src/'],
		['git checkout main -- package.json'],
		['git checkout HEAD -- src/index.ts'],
		['git checkout -- file.txt'],
	])('blocks: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(true)
		expect(result.reason).toContain('checkout')
	})

	test.each([
		['git checkout HEAD file.txt'],
		['git checkout main src/'],
		['git checkout abc123 lib/utils.ts'],
	])('blocks ref + path without --: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(true)
		expect(result.reason).toContain('checkout')
	})

	test.each([
		['git checkout feature-branch'],
		['git checkout -b new-branch'],
		['git checkout -b feat/auth main'],
		['git checkout -b new-branch base-branch'],
	])('allows: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(false)
	})
})

describe('git rebase --exec with destructive commands', () => {
	test.each([
		['git rebase --exec "git reset --hard" HEAD~3'],
		['git rebase -x "git clean -f" HEAD~2'],
		['git rebase --exec="git push --force" main'],
	])('blocks: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(true)
		expect(result.reason).toContain('rebase --exec')
	})

	test.each([
		['git rebase --exec "echo test" HEAD~3'],
		['git rebase main'],
		['git rebase --continue'],
		['git rebase --abort'],
	])('allows: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(false)
	})
})

describe('git restore destructive operations', () => {
	test.each([
		['git restore file.txt'],
		['git restore src/index.ts'],
		['git restore src/'],
	])('blocks restore <path> without --staged: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(true)
		expect(result.reason).toContain('restore')
	})

	test.each([
		['git restore --source=HEAD file.txt'],
		['git restore --source=main src/index.ts'],
		['git restore --source HEAD -- file.txt'],
	])('blocks restore --source with paths: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(true)
		expect(result.reason).toContain('restore')
	})

	test.each([
		['git restore --staged file.txt'],
		['git restore --staged src/index.ts'],
		['git restore -S file.txt'],
	])('allows restore --staged: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(false)
	})
})

describe('find destructive operations', () => {
	describe('find -delete', () => {
		test.each([
			['find . -name "*.log" -delete'],
			['/usr/bin/find . -name "*.log" -delete'],
			['find /tmp -type f -delete'],
			['find . -empty -delete'],
		])('blocks: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(true)
			expect(result.reason).toContain('find')
		})
	})

	describe('find -exec rm', () => {
		test.each([
			['find /tmp -exec rm {} \\;'],
			['/usr/bin/find /tmp -exec /bin/rm {} \\;'],
			['find . -exec rm -f {} +'],
			['find . -name "*.tmp" -exec rm -rf {} \\;'],
		])('blocks: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(true)
			expect(result.reason).toContain('find')
		})
	})

	describe('safe find operations', () => {
		test.each([
			['find . -name "*.ts"'],
			['find . -type f -print'],
			['find . -name "*.log" -print0'],
			['find . -maxdepth 1 -type d'],
		])('allows: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(false)
		})
	})
})

describe('isCommitCommand', () => {
	test.each([
		['git commit -m "feat: test"', true],
		['git status', false],
		['echo git commit -m "feat: test"', false],
		['git add . && git commit -m "feat: test"', true],
	])('detects commit command: %s', (command, expected) => {
		const result = isCommitCommand(command)
		expect(result.isCommit).toBe(expected)
	})

	test.each([
		['git commit --no-verify -m "feat: test"', true],
		['git commit -n -m "feat: test"', true],
		['git commit -m "feat: test"', false],
	])('detects no-verify flags: %s', (command, expected) => {
		const result = isCommitCommand(command)
		expect(result.hasNoVerify).toBe(expected)
	})

	test.each([
		['git commit --no-verify -m "chore(wip): checkpoint"', true],
		['git commit -n -m "wip: checkpoint"', true],
		['git commit -n -m "feat: checkpoint"', false],
	])('detects WIP messages: %s', (command, expected) => {
		const result = isCommitCommand(command)
		expect(result.hasWipMessage).toBe(expected)
	})
})

// ---------------------------------------------------------------------------
// Issue 1: Heredoc false positives
// ---------------------------------------------------------------------------
describe('issue 1: heredoc body excluded from flag scanning', () => {
	test('heredoc mentioning --no-verify does not trigger hasNoVerify', () => {
		const cmd = `git commit -F - <<'EOF'\nThis mentions --no-verify\nEOF`
		const result = isCommitCommand(cmd)
		expect(result.isCommit).toBe(true)
		expect(result.hasNoVerify).toBe(false)
	})

	test('heredoc inside $() does not trigger false positive on --no-verify text', () => {
		const cmd = `git commit -m "$(cat <<'EOF'\n--no-verify text\nEOF\n)"`
		const result = isCommitCommand(cmd)
		expect(result.isCommit).toBe(true)
		expect(result.hasNoVerify).toBe(false)
	})

	test('heredoc mentioning blocked pattern does not trigger block', () => {
		const cmd = `cat <<'EOF'\ngit reset --hard HEAD\nEOF`
		const result = checkCommand(cmd)
		expect(result.blocked).toBe(false)
	})

	test('heredoc inside $() inside double quotes is not reported as unbalanced', () => {
		const cmd = `git commit -m "$(cat <<'EOF'\nCommit message here.\nEOF\n)"`
		const result = checkCommand(cmd)
		expect(result.blocked).toBe(false)
	})

	test('blocked patterns in heredoc commit message body are not incorrectly blocked', () => {
		const cmd = `git commit -m "$(cat <<'EOF'\nfix(hooks): prevent false positives\n\nThe --no-verify flag should only be used for WIP commits.\nNever use git push --force on shared branches.\nEOF\n)"`
		const result = checkCommand(cmd)
		expect(result.blocked).toBe(false)
		const commit = isCommitCommand(cmd)
		expect(commit.isCommit).toBe(true)
		expect(commit.hasNoVerify).toBe(false)
	})

	test('heredoc commit via $() with unquoted delimiter also works', () => {
		const cmd = `git commit -m "$(cat <<EOF\nSome message with --force text.\nEOF\n)"`
		const result = checkCommand(cmd)
		expect(result.blocked).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Issue 2: || chaining bypass
// ---------------------------------------------------------------------------
describe('issue 2: || recognized as segment boundary', () => {
	test('git diff --quiet || git commit detects commit', () => {
		const result = isCommitCommand('git diff --quiet || git commit -m "auto"')
		expect(result.isCommit).toBe(true)
	})

	test('test -f lock || git commit detects commit', () => {
		const result = isCommitCommand('test -f lock || git commit -m "safe"')
		expect(result.isCommit).toBe(true)
	})

	test('|| chained destructive command is still blocked', () => {
		const result = checkCommand('echo ok || git reset --hard')
		expect(result.blocked).toBe(true)
	})

	test('scans all chained commit segments for --no-verify usage', () => {
		const result = isCommitCommand(
			'git commit -m "ok" && git commit --no-verify -m "feat: skip hooks"',
		)
		expect(result.isCommit).toBe(true)
		expect(result.hasNoVerify).toBe(true)
		expect(result.hasWipMessage).toBe(false)
	})

	test('all --no-verify commits must be WIP to be considered legitimate', () => {
		const result = isCommitCommand(
			'git commit -n -m "wip: checkpoint" && git commit --no-verify -m "feat: real change"',
		)
		expect(result.isCommit).toBe(true)
		expect(result.hasNoVerify).toBe(true)
		expect(result.hasWipMessage).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Issue 3: Quoted echo false positives
// ---------------------------------------------------------------------------
describe('issue 3: quoted content does not trigger false positives', () => {
	test.each([
		['echo "git reset --hard HEAD"'],
		['echo "git stash drop"'],
		['echo "git clean -f ."'],
		['echo "find . -delete"'],
		['echo "git push --force"'],
		['echo "git branch -D feature"'],
		['printf git reset --hard'],
	])('allows: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(false)
	})

	test('unquoted destructive commands are still blocked', () => {
		expect(checkCommand('git reset --hard').blocked).toBe(true)
		expect(checkCommand('git stash drop').blocked).toBe(true)
		expect(checkCommand('git clean -f .').blocked).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// Issue 4: git global options must not bypass protections
// ---------------------------------------------------------------------------
describe('issue 4: git global options do not bypass safety checks', () => {
	test.each([
		['git -C /repo reset --hard'],
		['/usr/bin/git reset --hard'],
		['git reset "--hard"'],
		['git -c core.autocrlf=false clean -fd'],
		['/opt/homebrew/bin/git push --force origin main'],
		['git push "--force" origin main'],
		['git --git-dir=.git --work-tree=. stash drop'],
	])('blocks destructive git command with globals: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(true)
	})

	test.each([
		['git -C /repo commit -m "feat: test"', true],
		['/usr/bin/git commit -m "feat: test"', true],
		['git -c core.editor=true commit -n -m "wip: checkpoint"', true],
		['git diff --quiet || git -C /repo commit -m "feat: test"', true],
		['env FOO=1 git commit -m "feat: test"', true],
		['env -u CI git commit --no-verify -m "chore(wip): checkpoint"', true],
		['command git commit -m "feat: test"', true],
		['time git commit -m "feat: test"', true],
		['time -f %E git commit -m "feat: test"', true],
		['time -o /tmp/t.log git commit -m "feat: test"', true],
		['nice -n 10 git commit -m "feat: test"', true],
		['nohup git commit -m "feat: test"', true],
		['sudo git commit -m "feat: test"', true],
		['sudo -u root git commit -m "feat: test"', true],
		['sudo --user root git commit -m "feat: test"', true],
		['sudo --user=root git commit -m "feat: test"', true],
		['stdbuf -o0 git commit -m "feat: test"', true],
	])('detects commit command with globals/chaining: %s', (command, expected) => {
		const result = isCommitCommand(command)
		expect(result.isCommit).toBe(expected)
	})

	test('commit message mentioning --no-verify does not count as bypass flag', () => {
		const result = isCommitCommand('git commit -m "docs: explain when to use --no-verify"')
		expect(result.isCommit).toBe(true)
		expect(result.hasNoVerify).toBe(false)
	})

	test('quoted --no-verify flag is still detected', () => {
		const result = isCommitCommand('git commit "--no-verify" -m "feat: x"')
		expect(result.isCommit).toBe(true)
		expect(result.hasNoVerify).toBe(true)
	})

	test('wip text in unrelated args does not allow --no-verify', () => {
		const result = isCommitCommand(
			'git commit --no-verify --author "wip: bot <bot@example.com>" -m "feat: real change"',
		)
		expect(result.isCommit).toBe(true)
		expect(result.hasNoVerify).toBe(true)
		expect(result.hasWipMessage).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Issue 4b: ANSI-C quoting ($'...') must not bypass safety checks
// ---------------------------------------------------------------------------
describe('issue 4b: ANSI-C quoting does not bypass safety checks', () => {
	test.each([
		["git reset $'--hard'"],
		["git push $'--force'"],
		["git clean $'-f'"],
		["git clean $'-fd'"],
		// ANSI-C hex/octal escape expansion
		["git reset $'--ha\\x72d'"], // \x72 = 'r' -> --hard
		["git push $'--fo\\x72ce'"], // \x72 = 'r' -> --force
		["git reset $'--ha\\162d'"], // octal \162 = 'r' -> --hard
		["git clean $'-\\x66d'"], // \x66 = 'f' -> -fd
	])('blocks: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// Issue 055: backslash-escaped flags must not bypass safety checks
// ---------------------------------------------------------------------------
describe('issue 055: backslash escapes do not bypass safety checks', () => {
	test.each([
		['git reset \\--hard'],
		['git push \\--force origin main'],
		['git clean \\-f'],
		['git clean \\-fd'],
		['git checkout \\-- .'],
	])('blocks: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(true)
	})

	test.each([
		['git commit -m "escaped \\n newline"'],
		['git log --oneline'],
	])('allows: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Issue 5: wrapper/subshell bypasses
// ---------------------------------------------------------------------------
describe('issue 5: shell indirection does not bypass safety checks', () => {
	test.each([
		['sh -c "git reset --hard"'],
		['bash -lc "git clean -fd"'],
		['dash -c "git push --force origin main"'],
		['ksh -c "git reset --hard"'],
		['env git reset --hard'],
		['env --chdir /tmp git reset --hard'],
		['env -C /tmp git reset --hard'],
		['env -a myname git reset --hard'],
		['env --argv0=myname git reset --hard'],
		['command git reset --hard'],
		['time git clean -fd'],
		['time -f %E git clean -fd'],
		['nice -n 5 git push --force origin main'],
		['nohup git reset --hard'],
		['sudo git reset --hard'],
		['sudo -u root git reset --hard'],
		['sudo --user root git reset --hard'],
		['stdbuf -o0 git reset --hard'],
		['chrt -r 1 git reset --hard'],
		['ionice -c3 git reset --hard'],
		['setsid git reset --hard'],
		["bash <<'EOF'\ngit reset --hard\nEOF"],
		['ksh <<EOF\ngit push --force origin main\nEOF'],
		['fish -c "git reset --hard"'],
		['pwsh -c "git reset --hard"'],
		['python - <<\'PY\'\nimport os\nos.system("git reset --hard")\nPY'],
		['eval "git push --force origin main"'],
		['python -c "import os; os.system(\'git push --force origin main\')"'],
		["node -e \"require('child_process').execSync('git reset --hard')\""],
		['ruby -e "system(\'git clean -fd\')"'],
		['printf "%s\\n" "git push --delete=main" | sh'],
		['printf "%s\\n" "git push --delete=main" | bash -s'],
		['printf "%s\\n" "git push --delete=main" | xargs -I{} sh -c "{}"'],
		['printf "%s\\n" "git push --delete=main" | xargs -I{} bash -lc "{}"'],
		['printf "%s\\n" "foo" | xargs git reset --hard'],
		['echo "$(git reset --hard)"'],
		['echo `git clean -fd`'],
	])('blocks destructive command via indirection: %s', (command) => {
		const result = checkCommand(command)
		expect(result.blocked).toBe(true)
	})

	test('unbalanced shell input fails closed', () => {
		const result = checkCommand('git reset --hard "unterminated')
		expect(result.blocked).toBe(true)
		expect(result.reason).toContain('Unbalanced shell input')
	})

	test('excessive shell nesting fails closed', () => {
		const result = checkCommand(
			'sh -c "sh -c \\"sh -c \\\\\\"sh -c \\\\\\\\\\\\\\"sh -c \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\"git reset --hard\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\"\\\\\\\\\\\\\\"\\\\\\\\"\\\\""',
		)
		expect(result.blocked).toBe(true)
		expect(result.reason ?? '').toMatch(/nesting too deep|Unbalanced shell input/i)
	})
})

// ---------------------------------------------------------------------------
// Fail-closed on unbalanced input
// ---------------------------------------------------------------------------
describe('unbalanced shell input', () => {
	test('unterminated double quote is unbalanced', () => {
		const result = splitShellSegments('git commit -m "unterminated')
		expect(result.unbalanced).toBe(true)
	})

	test('unterminated single quote is unbalanced', () => {
		const result = splitShellSegments("git commit -m 'unterminated")
		expect(result.unbalanced).toBe(true)
	})

	test('balanced quotes are not unbalanced', () => {
		const result = splitShellSegments('git commit -m "balanced"')
		expect(result.unbalanced).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// tokenizeShell unit tests
// ---------------------------------------------------------------------------
describe('tokenizeShell', () => {
	test('splits simple chained commands', () => {
		const { tokens, unbalanced } = tokenizeShell('git add . && git commit')
		expect(unbalanced).toBe(false)
		const ops = tokens.filter((t) => t.type === 'operator')
		expect(ops).toHaveLength(1)
		expect(ops[0]?.value).toBe('&&')
	})

	test('recognizes || operator', () => {
		const { tokens } = tokenizeShell('test -f x || echo fallback')
		const ops = tokens.filter((t) => t.type === 'operator')
		expect(ops).toHaveLength(1)
		expect(ops[0]?.value).toBe('||')
	})

	test('recognizes ; operator', () => {
		const { tokens } = tokenizeShell('echo a; echo b')
		const ops = tokens.filter((t) => t.type === 'operator')
		expect(ops).toHaveLength(1)
		expect(ops[0]?.value).toBe(';')
	})

	test('operators inside double quotes are not operators', () => {
		const { tokens } = tokenizeShell('echo "a && b || c; d"')
		const ops = tokens.filter((t) => t.type === 'operator')
		expect(ops).toHaveLength(0)
	})

	test('operators inside single quotes are not operators', () => {
		const { tokens } = tokenizeShell("echo 'a && b'")
		const ops = tokens.filter((t) => t.type === 'operator')
		expect(ops).toHaveLength(0)
	})

	test('heredoc body is emitted as heredoc-body token', () => {
		const { tokens, unbalanced } = tokenizeShell('cat <<EOF\nhello world\nEOF')
		expect(unbalanced).toBe(false)
		const heredocs = tokens.filter((t) => t.type === 'heredoc-body')
		expect(heredocs).toHaveLength(1)
		expect(heredocs[0]?.value).toContain('hello world')
	})

	test('quoted heredoc delimiter works', () => {
		const { tokens, unbalanced } = tokenizeShell("cat <<'EOF'\nsome $variable\nEOF")
		expect(unbalanced).toBe(false)
		const heredocs = tokens.filter((t) => t.type === 'heredoc-body')
		expect(heredocs).toHaveLength(1)
		expect(heredocs[0]?.value).toContain('some $variable')
	})

	test('pipe is recognized as operator', () => {
		const { tokens } = tokenizeShell('cat file | grep pattern')
		const ops = tokens.filter((t) => t.type === 'operator')
		expect(ops).toHaveLength(1)
		expect(ops[0]?.value).toBe('|')
	})
})

// ---------------------------------------------------------------------------
// splitShellSegments unit tests
// ---------------------------------------------------------------------------
describe('splitShellSegments', () => {
	test('single command returns one segment', () => {
		const { segments } = splitShellSegments('git status')
		expect(segments).toEqual(['git status'])
	})

	test('&& splits into two segments', () => {
		const { segments } = splitShellSegments('git add . && git commit -m "x"')
		expect(segments).toHaveLength(2)
		expect(segments[0]).toBe('git add .')
		expect(segments[1]).toBe('git commit -m "x"')
	})

	test('|| splits into two segments', () => {
		const { segments } = splitShellSegments('test -f x || git commit -m "y"')
		expect(segments).toHaveLength(2)
	})

	test('; splits into two segments', () => {
		const { segments } = splitShellSegments('echo a; echo b')
		expect(segments).toHaveLength(2)
	})

	test('heredoc body excluded from segments', () => {
		const { segments } = splitShellSegments("git commit -F - <<'EOF'\n--no-verify in body\nEOF")
		// The heredoc body should not appear in any segment
		for (const seg of segments) {
			expect(seg).not.toContain('--no-verify in body')
		}
	})
})

// ---------------------------------------------------------------------------
// extractCommandHead unit tests
// ---------------------------------------------------------------------------
describe('extractCommandHead', () => {
	test('extracts git from git commit', () => {
		expect(extractCommandHead('git commit -m "test"')).toBe('git')
	})

	test('extracts echo from echo command', () => {
		expect(extractCommandHead('echo "hello"')).toBe('echo')
	})

	test('skips env var assignments', () => {
		expect(extractCommandHead('FOO=bar git commit')).toBe('git')
	})

	test('skips multiple env vars', () => {
		expect(extractCommandHead('HOME=/tmp PATH=/bin git status')).toBe('git')
	})

	test('returns null for empty string', () => {
		expect(extractCommandHead('')).toBe(null)
	})
})

// ---------------------------------------------------------------------------
// checkFileEdit: .env pattern tests
// ---------------------------------------------------------------------------
describe('checkFileEdit .env pattern', () => {
	test.each([
		['.env'],
		['.env.local'],
		['.env.production'],
		['config/.env'],
		['config/.env.local'],
		['.env/secrets'],
		['config\\.env'],
		['config\\.env.local'],
	])('blocks: %s', (filePath) => {
		const result = checkFileEdit(filePath)
		expect(result.blocked).toBe(true)
		expect(result.reason).toContain('.env')
	})
})

describe('checkFileEdit .git pattern', () => {
	test.each([
		['.git/config'],
		['repo/.git/hooks/pre-commit'],
		['C:\\repo\\.git\\config'],
	])('blocks: %s', (filePath) => {
		const result = checkFileEdit(filePath)
		expect(result.blocked).toBe(true)
		expect(result.reason).toContain('.git')
	})
})

describe('getGitSafetyMode', () => {
	test('defaults to strict', () => {
		expect(getGitSafetyMode({})).toBe('strict')
		expect(getGitSafetyMode({ CLAUDE_GIT_SAFETY_MODE: undefined })).toBe('strict')
	})

	test('parses commit-guard', () => {
		expect(getGitSafetyMode({ CLAUDE_GIT_SAFETY_MODE: 'commit-guard' })).toBe('commit-guard')
		expect(getGitSafetyMode({ CLAUDE_GIT_SAFETY_MODE: ' COMMIT-GUARD ' })).toBe('commit-guard')
	})

	test('parses advisory', () => {
		expect(getGitSafetyMode({ CLAUDE_GIT_SAFETY_MODE: 'advisory' })).toBe('advisory')
		expect(getGitSafetyMode({ CLAUDE_GIT_SAFETY_MODE: ' Advisory ' })).toBe('advisory')
	})

	test('falls back to strict on unknown values', () => {
		expect(getGitSafetyMode({ CLAUDE_GIT_SAFETY_MODE: 'off' })).toBe('strict')
		expect(getGitSafetyMode({ CLAUDE_GIT_SAFETY_MODE: 'permissive' })).toBe('strict')
	})
})

function simulateModeDecision(
	command: string,
	mode: 'strict' | 'commit-guard' | 'advisory',
	branch: string | null,
): { denied: boolean; warned: boolean } {
	const commandResult = checkCommand(command)
	const commitCheck = isCommitCommand(command, commandResult.segments)
	const hasCommitAction = hasProtectedBranchCommitAction(command, commandResult.segments)
	const hasImplicitForceLeasePush = hasImplicitProtectedBranchForceLeasePush(
		command,
		commandResult.segments,
	)
	const isProtected = branch ? PROTECTED_BRANCHES.includes(branch) : false

	if (mode === 'strict' && commandResult.blocked) {
		return { denied: true, warned: false }
	}

	if (mode !== 'advisory' && isProtected && (hasCommitAction || hasImplicitForceLeasePush)) {
		return { denied: true, warned: false }
	}

	if (mode !== 'advisory' && commitCheck.isCommit) {
		const isLegitimateWip = commitCheck.hasNoVerify && commitCheck.hasWipMessage
		if (commitCheck.hasNoVerify && !isLegitimateWip) {
			return { denied: true, warned: false }
		}
	}

	return { denied: false, warned: commandResult.blocked }
}

describe('runtime mode behavior', () => {
	test('strict denies destructive commands', () => {
		const result = simulateModeDecision('git reset --hard', 'strict', 'feature/foo')
		expect(result.denied).toBe(true)
		expect(result.warned).toBe(false)
	})

	test('commit-guard allows destructive commands but warns', () => {
		const result = simulateModeDecision('git reset --hard', 'commit-guard', 'feature/foo')
		expect(result.denied).toBe(false)
		expect(result.warned).toBe(true)
	})

	test('commit-guard blocks commits on protected branches', () => {
		const result = simulateModeDecision('git commit -m "feat: x"', 'commit-guard', 'main')
		expect(result.denied).toBe(true)
	})

	test('commit-guard blocks non-WIP --no-verify commits', () => {
		const result = simulateModeDecision(
			'git commit --no-verify -m "feat: x"',
			'commit-guard',
			'feature/foo',
		)
		expect(result.denied).toBe(true)
	})

	test('advisory never denies protected-branch commit attempts', () => {
		const result = simulateModeDecision('git commit -m "feat: x"', 'advisory', 'main')
		expect(result.denied).toBe(false)
	})

	test('advisory allows destructive commands with warnings', () => {
		const result = simulateModeDecision('git clean -fd', 'advisory', 'main')
		expect(result.denied).toBe(false)
		expect(result.warned).toBe(true)
	})
})
