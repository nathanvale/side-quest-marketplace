import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { spawnAndCollect } from "@side-quest/core/spawn";
import { CONFIG_FILENAME } from "./config.js";
import { checkBeforeDelete, deleteWorktree } from "./delete.js";

describe("deleteWorktree", () => {
	let tmpDir: string;
	let gitRoot: string;

	beforeEach(async () => {
		tmpDir = fs.mkdtempSync(path.join(import.meta.dir, ".test-scratch-"));
		gitRoot = tmpDir;

		await spawnAndCollect(["git", "init", "-b", "main"], { cwd: gitRoot });
		await spawnAndCollect(["git", "config", "user.email", "test@test.com"], {
			cwd: gitRoot,
		});
		await spawnAndCollect(["git", "config", "user.name", "Test"], {
			cwd: gitRoot,
		});
		fs.writeFileSync(path.join(gitRoot, "README.md"), "# Test");
		await spawnAndCollect(["git", "add", "."], { cwd: gitRoot });
		await spawnAndCollect(["git", "commit", "-m", "initial"], {
			cwd: gitRoot,
		});

		// Write a config so tests are deterministic
		fs.writeFileSync(
			path.join(gitRoot, CONFIG_FILENAME),
			JSON.stringify({
				directory: ".worktrees",
				copy: [],
				exclude: [],
				postCreate: null,
				preDelete: null,
				branchTemplate: "{type}/{description}",
			}),
		);
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	/** Helper: create a worktree for testing deletion. */
	async function createTestWorktree(branch: string): Promise<string> {
		const sanitized = branch.replace(/\//g, "-");
		const wtPath = path.join(gitRoot, ".worktrees", sanitized);
		await spawnAndCollect(["git", "worktree", "add", "-b", branch, wtPath], {
			cwd: gitRoot,
		});
		return wtPath;
	}

	describe("checkBeforeDelete", () => {
		test("reports exists=false for nonexistent worktree", async () => {
			const check = await checkBeforeDelete(gitRoot, "feat/nope");
			expect(check.exists).toBe(false);
		});

		test("reports clean worktree", async () => {
			await createTestWorktree("feat/clean");

			const check = await checkBeforeDelete(gitRoot, "feat/clean");
			expect(check.exists).toBe(true);
			expect(check.dirty).toBe(false);
		});

		test("reports dirty worktree", async () => {
			const wtPath = await createTestWorktree("feat/dirty");
			fs.writeFileSync(path.join(wtPath, "dirty.txt"), "uncommitted");

			const check = await checkBeforeDelete(gitRoot, "feat/dirty");
			expect(check.dirty).toBe(true);
		});

		test("reports merged status", async () => {
			const wtPath = await createTestWorktree("feat/merged");
			fs.writeFileSync(path.join(wtPath, "feature.txt"), "done");
			await spawnAndCollect(["git", "add", "."], { cwd: wtPath });
			await spawnAndCollect(["git", "commit", "-m", "feature"], {
				cwd: wtPath,
			});
			await spawnAndCollect(["git", "merge", "feat/merged"], {
				cwd: gitRoot,
			});

			const check = await checkBeforeDelete(gitRoot, "feat/merged");
			expect(check.merged).toBe(true);
		});
	});

	describe("deleteWorktree", () => {
		test("removes a clean worktree", async () => {
			const wtPath = await createTestWorktree("feat/remove-me");

			const result = await deleteWorktree(gitRoot, "feat/remove-me");

			expect(result.branch).toBe("feat/remove-me");
			expect(fs.existsSync(wtPath)).toBe(false);
			expect(result.branchDeleted).toBe(false);
		});

		test("deletes branch when requested", async () => {
			const wtPath = await createTestWorktree("feat/delete-branch");
			// Merge so -d works
			fs.writeFileSync(path.join(wtPath, "x.txt"), "x");
			await spawnAndCollect(["git", "add", "."], { cwd: wtPath });
			await spawnAndCollect(["git", "commit", "-m", "x"], {
				cwd: wtPath,
			});
			await spawnAndCollect(["git", "merge", "feat/delete-branch"], {
				cwd: gitRoot,
			});

			const result = await deleteWorktree(gitRoot, "feat/delete-branch", {
				deleteBranch: true,
			});

			expect(result.branchDeleted).toBe(true);

			// Branch should be gone
			const branchResult = await spawnAndCollect(
				["git", "rev-parse", "--verify", "feat/delete-branch"],
				{ cwd: gitRoot },
			);
			expect(branchResult.exitCode).not.toBe(0);
		});

		test("force-removes dirty worktree", async () => {
			const wtPath = await createTestWorktree("feat/force");
			fs.writeFileSync(path.join(wtPath, "dirty.txt"), "uncommitted");

			const result = await deleteWorktree(gitRoot, "feat/force", {
				force: true,
			});

			expect(fs.existsSync(wtPath)).toBe(false);
			expect(result.branch).toBe("feat/force");
		});

		test("throws on non-forced dirty worktree", async () => {
			const wtPath = await createTestWorktree("feat/no-force");
			fs.writeFileSync(path.join(wtPath, "dirty.txt"), "uncommitted");

			expect(deleteWorktree(gitRoot, "feat/no-force")).rejects.toThrow(
				"Failed to remove worktree",
			);
		});
	});
});
