import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { copyWorktreeFiles } from "./copy-files.js";

describe("copyWorktreeFiles", () => {
	let sourceDir: string;
	let destDir: string;

	beforeEach(() => {
		const base = fs.mkdtempSync(path.join(import.meta.dir, ".test-scratch-"));
		sourceDir = path.join(base, "source");
		destDir = path.join(base, "dest");
		fs.mkdirSync(sourceDir, { recursive: true });
		fs.mkdirSync(destDir, { recursive: true });
	});

	afterEach(() => {
		// Clean up both source and dest (they share a parent)
		const parent = path.dirname(sourceDir);
		fs.rmSync(parent, { recursive: true, force: true });
	});

	test("copies root-level files matching exact pattern", () => {
		fs.writeFileSync(path.join(sourceDir, ".env"), "SECRET=abc");

		const copied = copyWorktreeFiles(sourceDir, destDir, [".env"], []);
		expect(copied).toBe(1);
		expect(fs.readFileSync(path.join(destDir, ".env"), "utf-8")).toBe(
			"SECRET=abc",
		);
	});

	test("copies root-level files matching glob pattern", () => {
		fs.writeFileSync(path.join(sourceDir, ".env.local"), "LOCAL=true");
		fs.writeFileSync(path.join(sourceDir, ".env.test"), "TEST=true");

		const copied = copyWorktreeFiles(sourceDir, destDir, [".env.*"], []);
		expect(copied).toBe(2);
		expect(fs.existsSync(path.join(destDir, ".env.local"))).toBe(true);
		expect(fs.existsSync(path.join(destDir, ".env.test"))).toBe(true);
	});

	test("copies files matching recursive pattern", () => {
		// Create nested CLAUDE.md files
		const subdir = path.join(sourceDir, "plugins", "git");
		fs.mkdirSync(subdir, { recursive: true });
		fs.writeFileSync(path.join(sourceDir, "CLAUDE.md"), "# Root");
		fs.writeFileSync(path.join(subdir, "CLAUDE.md"), "# Plugin");

		const copied = copyWorktreeFiles(sourceDir, destDir, ["**/CLAUDE.md"], []);
		expect(copied).toBe(2);
		expect(fs.existsSync(path.join(destDir, "CLAUDE.md"))).toBe(true);
		expect(
			fs.existsSync(path.join(destDir, "plugins", "git", "CLAUDE.md")),
		).toBe(true);
	});

	test("preserves directory structure for recursive copies", () => {
		const deep = path.join(sourceDir, "a", "b", "c");
		fs.mkdirSync(deep, { recursive: true });
		fs.writeFileSync(path.join(deep, "CLAUDE.md"), "# Deep");

		copyWorktreeFiles(sourceDir, destDir, ["**/CLAUDE.md"], []);
		expect(
			fs.readFileSync(path.join(destDir, "a", "b", "c", "CLAUDE.md"), "utf-8"),
		).toBe("# Deep");
	});

	test("skips excluded directories during recursive copy", () => {
		const nodeModules = path.join(sourceDir, "node_modules", "pkg");
		fs.mkdirSync(nodeModules, { recursive: true });
		fs.writeFileSync(path.join(nodeModules, "CLAUDE.md"), "# Should skip");
		fs.writeFileSync(path.join(sourceDir, "CLAUDE.md"), "# Root");

		const copied = copyWorktreeFiles(
			sourceDir,
			destDir,
			["**/CLAUDE.md"],
			["node_modules"],
		);
		expect(copied).toBe(1);
		expect(
			fs.existsSync(path.join(destDir, "node_modules", "pkg", "CLAUDE.md")),
		).toBe(false);
	});

	test("copies a directory pattern (e.g., .claude)", () => {
		const claudeDir = path.join(sourceDir, ".claude");
		fs.mkdirSync(claudeDir, { recursive: true });
		fs.writeFileSync(path.join(claudeDir, "settings.json"), '{"key": "val"}');
		fs.writeFileSync(path.join(claudeDir, "CLAUDE.md"), "# Memory");

		const copied = copyWorktreeFiles(sourceDir, destDir, [".claude"], []);
		expect(copied).toBeGreaterThanOrEqual(2);
		expect(fs.existsSync(path.join(destDir, ".claude", "settings.json"))).toBe(
			true,
		);
		expect(fs.existsSync(path.join(destDir, ".claude", "CLAUDE.md"))).toBe(
			true,
		);
	});

	test("returns 0 when no patterns match", () => {
		const copied = copyWorktreeFiles(
			sourceDir,
			destDir,
			[".env", ".nvmrc"],
			[],
		);
		expect(copied).toBe(0);
	});

	test("handles mix of root and recursive patterns", () => {
		fs.writeFileSync(path.join(sourceDir, ".env"), "SECRET=abc");
		fs.writeFileSync(path.join(sourceDir, ".nvmrc"), "20");
		const sub = path.join(sourceDir, "plugins", "foo");
		fs.mkdirSync(sub, { recursive: true });
		fs.writeFileSync(path.join(sub, "CLAUDE.md"), "# Foo");

		const copied = copyWorktreeFiles(
			sourceDir,
			destDir,
			[".env", ".nvmrc", "**/CLAUDE.md"],
			[],
		);
		expect(copied).toBe(3);
	});

	test("does not double-copy files matching multiple recursive patterns", () => {
		fs.writeFileSync(path.join(sourceDir, "test.kit"), "kit file");

		const copied = copyWorktreeFiles(
			sourceDir,
			destDir,
			["**/*.kit", "**/test.kit"],
			[],
		);
		// Should only copy once despite matching both patterns
		expect(copied).toBe(1);
	});
});
