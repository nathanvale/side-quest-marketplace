import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnAndCollect } from "../spawn/index.js";
import {
	assertGitRepo,
	ensureGitGuard,
	type GitGuardLogger,
	getUncommittedFiles,
	gitStatus,
	unescapeGitPath,
} from "./guard.js";

/**
 * Test helper: Initialize a git repository.
 */
async function initGitRepo(dir: string): Promise<void> {
	await spawnAndCollect(["git", "init"], { cwd: dir });
	await spawnAndCollect(["git", "config", "user.name", "Test User"], {
		cwd: dir,
	});
	await spawnAndCollect(["git", "config", "user.email", "test@example.com"], {
		cwd: dir,
	});
}

/**
 * Test helper: Create an initial commit.
 */
async function createInitialCommit(dir: string): Promise<void> {
	writeFileSync(join(dir, "README.md"), "# Test\n");
	await spawnAndCollect(["git", "add", "README.md"], { cwd: dir });
	await spawnAndCollect(["git", "commit", "-m", "Initial commit"], {
		cwd: dir,
	});
}

/**
 * Test helper: Create a logger that captures logs for assertions.
 */
function createTestLogger(): GitGuardLogger & {
	logs: Array<{ level: string; message: string; context?: unknown }>;
} {
	const logs: Array<{ level: string; message: string; context?: unknown }> = [];
	return {
		logs,
		debug: (message: string, context?: Record<string, unknown>) => {
			logs.push({ level: "debug", message, context });
		},
		info: (message: string, context?: Record<string, unknown>) => {
			logs.push({ level: "info", message, context });
		},
		error: (message: string, context?: Record<string, unknown>) => {
			logs.push({ level: "error", message, context });
		},
	};
}

