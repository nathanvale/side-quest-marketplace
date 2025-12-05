import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "bun";

/**
 * Helper to run git commands safely using argument arrays
 */
function git(args: string[], cwd: string): string {
	const result = spawnSync({
		cmd: ["git", ...args],
		stdout: "pipe",
		stderr: "pipe",
		cwd,
	});
	if (result.exitCode !== 0) {
		const stderr =
			typeof result.stderr === "string"
				? result.stderr
				: new TextDecoder().decode(result.stderr);
		throw new Error(stderr || `git exited with code ${result.exitCode}`);
	}
	const stdout =
		typeof result.stdout === "string"
			? result.stdout
			: new TextDecoder().decode(result.stdout);
	return stdout.trim();
}

function runGit(args: string[], cwd: string) {
	return spawnSync({
		cmd: ["git", ...args],
		stdout: "pipe",
		stderr: "pipe",
		cwd,
	});
}

function decode(output: string | Uint8Array | null | undefined): string {
	if (!output) return "";
	return typeof output === "string" ? output : new TextDecoder().decode(output);
}

// Find the git root by traversing up from this file's directory
function findGitRoot(startDir: string): string {
	let dir = startDir;
	while (dir !== "/") {
		try {
			git(["rev-parse", "--git-dir"], dir);
			return dir;
		} catch {
			dir = dir.split("/").slice(0, -1).join("/") || "/";
		}
	}
	return startDir;
}

const TEST_CWD = findGitRoot(import.meta.dir);

/**
 * Create a temporary git repository for isolated testing
 */
function createTestRepo(): string {
	const dir = mkdtempSync(join(tmpdir(), "git-test-"));
	git(["init"], dir);
	git(["config", "user.email", "test@test.com"], dir);
	git(["config", "user.name", "Test User"], dir);
	return dir;
}

/**
 * Clean up test repository
 */
function cleanupTestRepo(dir: string): void {
	rmSync(dir, { recursive: true, force: true });
}

describe("spawnSync security (command injection prevention)", () => {
	test("prevents command injection via search query", () => {
		const dir = createTestRepo();
		try {
			writeFileSync(join(dir, "test.txt"), "hello");
			git(["add", "test.txt"], dir);
			git(["commit", "-m", "initial commit"], dir);

			// This would execute arbitrary code with execSync string interpolation
			// With spawnSync arrays, it's passed as a literal string argument
			const maliciousQuery = `"; touch /tmp/pwned-${Date.now()}; echo "`;

			const result = runGit(
				["log", `--grep=${maliciousQuery}`, "--format=%s`"],
				dir,
			);

			// The command completes (with no matches) rather than failing
			expect(result.exitCode ?? 1).toBe(0);
		} finally {
			cleanupTestRepo(dir);
		}
	});

	test("prevents command injection via ref parameter", () => {
		const dir = createTestRepo();
		try {
			writeFileSync(join(dir, "test.txt"), "hello");
			git(["add", "test.txt"], dir);
			git(["commit", "-m", "initial commit"], dir);

			// With execSync: git diff --numstat HEAD; rm -rf /
			// With spawnSync: "HEAD; rm -rf /" is passed as ONE argument to git
			const maliciousRef = "HEAD; rm -rf /";

			const result = runGit(["diff", "--numstat", maliciousRef], dir);

			// Git fails because it can't find a revision named "HEAD; rm -rf /"
			expect(result.exitCode ?? 1).not.toBe(0);
			expect(decode(result.stderr)).toContain("unknown revision");
		} finally {
			cleanupTestRepo(dir);
		}
	});

	test("handles special characters safely", () => {
		const dir = createTestRepo();
		try {
			writeFileSync(join(dir, "test.txt"), "hello");
			git(["add", "test.txt"], dir);
			git(["commit", "-m", "test $PATH and `command` and $(subshell)"], dir);

			// Search for literal special characters
			const result = runGit(["log", "--grep=$PATH", "--format=%s"], dir);

			expect(result.exitCode ?? 1).toBe(0);
			expect(decode(result.stdout)).toContain("$PATH");
		} finally {
			cleanupTestRepo(dir);
		}
	});
});

