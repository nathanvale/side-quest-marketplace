import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import path from "node:path";
import { ensureDirSync, writeTextFileSync } from "./index.js";
import { walkDirectory } from "./walk.js";

describe("walkDirectory", () => {
	let tempDir: string;

	beforeEach(() => {
		// Create unique temp directory for each test
		tempDir = path.join(
			process.env.TMPDIR || "/tmp",
			`walk-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		ensureDirSync(tempDir);
	});

	afterEach(() => {
		// Cleanup temp directory
		try {
			Bun.spawnSync(["rm", "-rf", tempDir]);
		} catch {
			// Ignore cleanup errors
		}
	});

	test("visits all files in simple directory", () => {
		// Arrange
		writeTextFileSync(path.join(tempDir, "file1.txt"), "content1");
		writeTextFileSync(path.join(tempDir, "file2.md"), "content2");

		const visited: string[] = [];

		// Act
		walkDirectory(tempDir, (fullPath, relativePath) => {
			visited.push(relativePath);
		});

		// Assert
		expect(visited.sort()).toEqual(["file1.txt", "file2.md"]);
	});

	test("visits files in nested directories", () => {
		// Arrange
		ensureDirSync(path.join(tempDir, "dir1"));
		ensureDirSync(path.join(tempDir, "dir2", "nested"));

		writeTextFileSync(path.join(tempDir, "root.txt"), "root");
		writeTextFileSync(path.join(tempDir, "dir1", "a.txt"), "a");
		writeTextFileSync(path.join(tempDir, "dir2", "b.txt"), "b");
		writeTextFileSync(path.join(tempDir, "dir2", "nested", "c.txt"), "c");

		const visited: string[] = [];

		// Act
		walkDirectory(tempDir, (fullPath, relativePath) => {
			visited.push(relativePath);
		});

		// Assert
		expect(visited.sort()).toEqual([
			path.join("dir1", "a.txt"),
			path.join("dir2", "b.txt"),
			path.join("dir2", "nested", "c.txt"),
			"root.txt",
		]);
	});

	test("skips hidden files and directories when skipHidden is true", () => {
		// Arrange
		ensureDirSync(path.join(tempDir, ".hidden"));
		writeTextFileSync(path.join(tempDir, "visible.txt"), "visible");
		writeTextFileSync(path.join(tempDir, ".hidden-file"), "hidden");
		writeTextFileSync(path.join(tempDir, ".hidden", "nested.txt"), "nested");

		const visited: string[] = [];

		// Act
		walkDirectory(tempDir, (fullPath, relativePath) => {
			visited.push(relativePath);
		});

		// Assert
		expect(visited).toEqual(["visible.txt"]);
	});

	test("includes hidden files when skipHidden is false", () => {
		// Arrange
		ensureDirSync(path.join(tempDir, ".hidden"));
		writeTextFileSync(path.join(tempDir, "visible.txt"), "visible");
		writeTextFileSync(path.join(tempDir, ".hidden-file"), "hidden");
		writeTextFileSync(path.join(tempDir, ".hidden", "nested.txt"), "nested");

		const visited: string[] = [];

		// Act
		walkDirectory(
			tempDir,
			(fullPath, relativePath) => {
				visited.push(relativePath);
			},
			{ skipHidden: false },
		);

		// Assert
		const expected = [
			path.join(".hidden", "nested.txt"),
			".hidden-file",
			"visible.txt",
		].sort();
		expect(visited.sort()).toEqual(expected);
	});

	test("skips specified directories", () => {
		// Arrange
		ensureDirSync(path.join(tempDir, "node_modules"));
		ensureDirSync(path.join(tempDir, "dist"));
		ensureDirSync(path.join(tempDir, "src"));

		writeTextFileSync(path.join(tempDir, "node_modules", "lib.js"), "lib");
		writeTextFileSync(path.join(tempDir, "dist", "bundle.js"), "bundle");
		writeTextFileSync(path.join(tempDir, "src", "index.ts"), "source");

		const visited: string[] = [];

		// Act
		walkDirectory(
			tempDir,
			(fullPath, relativePath) => {
				visited.push(relativePath);
			},
			{ skipDirs: ["node_modules", "dist"] },
		);

		// Assert
		expect(visited).toEqual([path.join("src", "index.ts")]);
	});

	test("provides fullPath, relativePath, and entry to visitor", () => {
		// Arrange
		ensureDirSync(path.join(tempDir, "subdir"));
		writeTextFileSync(path.join(tempDir, "subdir", "test.txt"), "test");

		let capturedFullPath = "";
		let capturedRelativePath = "";
		let capturedEntry = "";

		// Act
		walkDirectory(tempDir, (fullPath, relativePath, entry) => {
			capturedFullPath = fullPath;
			capturedRelativePath = relativePath;
			capturedEntry = entry;
		});

		// Assert
		expect(capturedFullPath).toBe(path.join(tempDir, "subdir", "test.txt"));
		expect(capturedRelativePath).toBe(path.join("subdir", "test.txt"));
		expect(capturedEntry).toBe("test.txt");
	});

	test("handles empty directory", () => {
		// Arrange
		const visited: string[] = [];

		// Act
		walkDirectory(tempDir, (fullPath, relativePath) => {
			visited.push(relativePath);
		});

		// Assert
		expect(visited).toEqual([]);
	});

	test("filters files during traversal", () => {
		// Arrange
		writeTextFileSync(path.join(tempDir, "file1.md"), "markdown");
		writeTextFileSync(path.join(tempDir, "file2.txt"), "text");
		writeTextFileSync(path.join(tempDir, "file3.md"), "markdown");

		const markdownFiles: string[] = [];

		// Act
		walkDirectory(tempDir, (fullPath, relativePath, entry) => {
			if (entry.endsWith(".md")) {
				markdownFiles.push(relativePath);
			}
		});

		// Assert
		expect(markdownFiles.sort()).toEqual(["file1.md", "file3.md"]);
	});

	test("combines skipHidden and skipDirs options", () => {
		// Arrange
		ensureDirSync(path.join(tempDir, ".git"));
		ensureDirSync(path.join(tempDir, "node_modules"));
		ensureDirSync(path.join(tempDir, "src"));

		writeTextFileSync(path.join(tempDir, ".git", "config"), "git");
		writeTextFileSync(path.join(tempDir, "node_modules", "lib.js"), "lib");
		writeTextFileSync(path.join(tempDir, "src", "index.ts"), "source");
		writeTextFileSync(path.join(tempDir, ".env"), "env");

		const visited: string[] = [];

		// Act
		walkDirectory(
			tempDir,
			(fullPath, relativePath) => {
				visited.push(relativePath);
			},
			{ skipHidden: true, skipDirs: ["node_modules"] },
		);

		// Assert
		expect(visited).toEqual([path.join("src", "index.ts")]);
	});
});
