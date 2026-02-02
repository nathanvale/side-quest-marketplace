import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { spawnAndCollect } from "@sidequest/core/spawn";
import { CONFIG_FILENAME } from "./config.js";
import { createWorktree } from "./create.js";

describe("createWorktree", () => {
	let tmpDir: string;
	let gitRoot: string;

	beforeEach(async () => {
		tmpDir = fs.mkdtempSync(path.join(import.meta.dir, ".test-scratch-"));
		gitRoot = tmpDir;

		// Initialize a git repo with an initial commit
		await spawnAndCollect(["git", "init"], { cwd: gitRoot });
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

	test("creates a worktree with a new branch", async () => {
		const result = await createWorktree(gitRoot, "feat/test-feature", {
			noInstall: true,
		});

		expect(result.branch).toBe("feat/test-feature");
		expect(result.path).toContain(".worktrees");
		expect(result.path).toContain("feat-test-feature");
		expect(fs.existsSync(result.path)).toBe(true);

		// Verify git recognizes the worktree
		const listResult = await spawnAndCollect(["git", "worktree", "list"], {
			cwd: gitRoot,
		});
		expect(listResult.stdout).toContain("feat/test-feature");
	});

	test("copies configured files to the new worktree", async () => {
		// Create files to copy
		fs.writeFileSync(path.join(gitRoot, ".env"), "SECRET=abc");
		fs.writeFileSync(path.join(gitRoot, ".nvmrc"), "20");

		// Write config
		const config = {
			directory: ".worktrees",
			copy: [".env", ".nvmrc"],
			exclude: ["node_modules"],
			postCreate: null,
			preDelete: null,
			branchTemplate: "{type}/{description}",
		};
		fs.writeFileSync(
			path.join(gitRoot, CONFIG_FILENAME),
			JSON.stringify(config),
		);

		const result = await createWorktree(gitRoot, "feat/with-files", {
			noInstall: true,
		});

		expect(result.filesCopied).toBe(2);
		expect(fs.readFileSync(path.join(result.path, ".env"), "utf-8")).toBe(
			"SECRET=abc",
		);
		expect(fs.readFileSync(path.join(result.path, ".nvmrc"), "utf-8")).toBe(
			"20",
		);
	});

	test("uses auto-detected config when no config file exists", async () => {
		fs.writeFileSync(path.join(gitRoot, ".env"), "SECRET=abc");

		const result = await createWorktree(gitRoot, "feat/auto-detect", {
			noInstall: true,
		});

		expect(result.configAutoDetected).toBe(true);
		expect(result.filesCopied).toBeGreaterThanOrEqual(1);
	});

	test("throws when worktree already exists", async () => {
		await createWorktree(gitRoot, "feat/existing", { noInstall: true });

		expect(
			createWorktree(gitRoot, "feat/existing", { noInstall: true }),
		).rejects.toThrow("Worktree already exists");
	});

	test("sanitizes branch name for directory", async () => {
		const result = await createWorktree(gitRoot, "feat/nested/branch", {
			noInstall: true,
		});

		// Directory uses hyphens instead of slashes
		expect(path.basename(result.path)).toBe("feat-nested-branch");
	});
});