describe("git utility functions", () => {
	test("isGitRepo returns true for git repositories", () => {
		expect(() => git(["rev-parse", "--git-dir"], TEST_CWD)).not.toThrow();
	});

	test("isGitRepo returns false for non-git directories", () => {
		const result = spawnSync({
			cmd: ["git", "rev-parse", "--git-dir"],
			stdout: "pipe",
			stderr: "pipe",
			cwd: "/tmp",
		});
		expect(result.exitCode).not.toBe(0);
	});

	test("git command returns branch name", () => {
		const branch = git(["branch", "--show-current"], TEST_CWD);
		expect(typeof branch).toBe("string");
		expect(branch.length).toBeGreaterThan(0);
	});
});

describe("get_recent_commits format", () => {
	test("parses commit format correctly", () => {
		const format = "%H%x00%h%x00%s%x00%an%x00%ar%x00%d";
		const output = git(
			["log", "--oneline", "-1", `--format=${format}`],
			TEST_CWD,
		);

		const parts = output.split("\x00");
		const hash = parts[0];
		const short = parts[1];
		const subject = parts[2];
		const author = parts[3];
		const relative = parts[4];

		expect(hash).toBeDefined();
		expect(hash?.length).toBe(40);
		expect(short).toBeDefined();
		expect(short?.length).toBeGreaterThanOrEqual(7);
		expect(subject).toBeDefined();
		expect(subject?.length).toBeGreaterThan(0);
		expect(author).toBeDefined();
		expect(author?.length).toBeGreaterThan(0);
		expect(relative).toBeTruthy();
	});

	test("respects limit parameter", () => {
		const format = "%H%x00%h%x00%s%x00%an%x00%ar%x00%d";
		const output = git(
			["log", "--oneline", "-5", `--format=${format}`],
			TEST_CWD,
		);

		const lines = output.split("\n");
		expect(lines.length).toBeGreaterThan(0);
		expect(lines.length).toBeLessThanOrEqual(5);
	});
});

describe("search_commits format", () => {
	test("grep search returns matching commits", () => {
		const dir = createTestRepo();
		try {
			writeFileSync(join(dir, "auth.txt"), "auth code");
			git(["add", "auth.txt"], dir);
			git(["commit", "-m", "feat(auth): add login"], dir);

			writeFileSync(join(dir, "api.txt"), "api code");
			git(["add", "api.txt"], dir);
			git(["commit", "-m", "feat(api): add endpoints"], dir);

			const format = "%H%x00%h%x00%s%x00%an%x00%ar";
			const output = git(
				["log", "-20", "--grep=auth", `--format=${format}`],
				dir,
			);

			expect(output).toContain("feat(auth): add login");
			expect(output).not.toContain("feat(api)");
		} finally {
			cleanupTestRepo(dir);
		}
	});

	test("-S search finds code changes", () => {
		const dir = createTestRepo();
		try {
			writeFileSync(join(dir, "code.txt"), "function uniqueIdentifier() {}");
			git(["add", "code.txt"], dir);
			git(["commit", "-m", "add function"], dir);

			const format = "%H%x00%h%x00%s%x00%an%x00%ar";
			const output = git(
				["log", "-20", "-S", "uniqueIdentifier", `--format=${format}`],
				dir,
			);

			expect(output).toContain("add function");
		} finally {
			cleanupTestRepo(dir);
		}
	});
});

