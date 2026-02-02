import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { spawnAndCollect } from "@side-quest/core/spawn";
import { listWorktrees } from "./list.js";

describe("listWorktrees", () => {
	let tmpDir: string;
	let gitRoot: string;

	beforeEach(async () => {
		tmpDir = fs.mkdtempSync(path.join(import.meta.dir, ".test-scratch-"));
		gitRoot = tmpDir;

		// Initialize a git repo with an initial commit
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
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	test("lists the main worktree", async () => {
		const worktrees = await listWorktrees(gitRoot);

		expect(worktrees).toHaveLength(1);
		expect(worktrees[0]!.branch).toBe("main");
		expect(worktrees[0]!.isMain).toBe(true);
		expect(worktrees[0]!.path).toBe(gitRoot);
	});

	test("lists additional worktrees", async () => {
		// Create a worktree
		const wtPath = path.join(gitRoot, ".worktrees", "feat-test");
		await spawnAndCollect(
			["git", "worktree", "add", "-b", "feat/test", wtPath],
			{ cwd: gitRoot },
		);

		const worktrees = await listWorktrees(gitRoot);

		expect(worktrees).toHaveLength(2);

		const feature = worktrees.find((w) => w.branch === "feat/test");
		expect(feature).toBeDefined();
		expect(feature!.path).toBe(wtPath);
		expect(feature!.isMain).toBe(false);
	});

	test("detects dirty worktrees", async () => {
		const wtPath = path.join(gitRoot, ".worktrees", "feat-dirty");
		await spawnAndCollect(
			["git", "worktree", "add", "-b", "feat/dirty", wtPath],
			{ cwd: gitRoot },
		);

		// Make the worktree dirty
		fs.writeFileSync(path.join(wtPath, "dirty.txt"), "uncommitted");

		const worktrees = await listWorktrees(gitRoot);
		const dirty = worktrees.find((w) => w.branch === "feat/dirty");

		expect(dirty).toBeDefined();
		expect(dirty!.dirty).toBe(true);
	});

	test("detects clean worktrees", async () => {
		const wtPath = path.join(gitRoot, ".worktrees", "feat-clean");
		await spawnAndCollect(
			["git", "worktree", "add", "-b", "feat/clean", wtPath],
			{ cwd: gitRoot },
		);

		const worktrees = await listWorktrees(gitRoot);
		const clean = worktrees.find((w) => w.branch === "feat/clean");

		expect(clean).toBeDefined();
		expect(clean!.dirty).toBe(false);
	});

	test("detects merged branches", async () => {
		// Create a branch, commit, merge it back
		const wtPath = path.join(gitRoot, ".worktrees", "feat-merged");
		await spawnAndCollect(
			["git", "worktree", "add", "-b", "feat/merged", wtPath],
			{ cwd: gitRoot },
		);
		fs.writeFileSync(path.join(wtPath, "feature.txt"), "feature");
		await spawnAndCollect(["git", "add", "."], { cwd: wtPath });
		await spawnAndCollect(["git", "commit", "-m", "add feature"], {
			cwd: wtPath,
		});

		// Merge into main
		await spawnAndCollect(["git", "merge", "feat/merged"], {
			cwd: gitRoot,
		});

		const worktrees = await listWorktrees(gitRoot);
		const merged = worktrees.find((w) => w.branch === "feat/merged");

		expect(merged).toBeDefined();
		expect(merged!.merged).toBe(true);
	});

	test("includes short SHA for head", async () => {
		const worktrees = await listWorktrees(gitRoot);
		expect(worktrees[0]!.head).toHaveLength(7);
	});
});
