import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { spawnAndCollect } from "@side-quest/core/spawn";
import { CONFIG_FILENAME } from "./config.js";

const CLI_PATH = path.join(import.meta.dir, "cli.ts");

describe("worktree CLI", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = fs.mkdtempSync(path.join(import.meta.dir, ".test-scratch-"));

		await spawnAndCollect(["git", "init", "-b", "main"], { cwd: tmpDir });
		await spawnAndCollect(["git", "config", "user.email", "test@test.com"], {
			cwd: tmpDir,
		});
		await spawnAndCollect(["git", "config", "user.name", "Test"], {
			cwd: tmpDir,
		});
		fs.writeFileSync(path.join(tmpDir, "README.md"), "# Test");
		fs.writeFileSync(path.join(tmpDir, ".env"), "SECRET=abc");
		await spawnAndCollect(["git", "add", "."], { cwd: tmpDir });
		await spawnAndCollect(["git", "commit", "-m", "initial"], {
			cwd: tmpDir,
		});

		// Write config for deterministic tests
		fs.writeFileSync(
			path.join(tmpDir, CONFIG_FILENAME),
			JSON.stringify({
				directory: ".worktrees",
				copy: [".env"],
				exclude: ["node_modules"],
				postCreate: null,
				preDelete: null,
				branchTemplate: "{type}/{description}",
			}),
		);
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	test("create: creates a worktree and outputs JSON", async () => {
		const result = await spawnAndCollect(
			[
				"bun",
				"run",
				CLI_PATH,
				"create",
				"feat/cli-test",
				"--no-install",
				"--no-fetch",
			],
			{ cwd: tmpDir },
		);

		expect(result.exitCode).toBe(0);
		const parsed = JSON.parse(result.stdout);
		expect(parsed.branch).toBe("feat/cli-test");
		expect(parsed.filesCopied).toBe(1);
	});

	test("list: lists worktrees as JSON", async () => {
		// Create a worktree first
		await spawnAndCollect(
			[
				"bun",
				"run",
				CLI_PATH,
				"create",
				"feat/list-test",
				"--no-install",
				"--no-fetch",
			],
			{ cwd: tmpDir },
		);

		const result = await spawnAndCollect(["bun", "run", CLI_PATH, "list"], {
			cwd: tmpDir,
		});

		expect(result.exitCode).toBe(0);
		const parsed = JSON.parse(result.stdout);
		expect(Array.isArray(parsed)).toBe(true);
		// Without --all, main worktree is excluded
		expect(parsed).toHaveLength(1);
		expect(parsed[0].branch).toBe("feat/list-test");
	});

	test("list --all: includes main worktree", async () => {
		const result = await spawnAndCollect(
			["bun", "run", CLI_PATH, "list", "--all"],
			{ cwd: tmpDir },
		);

		expect(result.exitCode).toBe(0);
		const parsed = JSON.parse(result.stdout);
		expect(parsed.some((w: { isMain: boolean }) => w.isMain)).toBe(true);
	});

	test("delete: removes a worktree", async () => {
		await spawnAndCollect(
			[
				"bun",
				"run",
				CLI_PATH,
				"create",
				"feat/delete-test",
				"--no-install",
				"--no-fetch",
			],
			{ cwd: tmpDir },
		);

		const result = await spawnAndCollect(
			["bun", "run", CLI_PATH, "delete", "feat/delete-test"],
			{ cwd: tmpDir },
		);

		expect(result.exitCode).toBe(0);
		const parsed = JSON.parse(result.stdout);
		expect(parsed.branch).toBe("feat/delete-test");
	});

	test("check: shows pre-deletion status", async () => {
		await spawnAndCollect(
			[
				"bun",
				"run",
				CLI_PATH,
				"create",
				"feat/check-test",
				"--no-install",
				"--no-fetch",
			],
			{ cwd: tmpDir },
		);

		const result = await spawnAndCollect(
			["bun", "run", CLI_PATH, "check", "feat/check-test"],
			{ cwd: tmpDir },
		);

		expect(result.exitCode).toBe(0);
		const parsed = JSON.parse(result.stdout);
		expect(parsed.exists).toBe(true);
		expect(parsed.dirty).toBe(false);
	});

	test("init: creates .worktrees.json", async () => {
		// Remove the config first
		fs.unlinkSync(path.join(tmpDir, CONFIG_FILENAME));

		const result = await spawnAndCollect(["bun", "run", CLI_PATH, "init"], {
			cwd: tmpDir,
		});

		expect(result.exitCode).toBe(0);
		const parsed = JSON.parse(result.stdout);
		expect(parsed.message).toContain("auto-detected");
		expect(fs.existsSync(path.join(tmpDir, CONFIG_FILENAME))).toBe(true);
	});

	test("unknown command: exits with error", async () => {
		const result = await spawnAndCollect(["bun", "run", CLI_PATH, "bogus"], {
			cwd: tmpDir,
		});

		expect(result.exitCode).not.toBe(0);
	});

	test("create without branch: exits with error", async () => {
		const result = await spawnAndCollect(["bun", "run", CLI_PATH, "create"], {
			cwd: tmpDir,
		});

		expect(result.exitCode).not.toBe(0);
	});
});