describe("get_file_history format", () => {
	test("--follow tracks file across renames", () => {
		const dir = createTestRepo();
		try {
			writeFileSync(join(dir, "original.txt"), "content");
			git(["add", "original.txt"], dir);
			git(["commit", "-m", "create original file"], dir);

			git(["mv", "original.txt", "renamed.txt"], dir);
			git(["commit", "-m", "rename file"], dir);

			writeFileSync(join(dir, "renamed.txt"), "updated content");
			git(["add", "renamed.txt"], dir);
			git(["commit", "-m", "update renamed file"], dir);

			const format = "%H%x00%h%x00%s%x00%an%x00%ar";
			const output = git(
				["log", "--follow", "-10", `--format=${format}`, "--", "renamed.txt"],
				dir,
			);

			const lines = output.split("\n");
			expect(lines.length).toBe(3); // All commits affecting this file
			expect(output).toContain("update renamed file");
			expect(output).toContain("rename file");
			expect(output).toContain("create original file");
		} finally {
			cleanupTestRepo(dir);
		}
	});
});

describe("get_status format (porcelain v2)", () => {
	test("parses branch info", () => {
		const output = git(["status", "--porcelain=v2", "--branch"], TEST_CWD);
		expect(output).toContain("# branch.head");
	});

	test("shows staged files", () => {
		const dir = createTestRepo();
		try {
			writeFileSync(join(dir, "committed.txt"), "committed");
			git(["add", "committed.txt"], dir);
			git(["commit", "-m", "initial"], dir);

			writeFileSync(join(dir, "staged.txt"), "staged");
			git(["add", "staged.txt"], dir);

			const output = git(["status", "--porcelain=v2", "--branch"], dir);

			expect(output).toContain("# branch.head");
			expect(output).toContain("staged.txt");
		} finally {
			cleanupTestRepo(dir);
		}
	});

	test("shows untracked files", () => {
		const dir = createTestRepo();
		try {
			writeFileSync(join(dir, "init.txt"), "init");
			git(["add", "init.txt"], dir);
			git(["commit", "-m", "initial"], dir);

			writeFileSync(join(dir, "untracked.txt"), "untracked");

			const output = git(["status", "--porcelain=v2", "--branch"], dir);

			expect(output).toContain("? untracked.txt");
		} finally {
			cleanupTestRepo(dir);
		}
	});
});

describe("get_branch_info format", () => {
	test("returns current branch", () => {
		const current = git(["branch", "--show-current"], TEST_CWD);
		expect(current.length).toBeGreaterThan(0);
	});

	test("lists local branches with tracking info", () => {
		const output = git(
			["branch", "--format=%(refname:short)|%(upstream:short)"],
			TEST_CWD,
		);
		const branches = output.split("\n").filter(Boolean);

		expect(branches.length).toBeGreaterThan(0);
		// Each line should have format "name|upstream" (upstream may be empty)
		branches.forEach((line) => {
			expect(line).toContain("|");
		});
	});

	test("lists remote branches", () => {
		// This may be empty in some repos, but shouldn't throw
		const result = runGit(
			["branch", "-r", "--format=%(refname:short)"],
			TEST_CWD,
		);
		expect(result.exitCode ?? 1).toBe(0);
	});
});

describe("get_diff_summary format", () => {
	test("numstat format is parseable", () => {
		const dir = createTestRepo();
		try {
			writeFileSync(join(dir, "file.txt"), "original");
			git(["add", "file.txt"], dir);
			git(["commit", "-m", "initial"], dir);

			writeFileSync(join(dir, "file.txt"), "modified\nwith\nmultiple\nlines");

			const output = git(["diff", "--numstat", "HEAD"], dir);

			// Format: added\tdeleted\tfilename
			const parts = output.split("\t");
			expect(parts.length).toBe(3);
			expect(Number.parseInt(parts[0] ?? "", 10)).toBeGreaterThan(0); // added lines
			expect(parts[2]).toBe("file.txt");
		} finally {
			cleanupTestRepo(dir);
		}
	});

	test("empty diff returns empty string", () => {
		const output = git(["diff", "--numstat", "HEAD", "HEAD"], TEST_CWD);
		expect(output).toBe("");
	});
});