describe("Git Guard", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `git-guard-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("unescapeGitPath", () => {
		test("handles octal escape sequences", () => {
			// 🧾 = F0 9F A7 BE in UTF-8 = \360\237\247\276 in git output
			const escaped = "\\360\\237\\247\\276 Invoice.md";
			const result = unescapeGitPath(escaped);
			expect(result).toBe("🧾 Invoice.md");
		});

		test("handles standard C escapes", () => {
			expect(unescapeGitPath("file\\twith\\ttabs.md")).toBe(
				"file\twith\ttabs.md",
			);
			expect(unescapeGitPath("file\\nwith\\nnewlines.md")).toBe(
				"file\nwith\nnewlines.md",
			);
			expect(unescapeGitPath("file\\rwith\\rcarriage.md")).toBe(
				"file\rwith\rcarriage.md",
			);
			expect(unescapeGitPath("file\\\\with\\\\backslash.md")).toBe(
				"file\\with\\backslash.md",
			);
			expect(unescapeGitPath('file\\"with\\"quotes.md')).toBe(
				'file"with"quotes.md',
			);
		});

		test("handles plain ASCII", () => {
			expect(unescapeGitPath("plain-file.md")).toBe("plain-file.md");
		});

		test("handles mixed content", () => {
			const escaped = "folder\\twith\\ttab/\\360\\237\\247\\276 file.md";
			const result = unescapeGitPath(escaped);
			expect(result).toBe("folder\twith\ttab/🧾 file.md");
		});
	});

	describe("assertGitRepo", () => {
		test("succeeds when directory is in a git repo", async () => {
			await initGitRepo(testDir);
			await expect(assertGitRepo(testDir)).resolves.toBeUndefined();
		});

		test("throws when directory is not in a git repo", async () => {
			await expect(assertGitRepo(testDir)).rejects.toThrow(
				"Directory must be inside a git repository",
			);
		});

		test("throws when directory is outside git root", async () => {
			// Create a git repo
			await initGitRepo(testDir);

			// Try to check a directory outside the repo
			const outsideDir = join(tmpdir(), `outside-${Date.now()}`);
			mkdirSync(outsideDir, { recursive: true });

			try {
				await expect(assertGitRepo(outsideDir)).rejects.toThrow(
					"Directory must be inside a git repository",
				);
			} finally {
				rmSync(outsideDir, { recursive: true, force: true });
			}
		});
	});

	describe("gitStatus", () => {
		test("returns clean:true for clean working tree", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			const result = await gitStatus(testDir);
			expect(result.clean).toBe(true);
		});

		test("returns clean:false for uncommitted changes", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			// Create an uncommitted file
			writeFileSync(join(testDir, "new.md"), "# New\n");

			const result = await gitStatus(testDir);
			expect(result.clean).toBe(false);
		});

		test("logs with optional logger", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			const logger = createTestLogger();
			await gitStatus(testDir, logger);

			expect(logger.logs).toEqual([
				{
					level: "debug",
					message: "git:getRepoStatus:start",
					context: { dir: testDir },
				},
				{
					level: "debug",
					message: "git:getRepoStatus:complete",
					context: { clean: true },
				},
			]);
		});

		test("throws when git command fails", async () => {
			// Non-git directory
			await expect(gitStatus(testDir)).rejects.toThrow("git status failed");
		});
	});

	describe("getUncommittedFiles", () => {
		test("returns only .md files by default", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			// Create various file types
			writeFileSync(join(testDir, "note.md"), "# Note\n");
			writeFileSync(join(testDir, "data.json"), "{}");
			writeFileSync(join(testDir, "doc.pdf"), "PDF");

			const files = await getUncommittedFiles({ dir: testDir });
			expect(files).toEqual(["note.md"]);
		});

		test("returns all file types when allFileTypes:true", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			// Create various file types
			writeFileSync(join(testDir, "note.md"), "# Note\n");
			writeFileSync(join(testDir, "data.json"), "{}");
			writeFileSync(join(testDir, "doc.pdf"), "PDF");

			const files = await getUncommittedFiles({
				dir: testDir,
				allFileTypes: true,
			});
			expect(files.sort()).toEqual(["data.json", "doc.pdf", "note.md"].sort());
		});

		test("handles files with spaces and quotes", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			writeFileSync(join(testDir, "My Note 1.md"), "# Note\n");

			const files = await getUncommittedFiles({ dir: testDir });
			expect(files).toEqual(["My Note 1.md"]);
		});

		test("handles files with emoji", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			writeFileSync(join(testDir, "🧾 Invoice.md"), "# Invoice\n");

			const files = await getUncommittedFiles({ dir: testDir });
			expect(files).toEqual(["🧾 Invoice.md"]);
		});

		test("includes staged and unstaged files", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			// Create and stage a file
			writeFileSync(join(testDir, "staged.md"), "# Staged\n");
			await spawnAndCollect(["git", "add", "staged.md"], { cwd: testDir });

			// Create an unstaged file
			writeFileSync(join(testDir, "unstaged.md"), "# Unstaged\n");

			const files = await getUncommittedFiles({ dir: testDir });
			expect(files.sort()).toEqual(["staged.md", "unstaged.md"].sort());
		});

		test("logs with optional logger", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			writeFileSync(join(testDir, "note.md"), "# Note\n");

			const logger = createTestLogger();
			await getUncommittedFiles({ dir: testDir, logger });

			expect(logger.logs).toEqual([
				{
					level: "debug",
					message: "git:getUncommittedFiles:start",
					context: { dir: testDir, allFileTypes: false },
				},
				{
					level: "debug",
					message: "git:getUncommittedFiles:complete",
					context: { filesFound: 1 },
				},
			]);
		});

		test("throws when git command fails", async () => {
			await expect(getUncommittedFiles({ dir: testDir })).rejects.toThrow(
				"git status failed",
			);
		});
	});

	describe("ensureGitGuard", () => {
		test("succeeds when working tree is clean", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			await expect(ensureGitGuard({ dir: testDir })).resolves.toBeUndefined();
		});

		test("throws when there are uncommitted .md files", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			writeFileSync(join(testDir, "note.md"), "# Note\n");

			await expect(ensureGitGuard({ dir: testDir })).rejects.toThrow(
				"Directory has uncommitted changes",
			);
		});

		test("ignores non-.md files by default", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			// Non-markdown files should be ignored
			writeFileSync(join(testDir, "data.json"), "{}");
			writeFileSync(join(testDir, "doc.pdf"), "PDF");

			await expect(ensureGitGuard({ dir: testDir })).resolves.toBeUndefined();
		});

		test("checks all file types when checkAllFileTypes:true", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			writeFileSync(join(testDir, "data.json"), "{}");

			await expect(
				ensureGitGuard({ dir: testDir, checkAllFileTypes: true }),
			).rejects.toThrow("Directory has uncommitted changes");
		});

		test("scopes check to managed folders", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			// Create folder structure
			mkdirSync(join(testDir, "Projects"), { recursive: true });
			mkdirSync(join(testDir, "Templates"), { recursive: true });

			// Uncommitted file in managed folder - should fail
			writeFileSync(join(testDir, "Projects", "note.md"), "# Note\n");

			// Uncommitted file in non-managed folder - should be ignored
			writeFileSync(join(testDir, "Templates", "template.md"), "# Template\n");

			const managedFolders = new Set(["Projects"]);

			await expect(
				ensureGitGuard({ dir: testDir, managedFolders }),
			).rejects.toThrow("Directory has uncommitted changes");
		});

		test("succeeds when uncommitted files are in non-managed folders", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			mkdirSync(join(testDir, "Templates"), { recursive: true });
			writeFileSync(join(testDir, "Templates", "template.md"), "# Template\n");

			const managedFolders = new Set(["Projects"]);

			await expect(
				ensureGitGuard({ dir: testDir, managedFolders }),
			).resolves.toBeUndefined();
		});

		test("logs with optional logger", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			const logger = createTestLogger();
			await ensureGitGuard({ dir: testDir, logger });

			expect(logger.logs).toContainEqual(
				expect.objectContaining({
					level: "info",
					message: "git:ensureGitGuard:start",
				}),
			);
			expect(logger.logs).toContainEqual(
				expect.objectContaining({
					level: "info",
					message: "git:ensureGitGuard:complete",
				}),
			);
		});

		test("logs error when guard fails", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			writeFileSync(join(testDir, "note.md"), "# Note\n");

			const logger = createTestLogger();

			await expect(ensureGitGuard({ dir: testDir, logger })).rejects.toThrow();

			expect(logger.logs).toContainEqual(
				expect.objectContaining({
					level: "error",
					message: "git:ensureGitGuard:error",
				}),
			);
		});

		test("includes file list in error message", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			writeFileSync(join(testDir, "note1.md"), "# Note 1\n");
			writeFileSync(join(testDir, "note2.md"), "# Note 2\n");

			try {
				await ensureGitGuard({ dir: testDir });
				expect.unreachable("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				const message = (error as Error).message;
				expect(message).toContain("Uncommitted files:");
				expect(message).toContain("note1.md");
				expect(message).toContain("note2.md");
			}
		});

		test("throws when directory is not in a git repo", async () => {
			await expect(ensureGitGuard({ dir: testDir })).rejects.toThrow(
				"Directory must be inside a git repository",
			);
		});
	});

	describe("integration scenarios", () => {
		test("supports nested folder structures", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			mkdirSync(join(testDir, "Projects", "Work"), { recursive: true });
			writeFileSync(join(testDir, "Projects", "Work", "note.md"), "# Note\n");

			const managedFolders = new Set(["Projects"]);

			await expect(
				ensureGitGuard({ dir: testDir, managedFolders }),
			).rejects.toThrow("Directory has uncommitted changes");
		});

		test("handles empty managed folders set", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			writeFileSync(join(testDir, "note.md"), "# Note\n");

			// Empty set means check all files
			await expect(
				ensureGitGuard({ dir: testDir, managedFolders: new Set() }),
			).rejects.toThrow("Directory has uncommitted changes");
		});

		test("workflow: clean repo -> modify -> commit -> clean again", async () => {
			await initGitRepo(testDir);
			await createInitialCommit(testDir);

			// Clean repo - should pass
			await expect(ensureGitGuard({ dir: testDir })).resolves.toBeUndefined();

			// Add uncommitted file - should fail
			writeFileSync(join(testDir, "note.md"), "# Note\n");
			await expect(ensureGitGuard({ dir: testDir })).rejects.toThrow();

			// Commit the file - should pass again
			await spawnAndCollect(["git", "add", "note.md"], { cwd: testDir });
			await spawnAndCollect(["git", "commit", "-m", "Add note"], {
				cwd: testDir,
			});
			await expect(ensureGitGuard({ dir: testDir })).resolves.toBeUndefined();
		});
	});
});