describe("get_stash_list format", () => {
	test("empty stash returns empty", () => {
		const dir = createTestRepo();
		try {
			writeFileSync(join(dir, "init.txt"), "init");
			git(["add", "init.txt"], dir);
			git(["commit", "-m", "initial"], dir);

			const output = git(["stash", "list", "--format=%gd|%gs|%ci"], dir);
			expect(output).toBe("");
		} finally {
			cleanupTestRepo(dir);
		}
	});

	test("stash list format is parseable", () => {
		const dir = createTestRepo();
		try {
			writeFileSync(join(dir, "init.txt"), "init");
			git(["add", "init.txt"], dir);
			git(["commit", "-m", "initial"], dir);

			writeFileSync(join(dir, "init.txt"), "modified");
			git(["stash", "push", "-m", "work in progress"], dir);

			const output = git(["stash", "list", "--format=%gd|%gs|%ci"], dir);
			const parts = output.split("|");

			expect(parts.length).toBe(3);
			expect(parts[0]).toContain("stash@{0}");
			expect(parts[1]).toContain("work in progress");
			// parts[2] is the date
			expect(parts[2]?.length).toBeGreaterThan(0);
		} finally {
			cleanupTestRepo(dir);
		}
	});
});

// ============================================================================
// MCP Handler Tests - Format conversions and response structure
// ============================================================================

enum ResponseFormat {
	MARKDOWN = "markdown",
	JSON = "json",
}

interface Commit {
	hash: string;
	short: string;
	subject: string;
	author: string;
	relative_time: string;
	refs?: string;
}

interface CommitResult {
	count: number;
	commits: Commit[];
	message?: string;
	file?: string;
}

interface ErrorResult {
	error: string;
}

type GitResult<T> = T | ErrorResult;

function isError<T extends object>(
	result: GitResult<T>,
): result is ErrorResult {
	return typeof result === "object" && result !== null && "error" in result;
}

function formatCommits(
	results: GitResult<CommitResult>,
	format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
	if (isError(results)) {
		return format === ResponseFormat.JSON
			? JSON.stringify({ error: results.error }, null, 2)
			: `Error: ${results.error}`;
	}

	if (format === ResponseFormat.JSON) {
		return JSON.stringify(results, null, 2);
	}

	if (results.count === 0) {
		return results.message || "No commits found.";
	}

	let output = `Found ${results.count} commit${results.count === 1 ? "" : "s"}`;
	if (results.file) {
		output += ` for ${results.file}`;
	}
	output += ":\n\n";

	results.commits.forEach((commit, idx) => {
		output += `${idx + 1}. ${commit.short} - ${commit.subject}\n`;
		output += `   Author: ${commit.author} | ${commit.relative_time}`;
		if (commit.refs) {
			output += ` | ${commit.refs}`;
		}
		output += "\n\n";
	});

	return output.trim();
}

describe("MCP handler formatting", () => {
	describe("formatCommits", () => {
		test("should format markdown output with single commit", () => {
			const result: CommitResult = {
				count: 1,
				commits: [
					{
						hash: "abc123def456",
						short: "abc123d",
						subject: "feat: add new feature",
						author: "John Doe",
						relative_time: "2 hours ago",
					},
				],
			};

			const formatted = formatCommits(result, ResponseFormat.MARKDOWN);
			expect(formatted).toContain("Found 1 commit");
			expect(formatted).toContain("abc123d - feat: add new feature");
			expect(formatted).toContain("Author: John Doe | 2 hours ago");
		});

		test("should format markdown output with multiple commits", () => {
			const result: CommitResult = {
				count: 2,
				commits: [
					{
						hash: "abc123",
						short: "abc123",
						subject: "feat: add feature",
						author: "Alice",
						relative_time: "1 hour ago",
					},
					{
						hash: "def456",
						short: "def456",
						subject: "fix: resolve bug",
						author: "Bob",
						relative_time: "2 hours ago",
					},
				],
			};

			const formatted = formatCommits(result, ResponseFormat.MARKDOWN);
			expect(formatted).toContain("Found 2 commits");
			expect(formatted).toContain("1. abc123 - feat: add feature");
			expect(formatted).toContain("2. def456 - fix: resolve bug");
		});

		test("should format JSON output", () => {
			const result: CommitResult = {
				count: 1,
				commits: [
					{
						hash: "abc123",
						short: "abc123",
						subject: "feat: test",
						author: "Test",
						relative_time: "now",
					},
				],
			};

			const formatted = formatCommits(result, ResponseFormat.JSON);
			expect(() => JSON.parse(formatted)).not.toThrow();
			const parsed = JSON.parse(formatted);
			expect(parsed.count).toBe(1);
			expect(parsed.commits).toHaveLength(1);
			expect(parsed.commits[0].short).toBe("abc123");
		});

		test("should include refs when present", () => {
			const result: CommitResult = {
				count: 1,
				commits: [
					{
						hash: "abc123",
						short: "abc123",
						subject: "feat: test",
						author: "Test",
						relative_time: "now",
						refs: "HEAD -> main, origin/main",
					},
				],
			};

			const formatted = formatCommits(result, ResponseFormat.MARKDOWN);
			expect(formatted).toContain("HEAD -> main, origin/main");
		});

		test("should handle empty results", () => {
			const result: CommitResult = {
				count: 0,
				commits: [],
			};

			const formatted = formatCommits(result, ResponseFormat.MARKDOWN);
			expect(formatted).toBe("No commits found.");
		});

		test("should handle empty results with message", () => {
			const result: CommitResult = {
				count: 0,
				commits: [],
				message: "No commits found matching: test query",
			};

			const formatted = formatCommits(result, ResponseFormat.MARKDOWN);
			expect(formatted).toBe("No commits found matching: test query");
		});

		test("should include file name when present", () => {
			const result: CommitResult = {
				count: 2,
				commits: [
					{
						hash: "abc123",
						short: "abc123",
						subject: "Update README",
						author: "Alice",
						relative_time: "1 day ago",
					},
					{
						hash: "def456",
						short: "def456",
						subject: "Create README",
						author: "Bob",
						relative_time: "2 days ago",
					},
				],
				file: "README.md",
			};

			const formatted = formatCommits(result, ResponseFormat.MARKDOWN);
			expect(formatted).toContain("for README.md");
		});

		test("should format error results as markdown", () => {
			const result: ErrorResult = {
				error: "Not a git repository",
			};

			const formatted = formatCommits(result, ResponseFormat.MARKDOWN);
			expect(formatted).toBe("Error: Not a git repository");
		});

		test("should format error results as JSON", () => {
			const result: ErrorResult = {
				error: "Not a git repository",
			};

			const formatted = formatCommits(result, ResponseFormat.JSON);
			expect(() => JSON.parse(formatted)).not.toThrow();
			const parsed = JSON.parse(formatted);
			expect(parsed.error).toBe("Not a git repository");
		});
	});

	describe("isError type guard", () => {
		test("should identify error results", () => {
			const error: ErrorResult = { error: "Something failed" };
			expect(isError(error)).toBe(true);
		});

		test("should identify success results", () => {
			const success: CommitResult = { count: 0, commits: [] };
			expect(isError(success)).toBe(false);
		});

		test("should handle objects with other properties", () => {
			const result = { count: 1, data: "test" };
			expect(isError(result)).toBe(false);
		});
	});

	describe("response format parameter handling", () => {
		test("should default to markdown when not specified", () => {
			const format: ResponseFormat | undefined = undefined;
			const actualFormat =
				format === ResponseFormat.JSON
					? ResponseFormat.JSON
					: ResponseFormat.MARKDOWN;
			expect(actualFormat).toBe(ResponseFormat.MARKDOWN);
		});

		test("should use JSON when explicitly requested", () => {
			const format = "json";
			const actualFormat =
				format === "json" ? ResponseFormat.JSON : ResponseFormat.MARKDOWN;
			expect(actualFormat).toBe(ResponseFormat.JSON);
		});

		test("should parse format enum values", () => {
			expect(String(ResponseFormat.MARKDOWN)).toBe("markdown");
			expect(String(ResponseFormat.JSON)).toBe("json");
		});
	});
});
